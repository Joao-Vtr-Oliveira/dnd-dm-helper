import assert from 'node:assert/strict';
import test from 'node:test';
import { compileCompendiumSuggestions } from './generate-compendium-suggestions.mjs';

test('compiles sorted suggestions from the six raw datasets', () => {
	const catalog = compileCompendiumSuggestions({
		skills: [{ name: 'Stealth' }, { name: 'Acrobatics' }, { name: ' stealth ' }, {}],
		languages: [{ name: 'Common' }, { name: 'Draconic' }, { name: 'common' }],
		senses: [{ name: 'Darkvision' }],
		conditions: [{ name: 'Poisoned' }, { name: 'Blinded' }],
		monsterFeatures: [
			{ name: 'Pack Tactics', effect: 'Gain advantage.', example: 'Kobold' },
			{ name: 'Aggressive', effect: 'Move forward.', example: 'Orc', hasNumberParam: true },
			{ name: 'Avoidance', effect: 'Evade damage.', example: 'Demilich', hasNumberParam: false },
		],
		feats: [
			{ name: 'Actor', source: 'PHB', page: 165, entries: ['Mimicry.'] },
			{ name: 'Alert', source: 'PHB', page: 165, entries: [{ type: 'list', items: ['Aware.'] }] },
		],
	});

	assert.deepEqual(catalog, {
		schema: 2,
		skills: ['Acrobatics', 'Stealth'],
		languages: ['Common', 'Draconic'],
		senses: ['Darkvision'],
		conditions: ['Blinded', 'Poisoned'],
		monsterFeatures: [
			{ name: 'Aggressive', effect: 'Move forward.', example: 'Orc', hasNumberParam: true },
			{ name: 'Avoidance', effect: 'Evade damage.', example: 'Demilich', hasNumberParam: false },
			{ name: 'Pack Tactics', effect: 'Gain advantage.', example: 'Kobold' },
		],
		feats: [
			{ name: 'Actor', source: 'PHB', page: 165, entries: ['Mimicry.'] },
			{ name: 'Alert', source: 'PHB', page: 165, entries: [{ type: 'list', items: ['Aware.'] }] },
		],
	});
});

test('rejects a raw dataset with a missing collection', () => {
	assert.throws(
		() =>
			compileCompendiumSuggestions({
				skills: [],
				languages: [],
				senses: [],
				conditions: undefined,
				monsterFeatures: [],
				feats: [],
			}),
		/conditions dataset must be an array/,
	);
});

test('rejects structured entries missing required fields', () => {
	assert.throws(
		() =>
			compileCompendiumSuggestions({
				skills: [],
				languages: [],
				senses: [],
				conditions: [],
				monsterFeatures: [{ name: 'Pack Tactics', effect: 'Gain advantage.' }],
				feats: [],
			}),
		/monsterFeatures entries must have a example/,
	);
});
