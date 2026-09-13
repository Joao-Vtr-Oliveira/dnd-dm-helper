import assert from 'node:assert/strict';
import test from 'node:test';
import { compileSpells } from './generate-spells-compendium.mjs';

const spell = (name, source, overrides = {}) => ({
	name,
	source,
	level: 1,
	school: 'E',
	time: [{ number: 1, unit: 'action' }],
	range: { type: 'point', distance: { type: 'feet', amount: 60 } },
	components: { v: true, s: true },
	duration: [{ type: 'instant' }],
	entries: ['Test description.'],
	...overrides,
});

test('keeps spells with the same name from different sources as distinct entries', () => {
	const compiled = compileSpells({
		PHB: [spell('Fireball', 'PHB')],
		XPHB: [spell('Fireball', 'XPHB')],
	});

	assert.equal(compiled.index.spells.length, 2);
	assert.deepEqual(
		compiled.index.spells.map((entry) => entry.s),
		['PHB', 'XPHB'],
	);
	assert.equal(compiled.bundles.get('PHB')[0].id, 'PHB:fireball');
	assert.equal(compiled.bundles.get('XPHB')[0].id, 'XPHB:fireball');
});

test('indexes classes from the local class metadata without inferring missing entries', () => {
	const compiled = compileSpells(
		{ PHB: [spell('Fireball', 'PHB'), spell('Shield', 'PHB')] },
		{ PHB: { Fireball: { class: [{ name: 'Wizard' }], classVariant: [{ name: 'Sorcerer' }] } } },
	);

	assert.deepEqual(compiled.index.spells[0].cl, ['Wizard', 'Sorcerer']);
	assert.deepEqual(compiled.index.spells[1].cl, []);
});

test('skips malformed spells without preventing valid catalog entries', () => {
	const compiled = compileSpells({
		PHB: [spell('Shield', 'PHB'), { name: 'Broken', source: 'PHB' }],
	});

	assert.equal(compiled.index.spells.length, 1);
	assert.equal(compiled.index.spells[0].n, 'Shield');
	assert.deepEqual(compiled.index.diagnostics, [
		{ kind: 'invalid-spell', source: 'PHB', name: 'Broken' },
	]);
});
