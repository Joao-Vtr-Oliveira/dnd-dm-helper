import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import type { Encounter } from '../../models/encounter-model';
import { BattleEncounterService } from '../battle-encounter-service/battle-encounter-service';
import { BattleUpcomingEventsService } from './battle-upcoming-events-service';

describe('BattleUpcomingEventsService', () => {
	let battleService: BattleEncounterService;
	let service: BattleUpcomingEventsService;

	const encounter: Encounter = {
		schemaVersion: 1,
		type: 'dnd-dm-helper-encounter',
		id: 'enc-timeline',
		title: 'Timeline Test',
		createdAt: Date.parse('2026-01-01T10:00:00.000Z'),
		updatedAt: Date.parse('2026-01-01T10:00:00.000Z'),
		tags: [],
		participants: [
				{
					id: 'participant-chief',
					name: 'Goblin Chefe',
					initiative: 18,
					category: 'monster',
					sheet: { name: 'Goblin Chefe', armorClass: 14, maxHp: 20, spellSlots: [], spells: [], specialAbilities: [], features: [] },
				},
				{
					id: 'participant-rosa',
					name: 'Rosa',
					initiative: 14,
					category: 'pc',
					sheet: { name: 'Rosa', armorClass: 15, maxHp: 24, spellSlots: [], spells: [], specialAbilities: [], features: [] },
				},
				{
					id: 'participant-orc',
					name: 'Orc Bruto',
					initiative: 10,
					category: 'monster',
					sheet: { name: 'Orc Bruto', armorClass: 13, maxHp: 30, spellSlots: [], spells: [], specialAbilities: [], features: [] },
				},
			],
		lairActions: [],
		traps: [],
	};

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideZonelessChangeDetection()],
		});
		battleService = TestBed.inject(BattleEncounterService);
		service = TestBed.inject(BattleUpcomingEventsService);
	});

	it('ignores defeated combatants in upcoming turn events', () => {
		const battle = battleService.createBattleFromEncounter(encounter);
		const defeated = battleService.setCombatantDefeated(battle, battle.combatants[1].id, true);
		const events = service.buildUpcomingBattleEvents(defeated, 6);

		expect(events.some((event) => event.type === 'turn' && event.label.includes('Rosa'))).toBeFalse();
		expect(events.some((event) => event.type === 'turn' && event.label.includes('Orc Bruto'))).toBeTrue();
	});

	it('projects the three turns after the current combatant across round boundaries', () => {
		const battle = battleService.createBattleFromEncounter(encounter);
		const turns = service.buildUpcomingTurnEvents(battle, 3);

		expect(turns.map((event) => event.combatantId)).toEqual([
			battle.combatants[1].id,
			battle.combatants[2].id,
			battle.combatants[0].id,
		]);
		expect(turns[2].round).toBe(2);
	});

	it('includes pending combatants when they join on the next round', () => {
		const battle = battleService.createBattleFromEncounter(encounter);
		const withPending = battleService.addCombatantFromParticipant(battle, {
			id: 'participant-dodman',
			name: 'Dodman',
			initiative: 16,
			category: 'monster',
			sheet: { name: 'Dodman', armorClass: 14, maxHp: 20, spellSlots: [], spells: [], specialAbilities: [], features: [] },
		});

		const turns = service.buildUpcomingTurnEvents(withPending, 4);
		expect(turns.some((event) => event.combatantId === withPending.pendingCombatants[0].id)).toBeTrue();
	});

	it('shows conditions that are about to expire', () => {
		const battle = battleService.createBattleFromEncounter(encounter);
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
		const battle = battleService.createBattleFromEncounter({
			...encounter,
			participants: encounter.participants.map((participant, index) =>
				index === 0
					? {
							...participant,
							sheet: {
								...participant.sheet,
								specialAbilities: [
									{ id: 'flame-breath', name: 'Sopro Flamejante', recoveryType: 'turn-cooldown', cooldownTurns: 2 },
								],
							},
						}
					: participant,
			),
		});
		const abilityId = battle.combatants[0].specialAbilities[0].id;
		const used = battleService.useSpecialAbility(battle, battle.combatants[0].id, abilityId);
		const events = service.buildUpcomingBattleEvents(used, 8);

		expect(events.some((event) => event.type === 'ability-recharge' && event.label.includes('Sopro Flamejante'))).toBeTrue();
	});

	it('shows lair actions without treating them as combatants', () => {
		const battle = battleService.createBattleFromEncounter(encounter);
		const withLairAction = battleService.addLairAction(battle, {
			name: 'Olho do Covil',
			initiative: 20,
			frequency: 'every-round',
		});
		const events = service.buildUpcomingBattleEvents(withLairAction, 8);

		expect(events.some((event) => event.type === 'lair-action' && event.label.includes('Olho do Covil'))).toBeTrue();
		expect(events[0].type).toBe('lair-action');
		expect(events[0].label).toBe('Agora: Olho do Covil');
		expect(events[1].label).toContain('Depois:');
		expect(withLairAction.combatants).toHaveSize(3);
	});

	it('shows an active opening lair action as the current event', () => {
		const battle = battleService.createBattleFromEncounter({
			...encounter,
			lairActions: [
				{ id: 'opening-lair', name: 'Opening Lair', initiative: 20, active: true, frequency: 'every-round' },
			],
			traps: [],
		});
		const events = service.buildUpcomingBattleEvents(battle, 4);

		expect(events[0]).toEqual(
			jasmine.objectContaining({ type: 'lair-action', label: 'Agora: Opening Lair', round: 1 }),
		);
		expect(events[1].label).toContain('Depois:');
	});

	it('does not show manual traps as upcoming automatic events', () => {
		const battle = battleService.createBattleFromEncounter({
			...encounter,
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
		});
		const events = service.buildUpcomingBattleEvents(battle, 8);

		expect(events.some((event) => event.type === 'trap' && event.label.includes('Pressure Plate'))).toBeFalse();
		expect(events.some((event) => event.type === 'trap' && event.label.includes('Ritual Pulse'))).toBeTrue();
	});
});
