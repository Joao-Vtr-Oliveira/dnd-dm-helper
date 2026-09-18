import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const isFiniteNumberOrNull = (value) => value === null || (typeof value === 'number' && Number.isFinite(value));
const categories = new Set(['monster', 'npc', 'pc', 'other']);
const locationScopes = new Set(['empire', 'state', 'settlement']);
const locationRelations = new Set(['base', 'habitat', 'occurrence', 'operation']);
const organizationRelations = new Set(['member', 'leader', 'institution', 'trained_by', 'affiliated']);
const characterClasses = new Set([
	'artificer', 'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
	'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
]);

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function validateConfig(config, field, { runtime = false } = {}) {
	assert(Array.isArray(config), `${field} must be an array.`);
	const ids = new Set();
	for (const item of config) {
		assert(
			isRecord(item) && hasText(item.id) && hasText(item.name),
			`${field} contains an invalid item.`,
		);
		if (!runtime) {
			assert(!('currentCooldownRounds' in item), `${field} must not retain currentCooldownRounds.`);
			assert(!('lastTriggeredAtRound' in item), `${field} must not retain lastTriggeredAtRound.`);
		}
		assert(!ids.has(item.id), `${field} contains duplicate id ${item.id}.`);
		ids.add(item.id);
	}
}

function validateSpells(spells, field) {
	assert(Array.isArray(spells), `${field} must be an array.`);
	for (const spell of spells) {
		assert(
			isRecord(spell) && hasText(spell.id) && hasText(spell.name),
			`${field} contains an invalid spell.`,
		);
	}
}

function validateSheetContext(sheet, field) {
	assert(sheet.archived === undefined || typeof sheet.archived === 'boolean', `${field}.archived is invalid.`);
	assert(sheet.generic === undefined || typeof sheet.generic === 'boolean', `${field}.generic is invalid.`);
	if (sheet.locationRefs !== undefined) {
		assert(Array.isArray(sheet.locationRefs), `${field}.locationRefs must be an array.`);
		assert(!(sheet.generic === true && sheet.locationRefs.length > 0), `${field} cannot be generic and located.`);
		for (const [index, ref] of sheet.locationRefs.entries()) {
			assert(
				isRecord(ref) && hasText(ref.scopeId) && locationScopes.has(ref.scopeType) && locationRelations.has(ref.relation),
				`${field}.locationRefs[${index}] is invalid.`,
			);
		}
	}
	if (sheet.organizationRefs !== undefined) {
		assert(Array.isArray(sheet.organizationRefs), `${field}.organizationRefs must be an array.`);
		for (const [index, ref] of sheet.organizationRefs.entries()) {
			assert(
				isRecord(ref) && hasText(ref.organizationId) && organizationRelations.has(ref.relation),
				`${field}.organizationRefs[${index}] is invalid.`,
			);
		}
	}
	if (sheet.classes !== undefined) {
		assert(
			(sheet.category === 'npc' || sheet.category === 'pc') &&
			Array.isArray(sheet.classes) &&
			sheet.classes.every((value) => characterClasses.has(value)),
			`${field}.classes is invalid.`,
		);
	}
}

function validateEncounterContext(encounter, field) {
	assert(
		encounter.archived === undefined || typeof encounter.archived === 'boolean',
		`${field}.archived is invalid.`,
	);
	if (encounter.locationRefs !== undefined) {
		assert(Array.isArray(encounter.locationRefs), `${field}.locationRefs must be an array.`);
		for (const [index, ref] of encounter.locationRefs.entries()) {
			assert(
				isRecord(ref) && hasText(ref.scopeId) && locationScopes.has(ref.scopeType) && locationRelations.has(ref.relation),
				`${field}.locationRefs[${index}] is invalid.`,
			);
		}
	}
	if (encounter.organizationRefs !== undefined) {
		assert(Array.isArray(encounter.organizationRefs), `${field}.organizationRefs must be an array.`);
		for (const [index, ref] of encounter.organizationRefs.entries()) {
			assert(
				isRecord(ref) && hasText(ref.organizationId) && organizationRelations.has(ref.relation),
				`${field}.organizationRefs[${index}] is invalid.`,
			);
		}
	}
}

