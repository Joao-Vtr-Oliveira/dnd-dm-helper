import { TestBed } from '@angular/core/testing';
import type { EncounterTemplate } from '../../models/battle-encounter-model';
import { BattleEncounterService } from './battle-encounter-service';

describe('BattleEncounterService', () => {
	let service: BattleEncounterService;

	const template: EncounterTemplate = {
		id: 'enc-1',
		name: 'Goblin Ambush',
		data: {
			creatures: [
				{
					id: 0,
					name: 'Goblin Boss',
					initiative: 18,
					healthPoints: 30,
					maxHealthPoints: 30,
					armorClass: 16,
					temporaryHealthPoints: 5,
					alive: true,
					conditions: [],
					notes: [{ id: 1, text: 'Focus no wizard', appliedAtRound: 0, appliedAtSeconds: 0 }],
					shared: true,
					hitPointsShared: true,
					totalSpellSlots: null,
					usedSpellSlots: null,
					spells: {},
				},
				{
					id: 1,
					name: 'Goblin Minion',
					initiative: 12,
					healthPoints: 12,
					maxHealthPoints: 12,
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
				},
			],
			creatureIdCount: 2,
			round: 0,
			battleCreated: false,
			shareEnabled: false,
			battleTrackerVersion: '5.123.0',
			sharedTimestamp: null,
			loaded: true,
		},
	};

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(BattleEncounterService);
	});

	it('creates a battle encounter from a saved encounter', () => {
		const battle = service.createBattleFromEncounter(template, undefined, new Date('2026-01-01T10:00:00.000Z'));

		expect(battle.sourceEncounterId).toBe('enc-1');
		expect(battle.name).toBe('Goblin Ambush');
		expect(battle.round).toBe(1);
		expect(battle.activeTurnIndex).toBe(0);
		expect(battle.combatants.length).toBe(2);
		expect(battle.combatants[0].name).toBe('Goblin Boss');
		expect(battle.combatants[0].privateNotes).toContain('Focus no wizard');
		expect(battle.combatants[0].side).toBe('enemy');
	});

	it('supports selecting sides before the battle starts', () => {
		const battle = service.createBattleFromEncounter(template, {
			combatantSides: {
				0: 'ally',
				1: 'player',
			},
		});

		expect(battle.combatants[0].side).toBe('ally');
		expect(battle.combatants[1].side).toBe('player');
	});

	it('orders combatants by initiative', () => {
		const battle = service.createBattleFromEncounter(template);

		expect(battle.combatants.map((combatant) => combatant.name)).toEqual([
			'Goblin Boss',
			'Goblin Minion',
		]);
	});

	it('advances the turn and then advances the round after the last combatant', () => {
		const battle = service.createBattleFromEncounter(template, undefined, new Date('2026-01-01T10:00:00.000Z'));
		const afterFirstTurn = service.advanceTurn(
			battle,
			new Date('2026-01-01T10:01:30.000Z')
		);
		const afterSecondTurn = service.advanceTurn(
			afterFirstTurn,
			new Date('2026-01-01T10:02:00.000Z')
		);

		expect(afterFirstTurn.activeTurnIndex).toBe(1);
		expect(afterFirstTurn.turnHistory).toHaveSize(1);
		expect(afterSecondTurn.activeTurnIndex).toBe(0);
		expect(afterSecondTurn.round).toBe(2);
		expect(afterSecondTurn.turnHistory).toHaveSize(2);
	});

	it('calculates elapsed time for the current turn', () => {
		const battle = service.createBattleFromEncounter(template, undefined, new Date('2026-01-01T10:00:00.000Z'));

		expect(
			service.getCurrentTurnElapsedSeconds(battle, new Date('2026-01-01T10:01:24.000Z'))
		).toBe(84);
	});

	it('expires turn-based conditions automatically on turn advance', () => {
		const battle = service.createBattleFromEncounter(template, undefined, new Date('2026-01-01T10:00:00.000Z'));
		const combatantId = battle.combatants[0].id;
		const withCondition = service.addCondition(battle, combatantId, {
			name: 'stunned',
			label: 'Atordoado / Stunned',
			durationType: 'turns',
			durationTurns: 1,
		});
		const advanced = service.advanceTurn(withCondition, new Date('2026-01-01T10:00:05.000Z'));

		expect(advanced.combatants[0].conditions).toHaveSize(0);
		expect(advanced.turnHistory.at(-1)?.notes).toContain('Atordoado');
	});

	it('expires round-based conditions automatically when the round changes', () => {
		const battle = service.createBattleFromEncounter(template, undefined, new Date('2026-01-01T10:00:00.000Z'));
		const combatantId = battle.combatants[0].id;
		const withCondition = service.addCondition(battle, combatantId, {
			name: 'blessed',
			label: 'Abençoado / Blessed',
			durationType: 'rounds',
			durationRounds: 1,
		});

		const afterFirstTurn = service.advanceTurn(withCondition, new Date('2026-01-01T10:00:05.000Z'));
		const afterSecondTurn = service.advanceTurn(afterFirstTurn, new Date('2026-01-01T10:00:10.000Z'));

		expect(afterSecondTurn.combatants[0].conditions).toHaveSize(0);
	});

	it('applies damage using temporary hit points first', () => {
		const battle = service.createBattleFromEncounter(template);
		const combatantId = battle.combatants[0].id;
		const updated = service.applyDamage(battle, combatantId, 8);

		expect(updated.combatants[0].temporaryHp).toBe(0);
		expect(updated.combatants[0].currentHp).toBe(27);
		expect(updated.combatants[0].defeated).toBeFalse();
	});

	it('applies healing without exceeding max hp and removes defeated when healing above zero', () => {
		const battle = service.createBattleFromEncounter(template);
		const combatantId = battle.combatants[1].id;
		const defeated = service.applyDamage(battle, combatantId, 20);
		const healed = service.applyHealing(defeated, combatantId, 5);

		expect(healed.combatants[1].currentHp).toBe(5);
		expect(healed.combatants[1].defeated).toBeFalse();
	});

	it('returns special abilities to available when cooldown by turns reaches zero', () => {
		const battle = service.createBattleFromEncounter(template);
		const combatantId = battle.combatants[0].id;
		const withAbility = service.addSpecialAbility(battle, combatantId, {
			name: 'Sopro Flamejante',
			rechargeType: 'turns',
			cooldownTurns: 1,
		});
		const abilityId = withAbility.combatants[0].specialAbilities[0].id;
		const used = service.useSpecialAbility(withAbility, combatantId, abilityId);
		const advanced = service.advanceTurn(used, new Date('2026-01-01T10:00:05.000Z'));

		expect(advanced.combatants[0].specialAbilities[0].isAvailable).toBeTrue();
		expect(advanced.turnHistory.at(-1)?.notes).toContain('Sopro Flamejante');
	});

	it('uses and recovers spell slots without exceeding bounds', () => {
		const battle = service.createBattleFromEncounter(template);
		const combatantId = battle.combatants[0].id;
		const enabled = service.enableSpellSlots(battle, combatantId);
		const configured = service.setSpellSlotMax(enabled, combatantId, 1, 4);
		const spent = service.useSpellSlot(configured, combatantId, 1);
		const recovered = service.recoverSpellSlot(spent, combatantId, 1);

		expect(configured.combatants[0].spellSlots[0].max).toBe(4);
		expect(spent.combatants[0].spellSlots[0].used).toBe(1);
		expect(recovered.combatants[0].spellSlots[0].used).toBe(0);
	});
});
