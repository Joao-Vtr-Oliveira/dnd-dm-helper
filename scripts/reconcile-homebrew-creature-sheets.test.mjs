import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { reconcile } from './reconcile-homebrew-creature-sheets.mjs';

const monster = {
	name: 'Ritual Focus',
	source: 'NAG',
	type: 'construct',
	ac: [14],
	hp: { average: 20, formula: '3d8 + 6' },
	size: ['M'],
	alignment: ['N', 'G'],
	speed: { walk: 30 },
	str: 10,
	dex: 12,
	con: 14,
	int: 3,
	wis: 10,
	cha: 5,
	trait: [],
	action: [{ name: 'Ritual Pulse (1/Combat)', entries: [{ name: 'Pulse.', entries: ['{@dc 13} Constitution save.'] }] }],
	bonus: [],
	reaction: [],
	legendary: [],
	mythic: [],
	spellcasting: [],
};

const backup = {
	exportedAt: '2026-01-01T00:00:00.000Z',
	data: {
		homebrewSheets: [
			{
				id: 'existing',
				externalId: 'existing',
				title: 'Ritual Focus',
				createdAt: 1,
				updatedAt: 1,
				category: 'monster',
				tags: ['ritual'],
				source: 'Campaign',
				data: { name: 'Ritual Focus', origin: 'Campaign', spellSlots: [], spells: [], specialAbilities: [], features: [] },
			},
		],
	},
};

test('reconciles by name without replacing IDs, preserves origin, and is idempotent', () => {
	const first = reconcile({ monster: [monster, { ...monster, name: 'Ritual Focus (1)' }] }, backup);
	const sheet = first.backup.data.homebrewSheets[0];

	assert.equal(sheet.id, 'existing');
	assert.equal(sheet.data.source, 'NAG');
	assert.equal(sheet.data.origin, 'Campaign');
	assert.equal(sheet.data.size, 'Medium');
	assert.equal(sheet.data.alignment, 'Neutral Good');
	assert.deepEqual(sheet.data.tags, ['ritual']);
	assert.deepEqual(sheet.data.specialAbilities[0], {
		id: 'NAG::Ritual Focus::ability::action-1',
		name: 'Ritual Pulse (1/Combat)',
		description: 'Pulse.\nDC 13 Constitution save.',
		recoveryType: 'uses-per-combat',
		maxUses: 1,
	});
	assert.equal(first.report.skipped[0].reason, 'duplicate of Ritual Focus');

	const second = reconcile({ monster: [monster, { ...monster, name: 'Ritual Focus (1)' }] }, first.backup);
	assert.deepEqual(second.backup, first.backup);
});

test('removes sheets created for duplicate source monsters', () => {
	const duplicateBackup = structuredClone(backup);
	duplicateBackup.data.homebrewSheets.push({
		id: 'duplicate',
		externalId: 'duplicate',
		title: 'Ritual Focus (1)',
		data: { fiveEToolsIdentity: { name: 'Ritual Focus (1)', source: 'NAG' } },
	});

	const result = reconcile({ monster: [monster, { ...monster, name: 'Ritual Focus (1)' }] }, duplicateBackup);
	assert.equal(result.backup.data.homebrewSheets.length, 1);
});

test('keeps the native Wen Torger sheet as the canonical runtime definition', async () => {
	const backup = JSON.parse(
		await readFile(new URL('../rpg_files/dnd-dm-helper-backup-v2.json', import.meta.url), 'utf8'),
	);
	const wen = backup.data.homebrewSheets.find((sheet) => sheet.data?.name === 'Wen Torger');

	assert.ok(wen);
	assert.deepEqual(
		wen.data.specialAbilities.map(({ name, recoveryType, maxUses, rechargeOn }) => ({
			name, recoveryType, maxUses, rechargeOn,
		})),
		[
			{ name: 'Infernal Brand (Recharge 5–6)', recoveryType: 'dice-recharge', maxUses: undefined, rechargeOn: [5, 6] },
			{ name: 'Fiendish Step (Recharge 4–6)', recoveryType: 'dice-recharge', maxUses: undefined, rechargeOn: [4, 5, 6] },
			{ name: 'Hellish Rebuke (2/Day)', recoveryType: 'uses-per-day', maxUses: 2, rechargeOn: undefined },
		],
	);
	assert.deepEqual(
		wen.data.features.filter((feature) => feature.kind === 'trait').map((feature) => feature.name),
		['Caçador da Winterhold', 'Pacto Infernal Controlado', 'NPC de Apoio'],
	);
	assert.ok(wen.data.spells.some((spell) => spell.name === 'Eldritch Blast'));
	assert.deepEqual(wen.data.spellSlots, [{ level: 3, max: 2 }]);
});
