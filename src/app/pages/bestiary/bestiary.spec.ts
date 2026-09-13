import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { CompendiumMonster } from '../../models/compendium-bestiary-model';
import { CompendiumBestiaryRepositoryService } from '../../services/compendium-bestiary-repository-service/compendium-bestiary-repository-service';
import { SpellReferenceResolverService } from '../../services/spell-reference-resolver-service/spell-reference-resolver-service';
import { BestiaryPage } from './bestiary';

function creatureFixture(imageUrl?: string): CompendiumMonster {
	return {
		id: 'MM:aarakocra',
		name: 'Aarakocra',
		source: 'MM',
		aliases: [],
		sizes: ['M'],
		type: 'humanoid',
		subtypes: [],
		alignment: ['neutral good'],
		speed: { walk: 20, fly: 50 },
		abilities: { str: 10, dex: 14, con: 10, int: 11, wis: 12, cha: 11 },
		saves: {},
		skills: {},
		vulnerable: [],
		resist: [],
		immune: [],
		conditionImmune: [],
		senses: [],
		languages: [],
		challengeRating: '1/4',
		armorClass: 12,
		hitPoints: 13,
		traits: [],
		actions: [],
		bonusActions: [],
		reactions: [],
		legendaryActions: [],
		mythicActions: [],
		spellcasting: [],
		tags: {},
		raw: {} as CompendiumMonster['raw'],
		imageUrl,
	};
}

describe('BestiaryPage', () => {
	let component: BestiaryPage;
	let fixture: ComponentFixture<BestiaryPage>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [BestiaryPage],
			providers: [
				provideZonelessChangeDetection(),
				provideRouter([]),
				{
					provide: CompendiumBestiaryRepositoryService,
					useValue: {
						getIndex: async () => ({ monsters: [], sources: [] }),
					},
				},
				{
					provide: SpellReferenceResolverService,
					useValue: {
						parse: (value: string) => ({
							displayText: value.replace(/\{@spell\s+([^|}]+).*\}/i, '$1'),
							reference: { name: 'Fireball', source: 'PHB' },
						}),
						resolveReference: async () => null,
					},
				},
			],
		}).compileComponents();
		fixture = TestBed.createComponent(BestiaryPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('marks the loaded creature as selected', () => {
		component.selected.set(creatureFixture());

		expect(component.isSelected('MM', 'Aarakocra')).toBeTrue();
		expect(component.isSelected('MM', 'Aboleth')).toBeFalse();
	});

	it('formats creature metadata and ability modifiers for quick table use', () => {
		const creature = creatureFixture();
		creature.sizes = ['H'];
		creature.type = 'undead';
		creature.alignment = ['L', 'E'];

		expect(component.formatCreatureMetadata(creature)).toBe('Huge Undead · Lawful Evil');
		expect(component.abilityModifier(25)).toBe('+7');
		expect(component.abilityModifier(7)).toBe('-2');
	});

	it('orders challenge ratings by their numeric value while preserving fraction labels', () => {
		const challengeRatings = ['10', '1/2', '0', '1/4', '2', '1', '1/8'];
		component.index.set({
			monsters: challengeRatings.map((challengeRating) => ({
				...creatureFixture(),
				id: `MM:${challengeRating}`,
				name: challengeRating,
				challengeRating,
				averageHp: 13,
				hasSpellcasting: false,
				hasLegendaryActions: false,
				hasLairActions: false,
			})),
			sources: [],
		});

		expect(component.challengeRatings()).toEqual(['0', '1/8', '1/4', '1/2', '1', '2', '10']);
	});

	it('opens and closes the image lightbox for an available image', () => {
		component.selected.set(creatureFixture('https://5e.tools/img/bestiary/MM/Aarakocra.webp'));

		component.openImageLightbox();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe(
			'true',
		);

		component.closeImageLightbox();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
	});
});
