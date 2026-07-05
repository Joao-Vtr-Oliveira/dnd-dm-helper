import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { Dnd5eApiService } from './dnd-api';

describe('Dnd5eApiService', () => {
  let service: Dnd5eApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
    service = TestBed.inject(Dnd5eApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

	it('keeps passive traits as sheet features and promotes recharge actions to special abilities', () => {
		const creature = service.toCreature(
			{
				index: 'chimera',
				name: 'Chimera',
				hit_points: 114,
				actions: [
					{
						name: 'Fire Breath',
						desc: 'The dragon head exhales fire.',
						usage: { type: 'recharge on roll', dice: '1d6', min_value: 5 },
					},
				],
				special_abilities: [
					{
						name: 'Magic Resistance',
						desc: 'Advantage on saving throws against spells.',
					},
				],
			},
			{ id: 1 },
		);

		expect(creature.specialAbilities).toHaveSize(1);
		expect(creature.specialAbilities[0].name).toBe('Fire Breath');
		expect(creature.specialAbilities[0].rechargeType).toBe('dice');
		expect(creature.specialAbilities[0].rechargeOn).toEqual([5, 6]);
		expect((creature.sheetFeatures ?? []).some((feature) => feature.name === 'Magic Resistance')).toBeTrue();
	});

	it('maps per-day actions to controllable special abilities without duplicating spellcasting traits', () => {
		const creature = service.toCreature(
			{
				index: 'unicorn',
				name: 'Unicorn',
				hit_points: 67,
				special_abilities: [
					{
						name: 'Innate Spellcasting',
						desc: '1/day each: calm emotions',
						spellcasting: {
							spells: [
								{ name: 'Calm Emotions', usage: { type: 'per day', times: 1 } },
							],
						},
					},
				],
				actions: [
					{
						name: 'Healing Touch',
						desc: 'The unicorn touches another creature.',
						usage: { type: 'per day', times: 3 },
					},
				],
			},
			{ id: 2 },
		);

		expect(creature.specialAbilities).toHaveSize(1);
		expect(creature.specialAbilities[0].name).toBe('Healing Touch');
		expect(creature.specialAbilities[0].rechargeType).toBe('per-day');
		expect(creature.specialAbilities[0].maxUses).toBe(3);
		expect(
			(creature.sheetFeatures ?? []).some(
				(feature) => feature.name === 'Innate Spellcasting' && feature.kind === 'spellcasting',
			),
		).toBeTrue();
	});
});