function validateCombatant(combatant, field) {
	assert(isRecord(combatant), `${field} must be an object.`);
	assert(!('sourceCreatureId' in combatant), `${field} must not retain sourceCreatureId.`);
	assert(!('sheetFeatures' in combatant), `${field} must not retain sheetFeatures.`);
	validateSpells(combatant.spells, `${field}.spells`);
	assert(Array.isArray(combatant.features), `${field}.features must be an array.`);
	assert(isFiniteNumberOrNull(combatant.armorClass), `${field}.armorClass must be number|null.`);
	assert(typeof combatant.initiative === 'number' && Number.isFinite(combatant.initiative), `${field}.initiative must be a number.`);
	assert(
		combatant.sourceParticipantId === undefined || hasText(combatant.sourceParticipantId),
		`${field}.sourceParticipantId must be optional non-empty text.`,
	);
}

function validateBattle(battle, field) {
	assert(isRecord(battle), `${field} must be an object.`);
	assert(battle.sourceEncounterId === undefined || hasText(battle.sourceEncounterId), `${field}.sourceEncounterId is invalid.`);
	const combatantIds = new Set();
	for (const collection of ['combatants', 'pendingCombatants']) {
		assert(Array.isArray(battle[collection]), `${field}.${collection} must be an array.`);
		battle[collection].forEach((combatant, index) => {
			validateCombatant(combatant, `${field}.${collection}[${index}]`);
			assert(!combatantIds.has(combatant.id), `${field} contains duplicate combatant id ${combatant.id}.`);
			combatantIds.add(combatant.id);
		});
	}
	validateConfig(battle.lairActions, `${field}.lairActions`, { runtime: true });
	validateConfig(battle.traps, `${field}.traps`, { runtime: true });
	if (battle.turnSnapshots !== undefined) {
		assert(Array.isArray(battle.turnSnapshots), `${field}.turnSnapshots must be an array.`);
		battle.turnSnapshots.forEach((snapshot, index) => {
			if (!isRecord(snapshot) || !isRecord(snapshot.state)) return;
			validateBattle(snapshot.state, `${field}.turnSnapshots[${index}].state`);
		});
	}
}

