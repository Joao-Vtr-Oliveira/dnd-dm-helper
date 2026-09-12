import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function validateConfig(config, field) {
	assert(Array.isArray(config), `${field} must be an array.`);
	for (const item of config) {
		assert(
			isRecord(item) && hasText(item.id) && hasText(item.name),
			`${field} contains an invalid item.`,
		);
		assert(!('currentCooldownRounds' in item), `${field} must not retain currentCooldownRounds.`);
		assert(!('lastTriggeredAtRound' in item), `${field} must not retain lastTriggeredAtRound.`);
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

function validateCombatant(combatant, field) {
	assert(isRecord(combatant), `${field} must be an object.`);
	assert(!('sourceCreatureId' in combatant), `${field} must not retain sourceCreatureId.`);
	assert(!('sheetFeatures' in combatant), `${field} must not retain sheetFeatures.`);
	validateSpells(combatant.spells, `${field}.spells`);
	assert(Array.isArray(combatant.features), `${field}.features must be an array.`);
}

function validateBattle(battle, field) {
	assert(isRecord(battle), `${field} must be an object.`);
	for (const collection of ['combatants', 'pendingCombatants']) {
		assert(Array.isArray(battle[collection]), `${field}.${collection} must be an array.`);
		battle[collection].forEach((combatant, index) =>
			validateCombatant(combatant, `${field}.${collection}[${index}]`),
		);
	}
	validateConfig(battle.lairActions, `${field}.lairActions`);
	validateConfig(battle.traps, `${field}.traps`);
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
	assert(
		hasText(input.exportedAt) && !Number.isNaN(Date.parse(input.exportedAt)),
		'Backup exportedAt must be an ISO date string.',
	);
	assert(isRecord(input.data), 'Backup data must be an object.');
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
	for (const [index, encounter] of input.data.encounters.entries()) {
		const field = `data.encounters[${index}]`;
		assert(isRecord(encounter), `${field} must be an object.`);
		assert(
			encounter.schemaVersion === 1 && encounter.type === 'dnd-dm-helper-encounter',
			`${field} has an invalid encounter schema.`,
		);
		assert(hasText(encounter.id) && hasText(encounter.title), `${field} must have id and title.`);
		assert(
			Array.isArray(encounter.tags) && Array.isArray(encounter.participants),
			`${field} has invalid collections.`,
		);
		validateConfig(encounter.lairActions, `${field}.lairActions`);
		validateConfig(encounter.traps, `${field}.traps`);
		encounter.participants.forEach((participant, participantIndex) => {
			const participantField = `${field}.participants[${participantIndex}]`;
			assert(
				isRecord(participant) && hasText(participant.id) && hasText(participant.name),
				`${participantField} is invalid.`,
			);
			assert(isRecord(participant.sheet), `${participantField}.sheet must be an object.`);
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
