import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STORAGE_KEYS = {
	fiveEToolsHomebrew: 'dnd-dm-helper.5etools-homebrew.v1',
	fiveEToolsHomebrewBackups: 'dnd-dm-helper.5etools-homebrew.backups.v1',
	fiveEToolsHomebrewCompositionPackages: 'dnd-dm-helper.5etools-homebrew.composition-packages.v1',
};

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const clone = (value) => structuredClone(value);
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const canonicalName = (value) => String(value ?? '').trim().normalize('NFC').toLocaleLowerCase('pt-BR');
const category = (value) =>
	value === 'pc' || value === 'npc' || value === 'other' || value === 'monster' ? value : 'monster';
const finiteNumber = (value) => {
	if (value == null || value === '') return null;
	const numeric = typeof value === 'number' ? value : Number(String(value).trim());
	return Number.isFinite(numeric) ? numeric : null;
};
const nonNegativeInt = (value) => Math.max(0, Math.floor(finiteNumber(value) ?? 0));
const uniqueStrings = (values) => {
	const result = new Map();
	for (const value of values ?? []) {
		if (!hasText(value)) continue;
		const text = value.trim();
		const key = text.normalize('NFC').toLocaleLowerCase('pt-BR');
		if (!result.has(key)) result.set(key, text);
	}
	return [...result.values()];
};

function createReport(input) {
	return {
		input: {
			encounters: input.data.encounters.length,
			sheets: input.data.homebrewSheets.length,
			battles: input.data.battleEncounters.length,
			bytes: Buffer.byteLength(JSON.stringify(input)),
		},
		output: { encounters: 0, participants: 0, sheets: 0, battles: 0, bytes: 0 },
		initiativesConvertedToNull: 0,
		armorClassNormalized: { null: 0, number: 0, invalid: 0, battleNullFromKnownBlank: 0 },
		fakeLairActionsConverted: [],
		fakeTrapParticipants: [],
		sourceSheetIdsRecovered: [],
		categoriesCorrected: [],
		unlinkedParticipants: [],
		ambiguousParticipants: [],
		fieldsDiscarded: {},
		rawLocalStorageRemoved: [],
		warnings: [],
	};
}

function count(report, field) {
	report.fieldsDiscarded[field] = (report.fieldsDiscarded[field] ?? 0) + 1;
}

function normalizeArmorClass(value, report, context) {
	const normalized = finiteNumber(value);
	if (normalized === null) {
		if (value !== null) {
			report.armorClassNormalized.null += 1;
			if (value !== '' && value !== undefined) report.armorClassNormalized.invalid += 1;
		}
		return null;
	}
	if (value !== normalized) report.armorClassNormalized.number += 1;
	void context;
	return normalized;
}

function normalizeSheetData(raw, report, fallbackName) {
	const source = isRecord(raw) ? raw : {};
	return {
		...clone(source),
		name: hasText(source.name) ? source.name.trim() : fallbackName,
		armorClass: normalizeArmorClass(source.armorClass, report, fallbackName),
		maxHp: nonNegativeInt(source.maxHp),
		spellSlots: Array.isArray(source.spellSlots) ? clone(source.spellSlots) : [],
		spells: Array.isArray(source.spells) ? clone(source.spells) : [],
		specialAbilities: Array.isArray(source.specialAbilities) ? clone(source.specialAbilities) : [],
		features: Array.isArray(source.features) ? clone(source.features) : [],
		...(Array.isArray(source.tags) ? { tags: uniqueStrings(source.tags) } : {}),
		...(hasText(source.origin) ? { origin: source.origin.trim() } : {}),
		...(isRecord(source.rawFiveETools) ? { rawFiveETools: clone(source.rawFiveETools) } : {}),
		...(isRecord(source.fiveEToolsIdentity) ? { fiveEToolsIdentity: clone(source.fiveEToolsIdentity) } : {}),
	};
}

