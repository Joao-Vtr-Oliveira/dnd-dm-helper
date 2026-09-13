import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CompendiumSpellNormalizerService } from './compendium-spell-normalizer-service';

describe('CompendiumSpellNormalizerService', () => {
	let service: CompendiumSpellNormalizerService;

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
		service = TestBed.inject(CompendiumSpellNormalizerService);
	});

	it('normalizes compact index entries and applies spell filters case-insensitively', () => {
		const index = service.normalizeIndex({
			sources: [{ s: 'PHB', f: 'sources/PHB.json', c: 2 }],
			spells: [
				{
					i: 'PHB:fireball',
					n: 'Fireball',
					s: 'PHB',
					l: 3,
					h: 'V',
					ct: false,
					rt: false,
					a: ['Bola de Fogo'],
					cl: ['Wizard'],
				},
				{ i: 'PHB:detect-magic', n: 'Detect Magic', s: 'PHB', l: 1, h: 'D', ct: true, rt: true },
			],
		});

		expect(
			service.filterIndex(index, { search: 'bola', levels: [3], schools: ['v'], sources: ['phb'] }),
		).toEqual([jasmine.objectContaining({ id: 'PHB:fireball' })]);
		expect(service.filterIndex(index, { concentration: true, ritual: true })).toEqual([
			jasmine.objectContaining({ id: 'PHB:detect-magic' }),
		]);
		expect(index.spells.find((spell) => spell.id === 'PHB:fireball')?.classes).toEqual(['Wizard']);
	});

	it('preserves spell detail fields, higher levels, and direct class metadata', () => {
		const spells = service.normalizeBundle({
			spells: [
				{
					id: 'PHB:detect-magic',
					name: 'Detect Magic',
					source: 'PHB',
					page: 231,
					level: 1,
					school: 'D',
					time: [{ number: 1, unit: 'action' }],
					range: { type: 'self', distance: { type: 'self' } },
					components: { v: true, s: true, m: { text: 'a copper piece' } },
					duration: [
						{
							type: 'timed',
							concentration: true,
							upTo: true,
							duration: { amount: 10, type: 'minute' },
						},
					],
					meta: { ritual: true },
					entries: ['You sense magic.'],
					entriesHigherLevel: [
						{ type: 'entries', name: 'At Higher Levels', entries: ['More magic.'] },
					],
					damageInflict: ['radiant'],
					savingThrow: ['wisdom'],
					spellAttack: ['R'],
					conditionInflict: ['charmed'],
				},
			],
			classes: {
				'Detect Magic': { class: [{ name: 'Wizard' }], classVariant: [{ name: 'Bard' }] },
			},
		});

		expect(spells[0]).toEqual(
			jasmine.objectContaining({
				castingTime: '1 action',
				range: 'Self',
				components: { verbal: true, somatic: true, material: 'a copper piece' },
				duration: 'Up to 10 minutes',
				concentration: true,
				ritual: true,
				entries: ['You sense magic.'],
				entriesHigherLevel: [jasmine.objectContaining({ name: 'At Higher Levels' })],
				classes: ['Wizard', 'Bard'],
			}),
		);
	});
});