export function validateBackupV2(input) {
	assert(isRecord(input), 'Backup must be an object.');
	assert(input.app === 'dnd-dm-helper', 'Backup app must be dnd-dm-helper.');
	assert(input.type === 'campaign-backup', 'Backup type must be campaign-backup.');
	assert(input.schemaVersion === 2, 'Backup schemaVersion must be 2.');
	assert(isRecord(input.data), 'Backup data must be an object.');
	assert(
		input.data.fiveEToolsHomebrew === null || isRecord(input.data.fiveEToolsHomebrew),
		'Backup data.fiveEToolsHomebrew must be object|null.',
	);
	assert(
		Array.isArray(input.data.fiveEToolsHomebrewBackups),
		'Backup data.fiveEToolsHomebrewBackups must be an array.',
	);
	assert(
		hasText(input.exportedAt) && !Number.isNaN(Date.parse(input.exportedAt)),
		'Backup exportedAt must be an ISO date string.',
	);
	assert(Array.isArray(input.data.encounters), 'Backup data.encounters must be an array.');
	assert(Array.isArray(input.data.homebrewSheets), 'Backup data.homebrewSheets must be an array.');
	assert(
		Array.isArray(input.data.fiveEToolsHomebrewCompositionPackages),
		'Backup data.fiveEToolsHomebrewCompositionPackages must be an array.',
	);
	assert(
		Array.isArray(input.data.battleEncounters),
		'Backup data.battleEncounters must be an array.',
	);
	assert(isRecord(input.data.rawLocalStorage), 'Backup data.rawLocalStorage must be an object.');
	assert(
		Object.keys(input.data.rawLocalStorage).length === 0,
		'Backup data.rawLocalStorage must not contain formal or unknown project data.',
	);
	const encounterIds = new Set();
	for (const [index, encounter] of input.data.encounters.entries()) {
		const field = `data.encounters[${index}]`;
		assert(isRecord(encounter), `${field} must be an object.`);
		assert(
			encounter.schemaVersion === 1 && encounter.type === 'dnd-dm-helper-encounter',
			`${field} has an invalid encounter schema.`,
		);
		assert(hasText(encounter.id) && hasText(encounter.title), `${field} must have id and title.`);
		assert(!encounterIds.has(encounter.id), `${field} has duplicate id ${encounter.id}.`);
		encounterIds.add(encounter.id);
		assert(
			Array.isArray(encounter.tags) && Array.isArray(encounter.participants),
			`${field} has invalid collections.`,
		);
		validateEncounterContext(encounter, field);
		validateConfig(encounter.lairActions, `${field}.lairActions`);
		validateConfig(encounter.traps, `${field}.traps`);
		const participantIds = new Set();
		encounter.participants.forEach((participant, participantIndex) => {
			const participantField = `${field}.participants[${participantIndex}]`;
			assert(
				isRecord(participant) && hasText(participant.id) && hasText(participant.name),
				`${participantField} is invalid.`,
			);
			assert(isRecord(participant.sheet), `${participantField}.sheet must be an object.`);
			assert(!participantIds.has(participant.id), `${participantField} has duplicate id.`);
			participantIds.add(participant.id);
			assert(categories.has(participant.category), `${participantField}.category is invalid.`);
			assert(isFiniteNumberOrNull(participant.initiative), `${participantField}.initiative must be number|null.`);
			assert(isFiniteNumberOrNull(participant.sheet.armorClass), `${participantField}.sheet.armorClass must be number|null.`);
			assert(
				participant.sourceSheetId === undefined || hasText(participant.sourceSheetId),
				`${participantField}.sourceSheetId must be optional non-empty text.`,
			);
			validateSpells(participant.sheet.spells, `${participantField}.sheet.spells`);
			assert(
				Array.isArray(participant.sheet.spellSlots),
				`${participantField}.sheet.spellSlots must be an array.`,
			);
			assert(
				Array.isArray(participant.sheet.specialAbilities),
				`${participantField}.sheet.specialAbilities must be an array.`,
			);
			assert(
				Array.isArray(participant.sheet.features),
				`${participantField}.sheet.features must be an array.`,
			);
		});
	}
	for (const [index, sheet] of input.data.homebrewSheets.entries()) {
		const field = `data.homebrewSheets[${index}]`;
		assert(
			isRecord(sheet) && hasText(sheet.id) && hasText(sheet.externalId) && hasText(sheet.title),
			`${field} is invalid.`,
		);
		assert(isRecord(sheet.data), `${field}.data must be an object.`);
		assert(categories.has(sheet.category), `${field}.category is invalid.`);
		validateSheetContext(sheet, field);
		assert(isFiniteNumberOrNull(sheet.data.armorClass), `${field}.data.armorClass must be number|null.`);
		validateSpells(sheet.data.spells, `${field}.data.spells`);
	}
	input.data.battleEncounters.forEach((battle, index) =>
		validateBattle(battle, `data.battleEncounters[${index}]`),
	);
	return input;
}

async function main(argv) {
	if (argv.length !== 1)
		throw new Error('Usage: node scripts/validate-backup-v2.mjs <backup-v2.json>');
	const raw = JSON.parse(await readFile(resolve(argv[0]), 'utf8'));
	validateBackupV2(raw);
	console.log('Backup V2 is valid.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main(process.argv.slice(2)).catch((error) => {
		console.error(error instanceof Error ? error.message : 'Validation failed.');
		process.exitCode = 1;
	});
}
