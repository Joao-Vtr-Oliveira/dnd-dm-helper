import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeBackupV2 } from './sanitize-data-model-v2.mjs';
import { validateBackupV2 } from './validate-backup-v2.mjs';

const sheet = (id, name, category = 'monster') => ({
	id, externalId: id, title: name, createdAt: 1, updatedAt: 1, category, tags: [], source: '',
	data: { name, armorClass: '15', maxHp: 10, spellSlots: [], spells: [], specialAbilities: [], features: [] },
});

test('preserves formal contextual metadata while sanitizing preparation', () => {
	const input = {
		app: 'dnd-dm-helper', type: 'campaign-backup', schemaVersion: 2, exportedAt: '2026-01-01T00:00:00.000Z',
		data: {
			encounters: [{
				schemaVersion: 1, type: 'dnd-dm-helper-encounter', id: 'enc-context', title: 'Context', createdAt: 1, updatedAt: 1,
				archived: true, locationRefs: [{ scopeType: 'settlement', scopeId: 'old-town', relation: 'occurrence' }],
				organizationRefs: [{ organizationId: 'guild', relation: 'affiliated' }], tags: [], traps: [], lairActions: [], participants: [],
			}],
			homebrewSheets: [{
				...sheet('sheet-context', 'Context NPC', 'npc'), generic: false, archived: true, classes: ['ranger'],
				locationRefs: [{ scopeType: 'state', scopeId: 'old-state', relation: 'base' }],
				organizationRefs: [{ organizationId: 'guild', relation: 'member' }],
			}],
			battleEncounters: [], calendar: null, campaignContext: null, settings: {},
			fiveEToolsHomebrew: null, fiveEToolsHomebrewBackups: [], fiveEToolsHomebrewCompositionPackages: [], rawLocalStorage: {},
		},
	};

	const { backup } = sanitizeBackupV2(input);
	validateBackupV2(backup);
	assert.deepEqual(backup.data.encounters[0].locationRefs, input.data.encounters[0].locationRefs);
	assert.deepEqual(backup.data.encounters[0].organizationRefs, input.data.encounters[0].organizationRefs);
	assert.deepEqual(backup.data.homebrewSheets[0].locationRefs, input.data.homebrewSheets[0].locationRefs);
	assert.deepEqual(backup.data.homebrewSheets[0].organizationRefs, input.data.homebrewSheets[0].organizationRefs);
	assert.deepEqual(backup.data.homebrewSheets[0].classes, ['ranger']);
});

test('rejects invalid encounter contextual metadata in the tracked-backup validator', () => {
	const input = {
		app: 'dnd-dm-helper', type: 'campaign-backup', schemaVersion: 2, exportedAt: '2026-01-01T00:00:00.000Z',
		data: {
			encounters: [{
				schemaVersion: 1, type: 'dnd-dm-helper-encounter', id: 'enc-invalid', title: 'Invalid', createdAt: 1, updatedAt: 1,
				tags: [], traps: [], lairActions: [], participants: [], locationRefs: [{ scopeType: 'poi', scopeId: 'x', relation: 'base' }],
			}],
			homebrewSheets: [], battleEncounters: [], calendar: null, campaignContext: null, settings: {},
			fiveEToolsHomebrew: null, fiveEToolsHomebrewBackups: [], fiveEToolsHomebrewCompositionPackages: [], rawLocalStorage: {},
		},
	};

	assert.throws(() => validateBackupV2(input), /locationRefs\[0\] is invalid/);
});

test('sanitizes V2 preparation without changing battle initiative', () => {
	const input = {
		app: 'dnd-dm-helper', type: 'campaign-backup', schemaVersion: 2, exportedAt: '2026-01-01T00:00:00.000Z',
		data: {
			encounters: [{
				schemaVersion: 1, type: 'dnd-dm-helper-encounter', id: 'enc', title: 'Encounter', createdAt: 1, updatedAt: 1, tags: [], traps: [], lairActions: [],
				participants: [
					{ id: 'linked', name: 'Vael', category: 'monster', initiative: 0, sheet: { name: 'Vael', armorClass: '', maxHp: 1, spellSlots: [], spells: [], specialAbilities: [], features: [] } },
					{ id: 'lair', name: 'LAIR ACTION', category: 'monster', initiative: 20, sheet: { name: 'LAIR ACTION', armorClass: '', maxHp: 1, spellSlots: [], spells: [], specialAbilities: [], features: [] } },
				],
			}],
			homebrewSheets: [sheet('sheet-vael', 'Vael', 'pc')],
			battleEncounters: [{ id: 'battle', sourceEncounterId: 'enc', name: 'Battle', status: 'active', round: 1, activeTurnIndex: 0, createdAt: '2026-01-01T00:00:00.000Z', startedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', combatants: [{ id: 'combatant', sourceParticipantId: 'linked', name: 'Vael', side: 'player', initiative: 0, armorClass: 0, maxHp: 1, currentHp: 1, temporaryHp: 0, defeated: false, hidden: false, collapsed: false, spellSlotsCollapsed: true, pendingAdd: false, conditions: [], specialAbilities: [], spellSlots: [], spells: [], features: [] }], pendingCombatants: [], lairActions: [], traps: [], turnHistory: [], pendingActions: [], turnSnapshots: [] }],
			calendar: null, campaignContext: null, settings: {}, fiveEToolsHomebrew: null, fiveEToolsHomebrewBackups: [], fiveEToolsHomebrewCompositionPackages: [], rawLocalStorage: {},
		},
	};
	const { backup, report } = sanitizeBackupV2(input);
	validateBackupV2(backup);
	const encounter = backup.data.encounters[0];
	assert.equal(encounter.participants.length, 1);
	assert.equal(encounter.participants[0].initiative, null);
	assert.equal(encounter.participants[0].sourceSheetId, 'sheet-vael');
	assert.equal(encounter.participants[0].category, 'pc');
	assert.equal(encounter.lairActions[0].id, 'lair');
	assert.equal(backup.data.battleEncounters[0].combatants[0].initiative, 0);
	assert.equal(backup.data.battleEncounters[0].combatants[0].armorClass, null);
	assert.equal(report.fakeLairActionsConverted.length, 1);
});
