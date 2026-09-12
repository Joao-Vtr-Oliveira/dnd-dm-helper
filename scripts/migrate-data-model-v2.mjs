import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const V1_ENCOUNTERS_KEY = 'dnd-dm-helper.encounters.v1';
const V2_ENCOUNTERS_KEY = 'dnd-dm-helper.encounters.v2';
const V1_SHEETS_KEY = 'dnd-dm-helper.sheets.v1';
const V2_SHEETS_KEY = 'dnd-dm-helper.sheets.v2';
const BATTLE_ENCOUNTERS_KEY = 'dnd-dm-helper.battle-encounters.v1';
const COMPOSITION_PACKAGES_KEY = 'dnd-dm-helper.5etools-homebrew.composition-packages.v1';

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const clone = (value) => structuredClone(value);
const numberOr = (value, fallback = 0) => {
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : fallback;
};
const nonNegativeInt = (value, fallback = 0) => Math.max(0, Math.floor(numberOr(value, fallback)));

function requiredText(value, field) {
	if (!hasText(value)) throw new Error(`${field} must be a non-empty string.`);
	return value.trim();
}

function legacyCategory(value) {
	if (value === 'pc' || value === 'PC' || value === 'player') return 'pc';
	if (value === 'npc' || value === 'ally' || value === 'pet') return 'npc';
	if (value === 'other' || value === 'item') return 'other';
	return 'monster';
}

function increment(report, field, amount = 1) {
	report.droppedFields[field] = (report.droppedFields[field] ?? 0) + amount;
}

function transformed(report, field, amount = 1) {
	report.transformedFields[field] = (report.transformedFields[field] ?? 0) + amount;
}

function warn(report, message) {
	report.warnings.push(message);
}

function optionalText(value) {
	return hasText(value) ? value.trim() : undefined;
}

function optionalStringArray(value) {
	if (!Array.isArray(value)) return [];
	return value.filter(hasText).map((item) => item.trim());
}

function legacyNoteText(notes) {
	if (!Array.isArray(notes)) return undefined;
	const text = notes
		.map((note) =>
			isRecord(note) ? optionalText(note.text) : typeof note === 'string' ? note.trim() : '',
		)
		.filter(Boolean)
		.join('\n');
	return text || undefined;
}

function spellLevel(value) {
	if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 9)
		return value;
	if (typeof value !== 'string') return undefined;
	const match = value.match(/^([1-9])(?:st|nd|rd|th)?$/i);
	return match ? Number(match[1]) : undefined;
}

export function migrateSpells(value, report) {
	const entries = Array.isArray(value)
		? value.map((item, index) => [String(index), item])
		: isRecord(value)
			? Object.entries(value)
			: [];
	const spells = [];
	for (const [key, raw] of entries) {
		if (!isRecord(raw)) {
			increment(report, 'invalidSpell');
			continue;
		}
		const name = optionalText(raw.name) ?? optionalText(raw.label);
		if (!name) {
			increment(report, 'invalidSpell');
			continue;
		}
		const spell = { id: optionalText(raw.id) ?? key ?? `spell-${spells.length + 1}`, name };
		const source = optionalText(raw.source);
		const level = spellLevel(raw.level);
		const uses = raw.uses ?? raw.total;
		if (source) spell.source = source;
		if (level !== undefined) spell.level = level;
		if (uses != null) spell.uses = nonNegativeInt(uses);
		spells.push(spell);
	}
	return spells;
}

function migrateSpellSlots(totalSlots, report) {
	if (!isRecord(totalSlots)) return [];
	const slots = [];
	for (const [key, value] of Object.entries(totalSlots)) {
		const level = spellLevel(key);
		if (level === undefined) {
			increment(report, 'invalidSpellSlot');
			continue;
		}
		slots.push({ level, max: nonNegativeInt(value) });
	}
	return slots.sort((left, right) => left.level - right.level);
}

function recoveryType(ability) {
	if (
		[
			'manual',
			'turn-cooldown',
			'round-cooldown',
			'uses-per-day',
			'short-rest',
			'long-rest',
			'dice-recharge',
		].includes(ability.recoveryType)
	) {
		return ability.recoveryType;
	}
	if (ability.rechargeType === 'turns') return 'turn-cooldown';
	if (ability.rechargeType === 'rounds') return 'round-cooldown';
	if (ability.rechargeType === 'dice') return 'dice-recharge';
	if (ability.rechargeType === 'per-day') return 'uses-per-day';
	if (ability.rechargeType === 'short-rest') return 'short-rest';
	if (ability.rechargeType === 'long-rest') return 'long-rest';
	return 'manual';
}

