import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { Dnd5eApiService } from './dnd-api';

describe('Dnd5eApiService', () => {
  let service: Dnd5eApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
		providers: [provideZonelessChangeDetection(), provideHttpClient()],
    });
    service = TestBed.inject(Dnd5eApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

	it('keeps passive traits as sheet features and promotes recharge actions to special abilities', () => {
		const sheet = service.toCreatureSheet({
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
			});

		expect(sheet.maxHp).toBe(114);
		expect(sheet.specialAbilities).toHaveSize(1);
		expect(sheet.specialAbilities[0]).toEqual(jasmine.objectContaining({
			name: 'Fire Breath',
			description: 'The dragon head exhales fire.',
			recoveryType: 'dice-recharge',
			rechargeOn: [5, 6],
		}));
		expect(sheet.features).toContain(jasmine.objectContaining({
			name: 'Magic Resistance',
			kind: 'trait',
		}));
	});

	it('maps per-day actions to controllable special abilities without duplicating spellcasting traits', () => {
		const sheet = service.toCreatureSheet({
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
			});

		expect(sheet.specialAbilities).toHaveSize(1);
		expect(sheet.specialAbilities[0]).toEqual(jasmine.objectContaining({
			name: 'Healing Touch',
			recoveryType: 'uses-per-day',
			maxUses: 3,
		}));
		expect(sheet.features).toContain(jasmine.objectContaining({
			name: 'Innate Spellcasting',
			kind: 'spellcasting',
		}));
	});
});
