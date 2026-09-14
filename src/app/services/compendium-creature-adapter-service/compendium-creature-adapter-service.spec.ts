import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CompendiumMonster } from '../../models/compendium-bestiary-model';
import { CompendiumCreatureAdapterService } from './compendium-creature-adapter-service';

describe('CompendiumCreatureAdapterService', () => {
	let service: CompendiumCreatureAdapterService;

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
		service = TestBed.inject(CompendiumCreatureAdapterService);
	});

	it('converts every monster section, spell references, slots, and exact recovery rules', () => {
		const sheet = service.toCreatureSheet({
			id: 'MM::Ancient Test Dragon',
			name: 'Ancient Test Dragon',
			source: 'MM',
			aliases: [],
			sizes: ['G'],
			subtypes: ['dragon'],
			alignment: ['C', 'E'],
			speed: { walk: 40, fly: 80 },
			abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 15, cha: 19 },
			saves: { dex: '+6' },
			skills: { perception: '+13' },
			vulnerable: [],
			resist: [],
			immune: [],
			conditionImmune: [],
			senses: ['blindsight 60 ft.'],
			languages: ['Common'],
			tags: {},
			armorClass: 19,
			hitPoints: 256,
			traits: [
				{ name: 'Magic Resistance', entries: ['Advantage on saves.'] },
				{ name: 'Parry', entries: ['The dragon adds 4 to its AC.'] },
			],
			actions: [
				{ name: 'Fire Breath (Recharge 4-6)', entries: ['{@damage 18d6} fire damage.'] },
				{ name: 'Frightful Presence (Recharge 6)', entries: ['Targets are frightened.'] },
			],
			bonusActions: [{ name: 'Wing Attack (3/Day)', entries: ['The dragon beats its wings.'] }],
			reactions: [{ name: 'Ritual Pulse (1/Combat)', entries: ['The ritual flares.'] }],
			legendaryActions: [{ name: 'Tail', entries: ['Melee Weapon Attack.'] }],
			mythicActions: [{ name: 'Mythic Tail', entries: ['The dragon makes a tail attack.'] }],
			spellcasting: [
				{
					name: 'Spellcasting',
					headerEntries: ['The dragon is a spellcaster.'],
					footerEntries: [],
					spells: {
						'0': { spells: ['{@spell fire bolt|XPHB}', '{@spell mage hand}'] },
						'3': { slots: 3, spells: ['{@spell fireball|XPHB}'] },
					},
					spellLists: { 'daily:1': ['{@spell plane shift|XPHB}'] },
				},
				{
					name: 'Additional Spellcasting',
					headerEntries: [],
					footerEntries: [],
					spells: { '3': { slots: 4, spells: ['{@spell counterspell|XPHB}'] } },
					spellLists: {},
				},
			],
			legendaryGroup: {
				name: 'Dragon Lair',
				source: 'MM',
				lairActions: ['Magma erupts.'],
				regionalEffects: [],
				mythicEncounter: [],
			},
			raw: { name: 'Ancient Test Dragon', source: 'MM' },
		} satisfies CompendiumMonster);

		expect(sheet.features.map((feature) => feature.kind)).toEqual([
			'trait',
			'trait',
			'action',
			'action',
			'bonus',
			'reaction',
			'legendary',
			'legendary',
			'spellcasting',
			'spellcasting',
		]);
		expect(sheet.spellSlots).toEqual([{ level: 3, max: 4 }]);
		expect(sheet.spells).toContain(
			jasmine.objectContaining({ name: 'fireball', source: 'XPHB', level: 3 }),
		);
		expect(sheet.spells).toContain(
			jasmine.objectContaining({ name: 'mage hand', source: 'PHB', level: 0 }),
		);
		expect(sheet.spells).toContain(
			jasmine.objectContaining({ name: 'plane shift', source: 'XPHB', uses: 1 }),
		);
		expect(sheet.specialAbilities).toEqual([
			jasmine.objectContaining({ name: 'Fire Breath (Recharge 4-6)', rechargeOn: [4, 5, 6] }),
			jasmine.objectContaining({ name: 'Frightful Presence (Recharge 6)', rechargeOn: [6] }),
			jasmine.objectContaining({ name: 'Wing Attack (3/Day)', maxUses: 3 }),
			jasmine.objectContaining({ name: 'Ritual Pulse (1/Combat)', recoveryType: 'uses-per-combat', maxUses: 1 }),
		]);
		expect(sheet.officialOrigin).toEqual({
			provider: '5etools',
			name: 'Ancient Test Dragon',
			source: 'MM',
		});
		expect(sheet.officialSnapshot?.legendaryGroup?.lairActions).toEqual(['Magma erupts.']);
		expect(sheet.features.some((feature) => feature.name === 'Magma erupts.')).toBeFalse();
	});
});
