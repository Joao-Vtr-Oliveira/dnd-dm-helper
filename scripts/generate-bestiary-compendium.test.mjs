import assert from 'node:assert/strict';
import test from 'node:test';
import { compileBestiary } from './generate-bestiary-compendium.mjs';

test('compiles copies by source and applies common array and text modifications', () => {
	const { bundles, index } = compileBestiary({
		AA: [{ name: 'Scout', source: 'AA', size: ['M'], type: 'humanoid', cr: '1', trait: [{ name: 'Keen Sight', entries: ['A scout sees.'] }], action: [{ name: 'Sword', entries: ['Hit.'] }] }],
		BB: [{ name: 'Scout', source: 'BB', size: ['S'], type: 'beast', cr: '2' }],
		CC: [{ name: 'Veteran Scout', source: 'CC', _copy: { name: 'Scout', source: 'AA', _mod: { '*': { mode: 'replaceTxt', replace: 'scout', with: 'ranger', flags: 'i' }, trait: { mode: 'prependArr', items: { name: 'Alert', entries: [] } }, action: [{ mode: 'replaceArr', replace: 'Sword', items: { name: 'Bow', entries: ['Hit.'] } }, { mode: 'appendArr', items: { name: 'Dagger', entries: [] } }] } } }],
	});

	const copied = bundles.get('CC')[0];
	assert.equal(copied.type, 'humanoid');
	assert.equal(copied.trait[0].name, 'Alert');
	assert.equal(copied.trait[1].entries[0], 'A ranger sees.');
	assert.deepEqual(copied.action.map((action) => action.name), ['Bow', 'Dagger']);
	assert.deepEqual(copied._compile.copy, { name: 'Scout', source: 'AA' });
	assert.equal(index.monsters.filter((monster) => monster.n === 'Scout').length, 2);
	assert.ok(index.monsters.some((monster) => monster.i === 'AA:scout'));
	assert.ok(index.monsters.some((monster) => monster.i === 'BB:scout'));
});

test('retains unresolved references and skips malformed entries without aborting the catalog', () => {
	const { bundles, index } = compileBestiary({
		AA: [null, { name: 'Broken Copy', source: 'AA', _copy: { name: 'Missing', source: 'ZZ' } }, { name: 'Valid', source: 'AA' }],
	});

	assert.equal(bundles.get('AA').length, 2);
	assert.equal(bundles.get('AA').find((monster) => monster.name === 'Broken Copy')._compile.status, 'unresolved-copy');
	assert.ok(index.diagnostics.some((diagnostic) => diagnostic.kind === 'malformed-monster'));
	assert.ok(index.diagnostics.some((diagnostic) => diagnostic.kind === 'unresolved-copy'));
});

test('applies property, skill, and spellcasting modifications', () => {
	const { bundles } = compileBestiary({
		AA: [{ name: 'Mage', source: 'AA', skill: { arcana: '+4' }, spellcasting: [{ spells: { '1': { spells: ['old'] } }, daily: { '1e': ['once'] } }] }],
		BB: [{ name: 'Mage Copy', source: 'BB', _copy: { name: 'Mage', source: 'AA', _mod: { _: [{ mode: 'setProp', prop: 'languages', value: null }, { mode: 'addSkills', skills: { history: '+6' } }, { mode: 'replaceSpells', spells: { '1': [{ replace: 'old', with: 'new' }] } }, { mode: 'addSpells', daily: { '1e': ['added'] } }, { mode: 'removeSpells', daily: { '1e': ['once'] } }] } } }],
	});

	const copied = bundles.get('BB')[0];
	assert.equal(copied.languages, null);
	assert.deepEqual(copied.skill, { arcana: '+4', history: '+6' });
	assert.deepEqual(copied.spellcasting[0].spells['1'].spells, ['new']);
	assert.deepEqual(copied.spellcasting[0].daily['1e'], ['added']);
});
