import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CompendiumBestiaryNormalizerService } from './compendium-bestiary-normalizer-service';

describe('CompendiumBestiaryNormalizerService', () => {
	let service: CompendiumBestiaryNormalizerService;

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
		service = TestBed.inject(CompendiumBestiaryNormalizerService);
	});

	it('normalizes compact generator index entries and filters them for UI use', () => {
		const index = service.normalizeIndex({
			sources: [{ s: 'MM', f: 'sources/mm.json', c: 2 }],
			monsters: [
				{ i: 'MM:adult-red-dragon', n: 'Adult Red Dragon', s: 'MM', t: 'dragon', z: 'H', cr: '17', p: 98, a: ['Red Dragon'] },
				{ i: 'MM:archmage', n: 'Archmage', s: 'MM', t: 'humanoid', z: 'M', cr: '12', p: 342 },
			],
		});

		expect(index.sources).toEqual([{ source: 'MM', path: 'sources/mm.json', count: 2 }]);
		expect(index.monsters[0]).toEqual(jasmine.objectContaining({ id: 'MM:adult-red-dragon', page: 98 }));
		expect(service.filterIndex(index, { search: 'red', types: ['dragon'], sizes: ['H'] })).toEqual([
			jasmine.objectContaining({ id: 'MM:adult-red-dragon' }),
		]);
		expect(service.filterIndex(index, { search: 'dragon', challengeRatings: ['17'] })).toHaveSize(1);
	});

	it('preserves normalized stat-block metadata and raw aliases', () => {
		const monster = service.normalizeBundle({
			monsters: [
				{
					id: 'MM:adult-red-dragon',
					name: 'Adult Red Dragon',
					source: 'MM',
					alias: ['Red Dragon'],
					page: 98,
					size: ['H'],
					type: { type: 'dragon', tags: ['chromatic'] },
					alignment: ['C', 'E'],
					speed: { walk: 40, fly: 80 },
					str: 27,
					save: { dex: '+6' },
					skill: { perception: '+13' },
					resist: ['cold'],
					immune: ['fire'],
					conditionImmune: ['charmed'],
					senses: ['blindsight 60 ft.'],
					passive: 23,
					languages: ['Common', 'Draconic'],
					pbNote: '+6',
					mythic: [{ name: 'Mythic Action', entries: ['The dragon acts.'] }],
					damageTags: ['F'],
				},
			],
		});

		expect(monster[0]).toEqual(jasmine.objectContaining({
			id: 'MM:adult-red-dragon',
			aliases: ['Red Dragon'],
			page: 98,
			type: 'dragon',
			subtypes: ['chromatic'],
			abilities: jasmine.objectContaining({ str: 27 }),
			proficiency: '+6',
			mythicActions: [jasmine.objectContaining({ name: 'Mythic Action' })],
			tags: { damageTags: ['F'] },
	}));
	});
});