function migrateAbilities(value, report, { preserveRuntime }) {
	if (!Array.isArray(value)) return [];
	return value.flatMap((raw, index) => {
		if (!isRecord(raw) || !hasText(raw.name)) {
			increment(report, 'invalidAbility');
			return [];
		}
		const ability = {};
		for (const [key, item] of Object.entries(raw)) {
			if (key !== 'rechargeType') ability[key] = clone(item);
		}
		ability.id = optionalText(raw.id) ?? `ability-${index + 1}`;
		ability.name = raw.name.trim();
		ability.recoveryType = recoveryType(raw);
		if (raw.rechargeType !== undefined) transformed(report, 'rechargeType->recoveryType');
		if (!preserveRuntime) {
			for (const field of [
				'usedCount',
				'currentCooldownTurns',
				'currentCooldownRounds',
				'isAvailable',
				'lastUsedAtRound',
				'lastUsedAtTurnIndex',
				'lastUsedAt',
				'lastRechargeRoll',
				'lastRechargeAttemptAtRound',
			]) {
				if (field in ability) {
					delete ability[field];
					increment(report, `ability.${field}`);
				}
			}
		}
		return [ability];
	});
}

function migrateFeatures(value, report) {
	if (!Array.isArray(value)) return [];
	return value.flatMap((raw, index) => {
		if (!isRecord(raw) || !hasText(raw.name)) {
			increment(report, 'invalidFeature');
			return [];
		}
		return [
			{
				id: optionalText(raw.id) ?? `feature-${index + 1}`,
				name: raw.name.trim(),
				...(optionalText(raw.description) ? { description: raw.description.trim() } : {}),
				kind: ['trait', 'action', 'reaction', 'legendary', 'spellcasting', 'note'].includes(
					raw.kind,
				)
					? raw.kind
					: 'note',
			},
		];
	});
}

function fiveEToolsIdentity(rawFiveETools) {
	if (!isRecord(rawFiveETools) || !hasText(rawFiveETools.name) || !hasText(rawFiveETools.source)) {
		return undefined;
	}
	return { name: rawFiveETools.name.trim(), source: rawFiveETools.source.trim() };
}

export function migrateCreatureSheet(raw, report, fallbackName = 'Creature') {
	const creature = isRecord(raw) ? raw : {};
	const rawFiveETools = isRecord(creature.rawFiveETools)
		? clone(creature.rawFiveETools)
		: undefined;
	const sheet = {
		name: optionalText(creature.name) ?? fallbackName,
		armorClass: creature.armorClass ?? '',
		maxHp: nonNegativeInt(creature.maxHealthPoints ?? creature.healthPoints),
		spellSlots: migrateSpellSlots(creature.totalSpellSlots, report),
		spells: migrateSpells(creature.spells, report),
		specialAbilities: migrateAbilities(creature.specialAbilities, report, {
			preserveRuntime: false,
		}),
		features: migrateFeatures(creature.sheetFeatures ?? creature.features, report),
	};
	if (rawFiveETools) sheet.rawFiveETools = rawFiveETools;
	const identity = fiveEToolsIdentity(rawFiveETools);
	if (identity) sheet.fiveEToolsIdentity = identity;
	return sheet;
}

function migrateConfig(value, report, kind) {
	if (!Array.isArray(value)) return [];
	return value.flatMap((raw, index) => {
		if (!isRecord(raw) || !hasText(raw.name)) {
			increment(report, `invalid${kind}`);
			return [];
		}
		const config = clone(raw);
		for (const field of ['currentCooldownRounds', 'lastTriggeredAtRound']) {
			if (field in config) {
				delete config[field];
				increment(report, `${kind}.${field}`);
			}
		}
		config.id = optionalText(raw.id) ?? `${kind.toLowerCase()}-${index + 1}`;
		config.name = raw.name.trim();
		config.active = raw.active !== false;
		return [config];
	});
}

function participantId(encounterId, creatureId, index) {
	return `${encounterId}:participant:${String(creatureId ?? index)}`;
}

