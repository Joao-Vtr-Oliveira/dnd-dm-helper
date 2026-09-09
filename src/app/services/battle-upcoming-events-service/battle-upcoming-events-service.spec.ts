import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import type { EncounterTemplate } from '../../models/battle-encounter-model';
import { BattleEncounterService } from '../battle-encounter-service/battle-encounter-service';
import { BattleUpcomingEventsService } from './battle-upcoming-events-service';

describe('BattleUpcomingEventsService', () => {
	let battleService: BattleEncounterService;
	let service: BattleUpcomingEventsService;

	const template: EncounterTemplate = {
		id: 'enc-timeline',
		name: 'Timeline Test',
		data: {
			creatures: [
				{
					id: 1,
					name: 'Goblin Chefe',
					initiative: 18,
					healthPoints: 20,
					maxHealthPoints: 20,
					armorClass: 14,
					temporaryHealthPoints: 0,
					alive: true,
					conditions: [],
					notes: [],
					shared: true,
					hitPointsShared: true,
					totalSpellSlots: null,
					usedSpellSlots: null,
					spells: {},
					specialAbilities: [],
					sheetFeatures: [],
				},
				{
					id: 2,
					name: 'Rosa',
					initiative: 14,
					healthPoints: 24,
					maxHealthPoints: 24,
					armorClass: 15,
					temporaryHealthPoints: 0,
					alive: true,
					conditions: [],
					notes: [],
					shared: true,
					hitPointsShared: true,
					totalSpellSlots: null,
					usedSpellSlots: null,
					spells: {},
					specialAbilities: [],
					sheetFeatures: [],
					category: 'pc',
				},
				{
					id: 3,
					name: 'Orc Bruto',
					initiative: 10,
					healthPoints: 30,
					maxHealthPoints: 30,
					armorClass: 13,
					temporaryHealthPoints: 0,
					alive: true,
					conditions: [],
					notes: [],
					shared: true,
					hitPointsShared: true,
					totalSpellSlots: null,
					usedSpellSlots: null,
					spells: {},
					specialAbilities: [],
					sheetFeatures: [],
				},
			],
			creatureIdCount: 3,
			round: 0,
			battleCreated: false,
			shareEnabled: false,
			battleTrackerVersion: '5.123.0',
			sharedTimestamp: null,
			loaded: true,
		},
	};

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideZonelessChangeDetection()],
		});
		battleService = TestBed.inject(BattleEncounterService);
		service = TestBed.inject(BattleUpcomingEventsService);
	});

	it('ignores defeated combatants in upcoming turn events', () => {
		const battle = battleService.createBattleFromEncounter(template);
		const defeated = battleService.setCombatantDefeated(battle, battle.combatants[1].id, true);
		const events = service.buildUpcomingBattleEvents(defeated, 6);

		expect(events.some((event) => event.type === 'turn' && event.label.includes('Rosa'))).toBeFalse();
		expect(events.some((event) => event.type === 'turn' && event.label.includes('Orc Bruto'))).toBeTrue();
	});

	it('projects the three turns after the current combatant across round boundaries', () => {
		const battle = battleService.createBattleFromEncounter(template);
		const turns = service.buildUpcomingTurnEvents(battle, 3);

		expect(turns.map((event) => event.combatantId)).toEqual([
			battle.combatants[1].id,
			battle.combatants[2].id,
			battle.combatants[0].id,
		]);
		expect(turns[2].round).toBe(2);
	});

	it('includes pending combatants when they join on the next round', () => {
		const battle = battleService.createBattleFromEncounter(template);
		const withPending = battleService.addCombatantFromCreature(battle, {
			id: 4,
			name: 'Dodman',
			initiative: 16,
			healthPoints: 20,
			maxHealthPoints: 20,
			armorClass: 14,
			temporaryHealthPoints: 0,
			alive: true,
			conditions: [],
			notes: [],
			shared: true,
			hitPointsShared: true,
			totalSpellSlots: null,
			usedSpellSlots: null,
			spells: {},
			specialAbilities: [],
			sheetFeatures: [],
		});

		const turns = service.buildUpcomingTurnEvents(withPending, 4);
		expect(turns.some((event) => event.combatantId === withPending.pendingCombatants[0].id)).toBeTrue();
	});

	it('shows conditions that are about to expire', () => {
		const battle = battleService.createBattleFromEncounter(template);
		const withCondition = battleService.addCondition(battle, battle.combatants[0].id, {
			name: 'blessed',
			label: 'Abençoado',
			durationType: 'turns',
			durationTurns: 1,
		});
		const events = service.buildUpcomingBattleEvents(withCondition, 8);

		expect(events.some((event) => event.type === 'condition-expire' && event.label.includes('Abençoado'))).toBeTrue();
	});

	it('shows ability cooldown recovery in the timeline', () => {
		const battle = battleService.createBattleFromEncounter(template);
		const withAbility = battleService.addSpecialAbility(battle, battle.combatants[0].id, {
			name: 'Sopro Flamejante',
			recoveryType: 'turn-cooldown',
			cooldownTurns: 2,
		});
		const abilityId = withAbility.combatants[0].specialAbilities[0].id;
		const used = battleService.useSpecialAbility(withAbility, battle.combatants[0].id, abilityId);
		const events = service.buildUpcomingBattleEvents(used, 8);

		expect(events.some((event) => event.type === 'ability-recharge' && event.label.includes('Sopro Flamejante'))).toBeTrue();
	});

	it('shows lair actions without treating them as combatants', () => {
		const battle = battleService.createBattleFromEncounter(template);
		const withLairAction = battleService.addLairAction(battle, {
			name: 'Olho do Covil',
			initiative: 20,
			frequency: 'every-round',
		});
		const events = service.buildUpcomingBattleEvents(withLairAction, 8);

		expect(events.some((event) => event.type === 'lair-action' && event.label.includes('Olho do Covil'))).toBeTrue();
		expect(withLairAction.combatants).toHaveSize(3);
	});

	it('does not show manual traps as upcoming automatic events', () => {
		const battle = battleService.createBattleFromEncounter({
			...template,
			data: {
				...template.data,
				traps: [
					{
						id: 'manual-trap',
						name: 'Pressure Plate',
						triggerType: 'initiative',
						initiative: 20,
						active: true,
						frequency: 'manual',
					},
					{
						id: 'automatic-trap',
						name: 'Ritual Pulse',
						triggerType: 'initiative',
						initiative: 20,
						active: true,
						frequency: 'every-round',
					},
				],
			},
		});
		const events = service.buildUpcomingBattleEvents(battle, 8);

		expect(events.some((event) => event.type === 'trap' && event.label.includes('Pressure Plate'))).toBeFalse();
		expect(events.some((event) => event.type === 'trap' && event.label.includes('Ritual Pulse'))).toBeTrue();
	});
});