function normalizeSheet(raw, index, report) {
	const source = isRecord(raw) ? raw : {};
	const title = hasText(source.title) ? source.title.trim() : `Sheet ${index + 1}`;
	const data = normalizeSheetData(source.data, report, title);
	if (!data.origin && hasText(source.origin ?? source.source)) data.origin = String(source.origin ?? source.source).trim();
	if (!data.tags?.length && Array.isArray(source.tags)) data.tags = uniqueStrings(source.tags);
	return {
		id: hasText(source.id) ? source.id.trim() : `sheet-${index + 1}`,
		externalId: hasText(source.externalId) ? source.externalId.trim() : hasText(source.id) ? source.id.trim() : `sheet-${index + 1}`,
		title,
		createdAt: finiteNumber(source.createdAt) ?? 0,
		updatedAt: finiteNumber(source.updatedAt) ?? finiteNumber(source.createdAt) ?? 0,
		category: category(source.category),
		tags: Array.isArray(source.tags) ? source.tags.filter(hasText).map((tag) => tag.trim()) : [],
		source: hasText(source.source) ? source.source.trim() : '',
		data,
	};
}

function isLegacyLairPlaceholder(participant) {
	return (
		canonicalName(participant.name) === 'lair action' &&
		!hasText(participant.sourceSheetId) &&
		participant.category === 'monster' &&
		participant.initiative === 20 &&
		(participant.sheet.maxHp === 0 || participant.sheet.maxHp === 1) &&
		participant.sheet.armorClass === null &&
		participant.sheet.spellSlots.length === 0 &&
		participant.sheet.spells.length === 0 &&
		participant.sheet.specialAbilities.length === 0 &&
		participant.sheet.features.length === 0
	);
}

function normalizeLairAction(raw, index) {
	const source = isRecord(raw) ? raw : {};
	const frequency =
		source.frequency === 'cooldown-rounds' || source.frequency === 'manual'
			? source.frequency
			: 'every-round';
	return {
		id: hasText(source.id) ? source.id.trim() : `lair-action-${index + 1}`,
		name: hasText(source.name) ? source.name.trim() : `Lair Action ${index + 1}`,
		...(hasText(source.description) ? { description: source.description.trim() } : {}),
		initiative: finiteNumber(source.initiative) ?? 20,
		active: source.active !== false,
		frequency,
		...(frequency === 'cooldown-rounds'
			? { cooldownRounds: Math.max(1, nonNegativeInt(source.cooldownRounds) || 1) }
			: {}),
	};
}

function normalizeTrap(raw, index) {
	const source = isRecord(raw) ? raw : {};
	const triggerType = ['initiative', 'round-start', 'round-end'].includes(source.triggerType)
		? source.triggerType
		: 'manual';
	const frequency = ['once', 'every-round', 'cooldown-rounds'].includes(source.frequency)
		? source.frequency
		: 'manual';
	return {
		id: hasText(source.id) ? source.id.trim() : `trap-${index + 1}`,
		name: hasText(source.name) ? source.name.trim() : `Armadilha ${index + 1}`,
		...(hasText(source.description) ? { description: source.description.trim() } : {}),
		triggerType,
		...(triggerType === 'initiative' ? { initiative: finiteNumber(source.initiative) ?? 20 } : {}),
		active: source.active !== false,
		frequency,
		...(frequency === 'cooldown-rounds'
			? { cooldownRounds: Math.max(1, nonNegativeInt(source.cooldownRounds) || 1) }
			: {}),
	};
}