function migrateEncounter(raw, report) {
	if (!isRecord(raw) || !hasText(raw.id)) {
		warn(report, `Dropped encounter with no usable id.`);
		increment(report, 'invalidEncounter');
		return null;
	}
	const legacyData = isRecord(raw.data) ? raw.data : {};
	const creatureIdMap = new Map();
	const seenParticipantIds = new Set();
	const participants = Array.isArray(legacyData.creatures)
		? legacyData.creatures.flatMap((creature, index) => {
				if (!isRecord(creature)) {
					increment(report, 'invalidParticipant');
					return [];
				}
				let id = participantId(raw.id, creature.id, index);
				if (seenParticipantIds.has(id)) id = `${id}:${index + 1}`;
				seenParticipantIds.add(id);
				if (typeof creature.id === 'number' && !creatureIdMap.has(creature.id)) {
					creatureIdMap.set(creature.id, id);
				} else if (typeof creature.id === 'number') {
					warn(report, `Encounter ${raw.id} has duplicate legacy creature id ${creature.id}.`);
				}
				const participant = {
					id,
					...(optionalText(creature.sourceSheetId)
						? { sourceSheetId: creature.sourceSheetId.trim() }
						: {}),
					name: optionalText(creature.name) ?? `Creature ${index + 1}`,
					category: legacyCategory(creature.category),
					...(Number.isFinite(Number(creature.initiative))
						? { initiative: Number(creature.initiative) }
						: {}),
					sheet: migrateCreatureSheet(
						creature,
						report,
						optionalText(creature.name) ?? `Creature ${index + 1}`,
					),
					...(legacyNoteText(creature.notes) ? { notes: legacyNoteText(creature.notes) } : {}),
				};
				if (
					creature.healthPoints !== undefined &&
					creature.healthPoints !== creature.maxHealthPoints
				) {
					increment(report, 'participant.healthPoints');
				}
				for (const field of [
					'temporaryHealthPoints',
					'conditions',
					'alive',
					'shared',
					'hitPointsShared',
				]) {
					if (creature[field] !== undefined) increment(report, `participant.${field}`);
				}
				if (creature.usedSpellSlots != null) increment(report, 'participant.usedSpellSlots');
				return [participant];
			})
		: [];
	if (!Array.isArray(legacyData.creatures))
		warn(report, `Encounter ${raw.id} has no creature array.`);
	for (const field of [
		'creatureIdCount',
		'round',
		'battleCreated',
		'shareEnabled',
		'battleTrackerVersion',
		'sharedTimestamp',
		'loaded',
	]) {
		if (legacyData[field] !== undefined) increment(report, `encounterRuntime.${field}`);
	}
	const encounter = {
		schemaVersion: 1,
		type: 'dnd-dm-helper-encounter',
		id: raw.id.trim(),
		title: optionalText(raw.title) ?? 'Untitled Encounter',
		createdAt: raw.createdAt ?? 0,
		updatedAt: raw.updatedAt ?? raw.createdAt ?? 0,
		...(optionalText(raw.description) ? { description: raw.description.trim() } : {}),
		tags: optionalStringArray(raw.tags),
		...(optionalText(raw.notes) ? { notes: raw.notes.trim() } : {}),
		participants,
		lairActions: migrateConfig(legacyData.lairActions, report, 'LairAction'),
		traps: migrateConfig(legacyData.traps, report, 'Trap'),
	};
	return { encounter, creatureIdMap };
}

function migrateCombatant(raw, participantIds, report, context) {
	if (!isRecord(raw)) {
		increment(report, 'invalidCombatant');
		return raw;
	}
	const combatant = clone(raw);
	if (typeof raw.sourceCreatureId === 'number') {
		const sourceParticipantId = participantIds?.get(raw.sourceCreatureId);
		delete combatant.sourceCreatureId;
		if (sourceParticipantId) combatant.sourceParticipantId = sourceParticipantId;
		else
			warn(
				report,
				`${context} could not match sourceCreatureId ${raw.sourceCreatureId} to a participant.`,
			);
	}
	combatant.spells = migrateSpells(raw.spells, report);
	combatant.features = migrateFeatures(raw.sheetFeatures ?? raw.features, report);
	if ('sheetFeatures' in combatant) {
		delete combatant.sheetFeatures;
		transformed(report, 'combatant.sheetFeatures->features');
	}
	combatant.specialAbilities = migrateAbilities(raw.specialAbilities, report, {
		preserveRuntime: true,
	});
	return combatant;
}

