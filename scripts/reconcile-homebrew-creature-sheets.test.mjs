import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcile } from './reconcile-homebrew-creature-sheets.mjs';

const monster = {
	name: 'Ritual Focus',
	source: 'NAG',
	type: 'construct',
	ac: [14],
	hp: { average: 20, formula: '3d8 + 6' },
	size: ['M'],
	alignment: ['U'],
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