function normalizeEncounter(raw, index, report) {
	const source = isRecord(raw) ? raw : {};
	const id = hasText(source.id) ? source.id.trim() : `encounter-${index + 1}`;
	const placeholderActions = [];
	const participants = Array.isArray(source.participants)
		? source.participants.flatMap((rawParticipant, participantIndex) => {
				const item = isRecord(rawParticipant) ? rawParticipant : {};
				const sheet = normalizeSheetData(item.sheet, report, `Creature ${participantIndex + 1}`);
				const rawInitiative = finiteNumber(item.initiative);
				// The pre-final V2 was produced from V1 null initiatives as zeroes.
				const initiative = rawInitiative === 0 ? null : rawInitiative;
				if (rawInitiative === 0) report.initiativesConvertedToNull += 1;
				const participant = {
					id: hasText(item.id) ? item.id.trim() : `${id}:participant:${participantIndex + 1}`,
					...(hasText(item.sourceSheetId) ? { sourceSheetId: item.sourceSheetId.trim() } : {}),
					name: hasText(item.name) ? item.name.trim() : sheet.name,
					category: category(item.category),
					...(item.side === 'player' || item.side === 'ally' || item.side === 'enemy' || item.side === 'neutral'
						? { side: item.side }
						: {}),
					initiative,
					sheet,
					...(hasText(item.notes) ? { notes: item.notes.trim() } : {}),
				};
				if (isLegacyLairPlaceholder(participant)) {
					placeholderActions.push({
						id: participant.id,
						name: 'Lair Action',
						initiative: 20,
						active: true,
						frequency: 'every-round',
					});
					report.fakeLairActionsConverted.push({ encounterId: id, participantId: participant.id });
					return [];
				}
				return [participant];
			})
		: [];
	return {
		schemaVersion: 1,
		type: 'dnd-dm-helper-encounter',
		id,
		title: hasText(source.title) ? source.title.trim() : 'Untitled Encounter',
		createdAt: finiteNumber(source.createdAt) ?? 0,
		updatedAt: finiteNumber(source.updatedAt) ?? finiteNumber(source.createdAt) ?? 0,
		...(hasText(source.description) ? { description: source.description.trim() } : {}),
		tags: Array.isArray(source.tags) ? source.tags.filter(hasText).map((tag) => tag.trim()) : [],
		...(hasText(source.notes) ? { notes: source.notes.trim() } : {}),
		participants,
		lairActions: [
			...(Array.isArray(source.lairActions) ? source.lairActions.map(normalizeLairAction) : []),
			...placeholderActions,
		],
		traps: Array.isArray(source.traps) ? source.traps.map(normalizeTrap) : [],
	};
}

function normalizeBattleCombatant(raw, sourceParticipants, report) {
	const combatant = clone(raw);
	const sourceParticipant = hasText(combatant.sourceParticipantId)
		? sourceParticipants.get(combatant.sourceParticipantId)
		: undefined;
	const rawArmorClass = combatant.armorClass;
	combatant.armorClass = normalizeArmorClass(rawArmorClass, report, combatant.name);
	if (rawArmorClass === 0 && sourceParticipant?.sheet.armorClass === null) {
		combatant.armorClass = null;
		report.armorClassNormalized.battleNullFromKnownBlank += 1;
	}
	return combatant;
}

function normalizeBattle(raw, sourceParticipants, report) {
	const battle = clone(raw);
	for (const field of ['combatants', 'pendingCombatants']) {
		if (Array.isArray(battle[field])) {
			battle[field] = battle[field].map((combatant) =>
				normalizeBattleCombatant(combatant, sourceParticipants, report),
			);
		}
	}
	if (Array.isArray(battle.turnSnapshots)) {
		battle.turnSnapshots = battle.turnSnapshots.map((snapshot) => {
			if (!isRecord(snapshot) || !isRecord(snapshot.state)) return snapshot;
			const state = clone(snapshot.state);
			for (const field of ['combatants', 'pendingCombatants']) {
				if (Array.isArray(state[field])) {
					state[field] = state[field].map((combatant) =>
						normalizeBattleCombatant(combatant, sourceParticipants, report),
					);
				}
			}
			return { ...snapshot, state };
		});
	}
	return battle;
}

function readRawJson(data, key, fallback, report) {
	const raw = data.rawLocalStorage?.[key];
	if (typeof raw !== 'string') return fallback;
	try {
		return JSON.parse(raw);
	} catch {
		report.warnings.push(`Could not parse rawLocalStorage ${key}.`);
		return fallback;
	}
}