function migrateBattle(raw, participantMaps, report, context = 'Battle') {
	if (!isRecord(raw)) {
		increment(report, 'invalidBattle');
		warn(report, `Dropped malformed ${context.toLowerCase()}.`);
		return null;
	}
	const battle = clone(raw);
	const participantIds =
		typeof raw.sourceEncounterId === 'string'
			? participantMaps.get(raw.sourceEncounterId)
			: undefined;
	if (!participantIds && typeof raw.sourceEncounterId === 'string') {
		warn(
			report,
			`${context} ${raw.id ?? '(without id)'} references missing encounter ${raw.sourceEncounterId}.`,
		);
	}
	for (const field of ['combatants', 'pendingCombatants']) {
		if (Array.isArray(raw[field])) {
			battle[field] = raw[field].map((item) =>
				migrateCombatant(item, participantIds, report, context),
			);
		}
	}
	battle.lairActions = migrateConfig(raw.lairActions, report, 'LairAction');
	battle.traps = migrateConfig(raw.traps, report, 'Trap');
	if (Array.isArray(raw.turnSnapshots)) {
		battle.turnSnapshots = raw.turnSnapshots.map((snapshot) => {
			if (!isRecord(snapshot) || !isRecord(snapshot.state)) return clone(snapshot);
			const state = clone(snapshot.state);
			for (const field of ['combatants', 'pendingCombatants']) {
				if (Array.isArray(snapshot.state[field])) {
					state[field] = snapshot.state[field].map((item) =>
						migrateCombatant(item, participantIds, report, `${context} snapshot`),
					);
				}
			}
			state.lairActions = migrateConfig(snapshot.state.lairActions, report, 'LairAction');
			state.traps = migrateConfig(snapshot.state.traps, report, 'Trap');
			return { ...clone(snapshot), state };
		});
	}
	return battle;
}

function migrateSheet(raw, report) {
	if (!isRecord(raw) || !hasText(raw.id)) {
		increment(report, 'invalidHomebrewSheet');
		warn(report, 'Dropped homebrew sheet with no usable id.');
		return null;
	}
	const title = optionalText(raw.title) ?? optionalText(raw.data?.name) ?? 'Untitled Homebrew';
	return {
		id: raw.id.trim(),
		externalId: optionalText(raw.externalId) ?? raw.id.trim(),
		title,
		createdAt: raw.createdAt ?? 0,
		updatedAt: raw.updatedAt ?? raw.createdAt ?? 0,
		category: legacyCategory(raw.category ?? raw.data?.category),
		tags: optionalStringArray(raw.tags),
		source: optionalText(raw.source) ?? '',
		data: migrateCreatureSheet(raw.data, report, title),
	};
}

function compositionPackages(rawLocalStorage, directValue, report) {
	if (directValue !== undefined) return clone(directValue);
	const stored = rawLocalStorage?.[COMPOSITION_PACKAGES_KEY];
	if (typeof stored !== 'string') return [];
	try {
		return JSON.parse(stored);
	} catch {
		warn(report, 'Could not parse 5eTools composition packages from rawLocalStorage.');
		return [];
	}
}

function migrateRawStorage(rawStorage, encounters, sheets, battles, report) {
	const raw = isRecord(rawStorage) ? clone(rawStorage) : {};
	if (!isRecord(rawStorage))
		warn(report, 'rawLocalStorage was missing or invalid; replaced with an empty object.');
	const silentReport = {
		droppedFields: {},
		transformedFields: {},
		warnings: [],
	};
	let migratedRawEncounters = encounters;
	let migratedRawSheets = sheets;
	for (const [sourceKey, setValue] of [
		[V1_ENCOUNTERS_KEY, (value) => (migratedRawEncounters = value)],
		[V1_SHEETS_KEY, (value) => (migratedRawSheets = value)],
	]) {
		if (typeof raw[sourceKey] !== 'string') continue;
		try {
			const legacyEntries = JSON.parse(raw[sourceKey]);
			if (!Array.isArray(legacyEntries)) throw new Error('stored value is not an array');
			if (sourceKey === V1_ENCOUNTERS_KEY) {
				setValue(
					legacyEntries.flatMap((entry) => {
						const migrated = migrateEncounter(entry, silentReport);
						return migrated ? [migrated.encounter] : [];
					}),
				);
			} else {
				setValue(
					legacyEntries.flatMap((entry) => {
						const migrated = migrateSheet(entry, silentReport);
						return migrated ? [migrated] : [];
					}),
				);
			}
		} catch (error) {
			warn(report, `Could not migrate rawLocalStorage ${sourceKey}: ${error.message}.`);
		}
	}
	delete raw[V1_ENCOUNTERS_KEY];
	delete raw[V1_SHEETS_KEY];
	raw[V2_ENCOUNTERS_KEY] = JSON.stringify(migratedRawEncounters);
	raw[V2_SHEETS_KEY] = JSON.stringify(migratedRawSheets);
	raw[BATTLE_ENCOUNTERS_KEY] = JSON.stringify(battles);
	return raw;
}

