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
					specialAbilities: [],
					sheetFeatures: [],
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
					specialAbilities: [],
					sheetFeatures: [],
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
		const battle = service.createBattleFromEncounter(
			template,
			undefined,
			new Date('2026-01-01T10:00:00.000Z'),
		);

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

	it('supports overriding initiative before the battle starts', () => {
		const battle = service.createBattleFromEncounter(template, {
			initiativeOverrides: {
				0: 7,
				1: 19,
			},
		});

		expect(battle.combatants[0].name).toBe('Goblin Minion');
		expect(battle.combatants[0].initiative).toBe(19);
		expect(battle.combatants[1].initiative).toBe(7);
	});

	it('orders combatants by initiative', () => {
		const battle = service.createBattleFromEncounter(template);

		expect(battle.combatants.map((combatant) => combatant.name)).toEqual([
			'Goblin Boss',
			'Goblin Minion',
		]);
	});

	it('advances the turn and then advances the round after the last combatant', () => {
		const battle = service.createBattleFromEncounter(
			template,
			undefined,
			new Date('2026-01-01T10:00:00.000Z'),
		);
		const afterFirstTurn = service.advanceTurn(battle, new Date('2026-01-01T10:01:30.000Z'));
		const afterSecondTurn = service.advanceTurn(
			afterFirstTurn,
			new Date('2026-01-01T10:02:00.000Z'),
		);

		expect(afterFirstTurn.activeTurnIndex).toBe(1);
		expect(afterFirstTurn.turnHistory).toHaveSize(1);
		expect(afterSecondTurn.activeTurnIndex).toBe(0);
		expect(afterSecondTurn.round).toBe(2);
		expect(afterSecondTurn.turnHistory).toHaveSize(2);
	});

	it('advances the round when a single combatant wraps back to the start of the order', () => {
		const singleCombatantTemplate: EncounterTemplate = {
			...template,
			data: {
				...template.data,
				creatures: [template.data.creatures[0]],
				creatureIdCount: 1,
			},
		};
		const battle = service.createBattleFromEncounter(
			singleCombatantTemplate,
			undefined,
			new Date('2026-01-01T10:00:00.000Z'),
		);
		const advanced = service.advanceTurn(battle, new Date('2026-01-01T10:00:05.000Z'));

		expect(advanced.round).toBe(2);
		expect(advanced.activeTurnIndex).toBe(0);
	});

	it('calculates elapsed time for the current turn', () => {
		const battle = service.createBattleFromEncounter(
			template,
			undefined,
			new Date('2026-01-01T10:00:00.000Z'),
		);

		expect(service.getCurrentTurnElapsedSeconds(battle, new Date('2026-01-01T10:01:24.000Z'))).toBe(
			84,
		);
	});

	it('expires turn-based conditions automatically on turn advance', () => {
		const battle = service.createBattleFromEncounter(
			template,
			undefined,
			new Date('2026-01-01T10:00:00.000Z'),
		);
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
		const battle = service.createBattleFromEncounter(
			template,
			undefined,
			new Date('2026-01-01T10:00:00.000Z'),
		);
		const combatantId = battle.combatants[0].id;
		const withCondition = service.addCondition(battle, combatantId, {
			name: 'blessed',
			label: 'Abençoado / Blessed',
			durationType: 'rounds',
			durationRounds: 1,
		});

		const afterFirstTurn = service.advanceTurn(withCondition, new Date('2026-01-01T10:00:05.000Z'));
		const afterSecondTurn = service.advanceTurn(
			afterFirstTurn,
			new Date('2026-01-01T10:00:10.000Z'),
		);

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
			recoveryType: 'turn-cooldown',
			cooldownTurns: 1,
		});
		const abilityId = withAbility.combatants[0].specialAbilities[0].id;
		const used = service.useSpecialAbility(withAbility, combatantId, abilityId);
		const advanced = service.advanceTurn(used, new Date('2026-01-01T10:00:05.000Z'));

		expect(advanced.combatants[0].specialAbilities[0].isAvailable).toBeTrue();
		expect(advanced.turnHistory.at(-1)?.notes).toContain('Sopro Flamejante');
	});

	it('exhausts abilities with uses per day after the configured maximum', () => {
		const battle = service.createBattleFromEncounter(template);
		const combatantId = battle.combatants[0].id;
		const withAbility = service.addSpecialAbility(battle, combatantId, {
			name: 'Furia',
			recoveryType: 'uses-per-day',
			maxUses: 1,
		});
		const abilityId = withAbility.combatants[0].specialAbilities[0].id;
		const used = service.useSpecialAbility(withAbility, combatantId, abilityId);

		expect(used.combatants[0].specialAbilities[0].usedCount).toBe(1);
		expect(used.combatants[0].specialAbilities[0].isAvailable).toBeFalse();
	});

	it('rolls recharge 5-6 and restores the ability on success', () => {
		spyOn(Math, 'random').and.returnValue(0.99);
		const battle = service.createBattleFromEncounter(template);
		const combatantId = battle.combatants[0].id;
		const withAbility = service.addSpecialAbility(battle, combatantId, {
			name: 'Sopro Flamejante',
			recoveryType: 'dice-recharge',
			rechargeOn: [5, 6],
		});
		const abilityId = withAbility.combatants[0].specialAbilities[0].id;
		const used = service.useSpecialAbility(withAbility, combatantId, abilityId);
		const rolled = service.rollSpecialAbilityRecharge(used, combatantId, abilityId);

		expect(rolled?.success).toBeTrue();
		expect(rolled?.roll).toBe(6);
		expect(rolled?.battle.combatants[0].specialAbilities[0].isAvailable).toBeTrue();
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

	it('maps spell slots from the source creature into the battle combatant', () => {
		const withSlots: EncounterTemplate = {
			...template,
			data: {
				...template.data,
				creatures: [
					{
						...template.data.creatures[0],
						totalSpellSlots: { '1st': 3, '2nd': 2 },
						usedSpellSlots: { '1st': 1, '2nd': 0 },
					},
				],
			},
		};

		const battle = service.createBattleFromEncounter(withSlots);

		expect(battle.combatants[0].spellSlots[0].max).toBe(3);
		expect(battle.combatants[0].spellSlots[0].used).toBe(1);
		expect(battle.combatants[0].spellSlots[1].max).toBe(2);
	});

	it('preserves spells and ficha data when adding and duplicating combatants', () => {
		const battle = service.createBattleFromEncounter(
			template,
			undefined,
			new Date('2026-01-01T10:00:00.000Z'),
		);
		const withImported = service.addCombatantFromCreature(
			battle,
			{
				id: 77,
				name: 'Cult Fanatic',
				initiative: 14,
				healthPoints: 33,
				maxHealthPoints: 33,
				armorClass: 13,
				temporaryHealthPoints: 0,
				alive: true,
				conditions: [],
				notes: [
					{ id: 99, text: 'Concentra em Hold Person', appliedAtRound: 0, appliedAtSeconds: 0 },
				],
				shared: true,
				hitPointsShared: true,
				totalSpellSlots: { '1st': 4, '2nd': 2 },
				usedSpellSlots: { '1st': 1, '2nd': 0 },
				spells: {
					holdPerson: { label: 'Hold Person', total: 2 },
					spiritualWeapon: { label: 'Spiritual Weapon', total: 1 },
				},
				specialAbilities: [
					{
						id: 'dark-devotion',
						name: 'Dark Devotion',
						description: 'Advantage against being charmed or frightened.',
						rechargeType: 'manual',
					},
				],
				sheetFeatures: [
					{
						id: 'fanatic-spellcasting',
						name: 'Spellcasting',
						description: 'Prepared cleric spells.',
						kind: 'spellcasting',
					},
				],
				category: 'monster',
			},
			undefined,
			new Date('2026-01-01T10:00:01.000Z'),
		);

		expect(withImported.pendingCombatants).toHaveSize(1);
		expect(withImported.pendingCombatants[0].spells['holdPerson']?.label).toBe('Hold Person');
		expect(withImported.pendingCombatants[0].specialAbilities[0].name).toBe('Dark Devotion');
		expect(withImported.pendingCombatants[0].sheetFeatures[0].name).toBe('Spellcasting');

		const duplicated = service.duplicateCombatant(
			withImported,
			withImported.pendingCombatants[0].id,
			new Date('2026-01-01T10:00:02.000Z'),
		);
		const duplicate = duplicated.pendingCombatants.find(
			(combatant) => combatant.id !== withImported.pendingCombatants[0].id,
		);

		expect(duplicate).toBeTruthy();
		expect(duplicate?.currentHp).toBe(33);
		expect(duplicate?.temporaryHp).toBe(0);
		expect(duplicate?.conditions).toEqual([]);
		expect(duplicate?.spells['spiritualWeapon']?.label).toBe('Spiritual Weapon');
		expect(duplicate?.sheetFeatures[0].name).toBe('Spellcasting');
	});

	it('keeps pc category separated from battle side defaults', () => {
		const withPc: EncounterTemplate = {
			...template,
			data: {
				...template.data,
				creatures: [
					{
						...template.data.creatures[0],
						name: 'Cleriga do grupo',
						category: 'pc',
					},
				],
			},
		};

		const battle = service.createBattleFromEncounter(withPc);

		expect(battle.combatants[0].category).toBe('pc');
		expect(battle.combatants[0].side).toBe('player');
	});

	it('starts spell slots collapsed by default when normalizing battles antigas', () => {
		const normalized = service.normalizeBattleEncounter({
			id: 'legacy',
			sourceEncounterId: 'enc-legacy',
			name: 'Legacy Battle',
			round: 1,
			activeTurnIndex: 0,
			createdAt: '2026-01-01T10:00:00.000Z',
			startedAt: '2026-01-01T10:00:00.000Z',
			updatedAt: '2026-01-01T10:00:00.000Z',
			combatants: [
				{
					id: 'c1',
					name: 'Mage',
					side: 'enemy',
					initiative: 10,
					turnOrder: 0,
					maxHp: 12,
					currentHp: 12,
					temporaryHp: 0,
					defeated: false,
					hidden: false,
					collapsed: false,
					spellSlotsCollapsed: true,
					pendingAdd: false,
					conditions: [],
					specialAbilities: [],
					spellSlots: [{ level: 1, max: 3, used: 1 }],
					spells: {},
					sheetFeatures: [],
				},
			],
			turnHistory: [],
		});

		expect(normalized.combatants[0].collapsed).toBeFalse();
		expect(normalized.combatants[0].spellSlotsCollapsed).toBeTrue();
		expect(normalized.pendingCombatants).toEqual([]);
		expect(normalized.lairActions).toEqual([]);
		expect(normalized.traps).toEqual([]);
	});

	it('adds lair actions and traps without treating them as combatants', () => {
		const battle = service.createBattleFromEncounter(template);
		const withLairAction = service.addLairAction(battle, {
			name: 'Olho do Covil',
			initiative: 20,
			frequency: 'every-round',
		});
		const withTrap = service.addTrap(withLairAction, {
			name: 'Dardos da Parede',
			triggerType: 'initiative',
			initiative: 10,
			frequency: 'once',
		});

		expect(withTrap.combatants).toHaveSize(2);
		expect(service.getInitiativeEligibleCombatants(withTrap)).toHaveSize(2);
		expect(withTrap.lairActions).toHaveSize(1);
		expect(withTrap.traps).toHaveSize(1);
	});

	it('queues added combatants for the next round and activates them on round advance', () => {
		const battle = service.createBattleFromEncounter(
			template,
			undefined,
			new Date('2026-01-01T10:00:00.000Z'),
		);
		const withPending = service.addCombatantFromCreature(
			battle,
			{
				id: 99,
				name: 'Wolf Reinforcement',
				initiative: 20,
				healthPoints: 11,
				maxHealthPoints: 11,
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
				category: 'monster',
			},
			undefined,
			new Date('2026-01-01T10:00:01.000Z'),
		);

		expect(withPending.combatants).toHaveSize(2);
		expect(withPending.pendingCombatants).toHaveSize(1);
		expect(withPending.pendingCombatants[0].pendingAdd).toBeTrue();

		const afterFirstTurn = service.advanceTurn(withPending, new Date('2026-01-01T10:00:05.000Z'));
		const afterSecondTurn = service.advanceTurn(
			afterFirstTurn,
			new Date('2026-01-01T10:00:10.000Z'),
		);

		expect(afterSecondTurn.round).toBe(2);
		expect(afterSecondTurn.pendingCombatants).toHaveSize(0);
		expect(afterSecondTurn.combatants[0].name).toBe('Wolf Reinforcement');
	});

	it('applies scheduled initiatives at the start of the next round', () => {
		const battle = service.createBattleFromEncounter(
			template,
			undefined,
			new Date('2026-01-01T10:00:00.000Z'),
		);
		const firstCombatantId = battle.combatants[0].id;
		const secondCombatantId = battle.combatants[1].id;
		const scheduled = service.scheduleCombatantInitiative(battle, secondCombatantId, 25);

		expect(scheduled.combatants[1].nextRoundInitiative).toBe(25);

		const afterFirstTurn = service.advanceTurn(scheduled, new Date('2026-01-01T10:00:05.000Z'));
		const afterSecondTurn = service.advanceTurn(
			afterFirstTurn,
			new Date('2026-01-01T10:00:10.000Z'),
		);

		expect(afterSecondTurn.round).toBe(2);
		expect(afterSecondTurn.combatants[0].id).toBe(secondCombatantId);
		expect(afterSecondTurn.combatants[0].initiative).toBe(25);
		expect(
			afterSecondTurn.combatants.find((combatant) => combatant.id === firstCombatantId)?.initiative,
		).toBe(18);
	});

	it('skips defeated combatants in initiative order', () => {
		const battle = service.createBattleFromEncounter(
			template,
			undefined,
			new Date('2026-01-01T10:00:00.000Z'),
		);
		const defeated = service.setCombatantDefeated(battle, battle.combatants[1].id, true);
		const advanced = service.advanceTurn(defeated, new Date('2026-01-01T10:00:10.000Z'));

		expect(advanced.round).toBe(2);
		expect(advanced.activeTurnIndex).toBe(0);
		expect(service.getCurrentCombatant(advanced)?.id).toBe(defeated.combatants[0].id);
	});

	it('returns revived combatants to initiative only on the next round', () => {
		const battle = service.createBattleFromEncounter(
			template,
			undefined,
			new Date('2026-01-01T10:00:00.000Z'),
		);
		const defeated = service.applyDamage(battle, battle.combatants[1].id, 99);
		const revived = service.applyHealing(defeated, battle.combatants[1].id, 5);

		expect(revived.combatants[1].defeated).toBeFalse();
		expect(revived.combatants[1].inactiveUntilRound).toBe(2);
		expect(service.getInitiativeEligibleCombatants(revived)).toHaveSize(1);

		const afterFirstTurn = service.advanceTurn(revived, new Date('2026-01-01T10:00:05.000Z'));
		expect(afterFirstTurn.round).toBe(2);
		expect(service.getInitiativeEligibleCombatants(afterFirstTurn)).toHaveSize(2);
	});

	it('stops initiative safely when every combatant is defeated', () => {
		const battle = service.createBattleFromEncounter(
			template,
			undefined,
			new Date('2026-01-01T10:00:00.000Z'),
		);
		let nextBattle = battle;
		for (const combatant of battle.combatants) {
			nextBattle = service.setCombatantDefeated(nextBattle, combatant.id, true);
		}

		const advanced = service.advanceTurn(nextBattle, new Date('2026-01-01T10:00:05.000Z'));

		expect(service.getInitiativeEligibleCombatants(advanced)).toEqual([]);
		expect(service.getCurrentCombatant(advanced)).toBeNull();
		expect(advanced.activeTurnIndex).toBe(-1);
	});
});