export function sanitizeBackupV2(input) {
	if (!isRecord(input) || input.app !== 'dnd-dm-helper' || input.type !== 'campaign-backup') {
		throw new Error('Backup app/type is invalid.');
	}
	if (input.schemaVersion !== 2) throw new Error('Sanitization only accepts schemaVersion 2 backups.');
	if (!isRecord(input.data)) throw new Error('Backup data must be an object.');
	if (!Array.isArray(input.data.encounters) || !Array.isArray(input.data.homebrewSheets)) {
		throw new Error('Backup requires encounters and homebrewSheets arrays.');
	}
	if (!Array.isArray(input.data.battleEncounters)) throw new Error('Backup requires battleEncounters array.');

	const report = createReport(input);
	const sheets = input.data.homebrewSheets.map((sheet, index) => normalizeSheet(sheet, index, report));
	const encounters = input.data.encounters.map((encounter, index) =>
		normalizeEncounter(encounter, index, report),
	);
	const sheetsByName = new Map();
	for (const sheet of sheets) {
		const key = canonicalName(sheet.data.name);
		sheetsByName.set(key, [...(sheetsByName.get(key) ?? []), sheet]);
	}
	const sourceParticipants = new Map();
	for (const encounter of encounters) {
		for (const participant of encounter.participants) {
			if (!participant.sourceSheetId) {
				const matches = sheetsByName.get(canonicalName(participant.name)) ?? [];
				if (matches.length === 1) {
					participant.sourceSheetId = matches[0].id;
					report.sourceSheetIdsRecovered.push({
						encounterId: encounter.id,
						participantId: participant.id,
						sheetId: matches[0].id,
					});
					if (participant.category !== matches[0].category) {
						report.categoriesCorrected.push({
							participantId: participant.id,
							from: participant.category,
							to: matches[0].category,
						});
						participant.category = matches[0].category;
					}
				} else if (matches.length > 1) {
					report.ambiguousParticipants.push({ encounterId: encounter.id, participantId: participant.id });
				} else {
					report.unlinkedParticipants.push({ encounterId: encounter.id, participantId: participant.id });
				}
			}
			sourceParticipants.set(participant.id, participant);
		}
	}
	const battles = input.data.battleEncounters.map((battle) =>
		normalizeBattle(battle, sourceParticipants, report),
	);
	const data = clone(input.data);
	const homebrew =
		data.fiveEToolsHomebrew ?? readRawJson(data, STORAGE_KEYS.fiveEToolsHomebrew, null, report);
	const homebrewBackups =
		data.fiveEToolsHomebrewBackups ??
		readRawJson(data, STORAGE_KEYS.fiveEToolsHomebrewBackups, [], report);
	const compositionPackages =
		data.fiveEToolsHomebrewCompositionPackages ??
		readRawJson(data, STORAGE_KEYS.fiveEToolsHomebrewCompositionPackages, [], report);
	for (const key of Object.keys(data.rawLocalStorage ?? {})) {
		report.rawLocalStorageRemoved.push(key);
	}
	data.encounters = encounters;
	data.homebrewSheets = sheets;
	data.battleEncounters = battles;
	data.fiveEToolsHomebrew = isRecord(homebrew) ? homebrew : null;
	data.fiveEToolsHomebrewBackups = Array.isArray(homebrewBackups) ? homebrewBackups : [];
	data.fiveEToolsHomebrewCompositionPackages = Array.isArray(compositionPackages)
		? compositionPackages
		: [];
	data.rawLocalStorage = {};
	const backup = { ...clone(input), schemaVersion: 2, data };
	report.output.encounters = encounters.length;
	report.output.participants = encounters.reduce((total, encounter) => total + encounter.participants.length, 0);
	report.output.sheets = sheets.length;
	report.output.battles = battles.length;
	report.output.bytes = Buffer.byteLength(JSON.stringify(backup));
	return { backup, report };
}

async function pathExists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export async function sanitizeFile(inputPath, outputPath, { force = false } = {}) {
	const input = resolve(inputPath);
	const output = resolve(outputPath);
	if (input === output) throw new Error('Refusing to overwrite the V2 input file; choose a different output path.');
	if (!force && (await pathExists(output))) throw new Error(`Output already exists: ${output}.`);
	const raw = await readFile(input, 'utf8');
	const parsed = JSON.parse(raw);
	const result = sanitizeBackupV2(parsed);
	const serialized = `${JSON.stringify(result.backup, null, 2)}\n`;
	result.report.input.bytes = Buffer.byteLength(raw);
	result.report.output.bytes = Buffer.byteLength(serialized);
	await writeFile(output, serialized, 'utf8');
	return result;
}

async function main(argv) {
	const force = argv.includes('--force');
	const positional = argv.filter((argument) => argument !== '--force');
	if (positional.length !== 2) {
		throw new Error('Usage: node scripts/sanitize-data-model-v2.mjs <input-v2.json> <output-v2.json> [--force]');
	}
	const { report } = await sanitizeFile(positional[0], positional[1], { force });
	console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main(process.argv.slice(2)).catch((error) => {
		console.error(error instanceof Error ? error.message : 'Sanitization failed.');
		process.exitCode = 1;
	});
}