export function validateLegacyBackupV1(input) {
	if (!isRecord(input)) throw new Error('Backup must be an object.');
	if (input.app !== 'dnd-dm-helper') throw new Error('Backup app must be dnd-dm-helper.');
	if (input.type !== 'campaign-backup') throw new Error('Backup type must be campaign-backup.');
	if (input.schemaVersion !== 1) throw new Error('Migration only accepts schemaVersion 1 backups.');
	if (!hasText(input.exportedAt) || Number.isNaN(Date.parse(input.exportedAt))) {
		throw new Error('Backup exportedAt must be an ISO date string.');
	}
	if (!isRecord(input.data)) throw new Error('Backup data must be an object.');
	for (const field of ['encounters', 'battleEncounters', 'homebrewSheets']) {
		if (!Array.isArray(input.data[field]))
			throw new Error(`Backup data.${field} must be an array.`);
	}
}

export function migrateBackupV1(input) {
	validateLegacyBackupV1(input);
	const report = {
		input: {
			encounters: input.data.encounters.length,
			battleEncounters: input.data.battleEncounters.length,
			homebrewSheets: input.data.homebrewSheets.length,
		},
		output: { encounters: 0, participants: 0, battleEncounters: 0, homebrewSheets: 0 },
		droppedFields: {},
		transformedFields: {},
		warnings: [],
	};
	const participantMaps = new Map();
	const encounters = input.data.encounters.flatMap((raw) => {
		const migrated = migrateEncounter(raw, report);
		if (!migrated) return [];
		participantMaps.set(migrated.encounter.id, migrated.creatureIdMap);
		return [migrated.encounter];
	});
	const homebrewSheets = input.data.homebrewSheets.flatMap((raw) => {
		const sheet = migrateSheet(raw, report);
		return sheet ? [sheet] : [];
	});
	const battleEncounters = input.data.battleEncounters.flatMap((raw) => {
		const battle = migrateBattle(raw, participantMaps, report);
		return battle ? [battle] : [];
	});
	const rawLocalStorage = migrateRawStorage(
		input.data.rawLocalStorage,
		encounters,
		homebrewSheets,
		battleEncounters,
		report,
	);
	const packages = compositionPackages(
		input.data.rawLocalStorage,
		input.data.fiveEToolsHomebrewCompositionPackages,
		report,
	);
	const data = {
		...clone(input.data),
		encounters,
		battleEncounters,
		homebrewSheets,
		rawLocalStorage,
	};
	data.fiveEToolsHomebrewCompositionPackages = Array.isArray(packages) ? packages : [];
	const backup = {
		app: 'dnd-dm-helper',
		type: 'campaign-backup',
		schemaVersion: 2,
		exportedAt: input.exportedAt,
		data,
	};
	report.output.encounters = encounters.length;
	report.output.participants = encounters.reduce(
		(count, encounter) => count + encounter.participants.length,
		0,
	);
	report.output.battleEncounters = battleEncounters.length;
	report.output.homebrewSheets = homebrewSheets.length;
	return { backup, report };
}

function formatSummary(report) {
	return JSON.stringify(report, null, 2);
}

async function pathExists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export async function migrateFile(inputPath, outputPath, { force = false } = {}) {
	const input = resolve(inputPath);
	const output = resolve(outputPath);
	if (input === output)
		throw new Error('Refusing to overwrite the v1 input file; choose a different output path.');
	if (!force && (await pathExists(output))) {
		throw new Error(`Output already exists: ${output}. Re-run with --force to replace it.`);
	}
	let parsed;
	try {
		parsed = JSON.parse(await readFile(input, 'utf8'));
	} catch (error) {
		throw new Error(`Could not read valid JSON from ${input}: ${error.message}`);
	}
	const result = migrateBackupV1(parsed);
	await writeFile(output, `${JSON.stringify(result.backup, null, 2)}\n`, 'utf8');
	return result;
}

async function main(argv) {
	const force = argv.includes('--force');
	const positional = argv.filter((argument) => argument !== '--force');
	if (positional.length !== 2) {
		throw new Error(
			'Usage: node scripts/migrate-data-model-v2.mjs <input-v1.json> <output-v2.json> [--force]',
		);
	}
	const { report } = await migrateFile(positional[0], positional[1], { force });
	console.log('Migration summary:');
	console.log(formatSummary(report));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main(process.argv.slice(2)).catch((error) => {
		console.error(error instanceof Error ? error.message : 'Migration failed.');
		process.exitCode = 1;
	});
}
