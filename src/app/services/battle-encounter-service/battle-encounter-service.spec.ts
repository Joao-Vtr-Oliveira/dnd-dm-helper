import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Encounter, EncounterParticipant } from '../../models/encounter-model';
import { BattleEncounterService, MAX_BATTLE_TURN_SNAPSHOTS } from './battle-encounter-service';

describe('BattleEncounterService', () => {
	let service: BattleEncounterService;

	const boss: EncounterParticipant = {
		id: 'participant-boss',
		sourceSheetId: 'sheet-boss',
		name: 'Goblin Boss',
		category: 'monster',
		initiative: 18,
		notes: 'Focus the wizard',
		sheet: {
			name: 'Goblin Boss Sheet',
			armorClass: 16,
			maxHp: 30,
			spellSlots: [{ level: 1, max: 2 }],
			spells: [{ id: 'spell-fire', name: 'Fire Bolt', level: 0 }],
			specialAbilities: [
				{
					id: 'fire-breath',
					name: 'Fire Breath',
					recoveryType: 'dice-recharge',
					rechargeDice: 'd6',
					rechargeOn: [5, 6],
				},
			],
			features: [{ id: 'nimble', name: 'Nimble Escape', kind: 'bonus' }],
		},
	};

	const encounter: Encounter = {
		schemaVersion: 1,
		type: 'dnd-dm-helper-encounter',
		id: 'enc-1',
		title: 'Goblin Ambush',
		description: 'A bridge is guarded by goblins.',
		createdAt: 1,
		updatedAt: 1,
		tags: [],
		participants: [
			boss,
			{
				...structuredClone(boss),
				id: 'participant-minion',
				name: 'Goblin Minion',
				initiative: 12,
				sheet: { ...structuredClone(boss.sheet), maxHp: 12 },
			},
		],
		lairActions: [
			{
				id: 'lair-1',
				name: 'Cave Pulse',
				initiative: 20,
				active: true,
				frequency: 'cooldown-rounds',
				cooldownRounds: 2,
			},
		],
		traps: [
			{
				id: 'trap-1',
				name: 'Falling Rocks',
				triggerType: 'initiative',
				initiative: 10,
				active: true,
				frequency: 'every-round',
			},
		],
	};

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
		service = TestBed.inject(BattleEncounterService);
	});

	it('creates isolated runtime combatants from encounter participants', () => {
		const source = structuredClone(encounter);
		const battle = service.createBattleFromEncounter(source, undefined, new Date('2026-01-01T10:00:00Z'));
		const combatant = battle.combatants[0];

		expect(battle.sourceEncounterId).toBe(encounter.id);
		expect(battle.name).toBe(encounter.title);
		expect(battle.description).toBe(encounter.description);
		expect(combatant.sourceParticipantId).toBe(boss.id);
		expect(combatant.sourceSheetId).toBe(boss.sourceSheetId);
		expect(combatant.currentHp).toBe(combatant.maxHp);
		expect(combatant.temporaryHp).toBe(0);
		expect(combatant.spellSlots).toEqual([{ level: 1, max: 2, used: 0 }]);
		expect(combatant.spells).toEqual(boss.sheet.spells);
		expect(combatant.features).toEqual(boss.sheet.features);
		expect(combatant.specialAbilities[0]).toEqual(jasmine.objectContaining({
			id: 'fire-breath', recoveryType: 'dice-recharge', isAvailable: true, usedCount: 0,
			currentCooldownTurns: 0, currentCooldownRounds: 0,
		}));
		expect(combatant.privateNotes).toBe(boss.notes);
		expect(source).toEqual(encounter);
	});

	it('uses participant ids for side and initiative setup while keeping ties stable', () => {
		const battle = service.createBattleFromEncounter(encounter, {
			combatantSides: { 'participant-boss': 'ally', 'participant-minion': 'player' },
			initiativeOverrides: { 'participant-boss': 17, 'participant-minion': 17 },
			initiativeTieBreakerOverrides: { 'participant-boss': 12, 'participant-minion': 16 },
		});

		expect(battle.combatants.map((combatant) => combatant.name)).toEqual([
			'Goblin Minion', 'Goblin Boss',
		]);
		expect(battle.combatants.map((combatant) => combatant.side)).toEqual(['player', 'ally']);
	});

	it('initializes encounter event runtime state without changing the source', () => {
		const battle = service.createBattleFromEncounter(encounter);

		expect(battle.lairActions[0]).toEqual(jasmine.objectContaining({
			id: 'lair-1', currentCooldownRounds: 0, lastTriggeredAtRound: undefined,
		}));
		expect(battle.traps[0]).toEqual(jasmine.objectContaining({
			id: 'trap-1', currentCooldownRounds: 0, lastTriggeredAtRound: undefined,
		}));
		expect('currentCooldownRounds' in encounter.lairActions[0]).toBeFalse();
	});

	it('snapshots and restores the same canonical runtime shape', () => {
		const battle = service.createBattleFromEncounter(encounter);
		const before = structuredClone(battle);
		const advanced = service.advanceTurn(battle, new Date('2026-01-01T10:00:05Z'));
		const restored = service.undoTurn(advanced, new Date('2026-01-01T10:01:00Z'));

		expect(advanced.turnSnapshots).toHaveSize(1);
		expect(advanced.turnSnapshots[0].state.combatants[0].spells).toEqual(before.combatants[0].spells);
		expect(advanced.turnSnapshots[0].state.combatants[0].features).toEqual(before.combatants[0].features);
		expect(restored.combatants).toEqual(before.combatants);
		expect(restored.lairActions).toEqual(before.lairActions);
		expect(restored.traps).toEqual(before.traps);
	});

	it('adds and duplicates canonical participants with fresh runtime state', () => {
		const battle = service.createBattleFromEncounter(encounter);
		const added = service.addCombatantFromParticipant(battle, {
			...structuredClone(boss), id: 'participant-reinforcement', name: 'Cult Fanatic', initiative: 20,
		});
		const original = added.pendingCombatants[0];
		const spent = service.useSpellSlot(added, original.id, 1);
		const duplicated = service.duplicateCombatant(spent, original.id);
		const copy = duplicated.pendingCombatants.find((combatant) => combatant.id !== original.id)!;

		expect(original.sourceParticipantId).toBe('participant-reinforcement');
		expect(original.spells).toEqual(boss.sheet.spells);
		expect(original.features).toEqual(boss.sheet.features);
		expect(copy.currentHp).toBe(copy.maxHp);
		expect(copy.temporaryHp).toBe(0);
		expect(copy.spellSlots[0].used).toBe(0);
		expect(copy.specialAbilities[0].isAvailable).toBeTrue();
	});

	it('keeps damage, conditions, and spell-slot state isolated to the battle', () => {
		const battle = service.createBattleFromEncounter(encounter);
		const combatantId = battle.combatants[0].id;
		const withTemporaryHp = service.updateCombatantHp(battle, combatantId, { temporaryHp: 5 });
		const damaged = service.applyDamage(withTemporaryHp, combatantId, 8);
		const withCondition = service.addCondition(damaged, combatantId, {
			name: 'stunned', label: 'Stunned', durationType: 'turns', durationTurns: 1,
		});
		const advanced = service.advanceTurn(withCondition);
		const spent = service.useSpellSlot(advanced, combatantId, 1);
		const recovered = service.recoverSpellSlot(spent, combatantId, 1);

		expect(damaged.combatants[0]).toEqual(jasmine.objectContaining({
			temporaryHp: 0, currentHp: 27,
		}));
		expect(advanced.combatants[0].conditions).toEqual([]);
		expect(spent.combatants[0].spellSlots[0].used).toBe(1);
		expect(recovered.combatants[0].spellSlots[0].used).toBe(0);
		expect(encounter.participants[0].sheet.spellSlots[0]).toEqual({ level: 1, max: 2 });
	});

	it('keeps dice recharge physical and accepts one recorded result per round', () => {
		const battle = service.createBattleFromEncounter(encounter);
		const combatantId = battle.combatants[0].id;
		const abilityId = battle.combatants[0].specialAbilities[0].id;
		const used = service.useSpecialAbility(battle, combatantId, abilityId);
		const ownerNextTurn = service.advanceTurn(service.advanceTurn(used));
		const resolved = service.recordSpecialAbilityRecharge(ownerNextTurn, combatantId, abilityId, 5)!;

		expect(service.getPendingDiceRechargeAbilities(ownerNextTurn).map((ability) => ability.id)).toEqual([
			abilityId,
		]);
		expect(resolved.success).toBeTrue();
		expect(resolved.battle.combatants[0].specialAbilities[0]).toEqual(jasmine.objectContaining({
			isAvailable: true, lastRechargeRoll: 5, lastRechargeAttemptAtRound: 2,
		}));
		expect(service.recordSpecialAbilityRecharge(resolved.battle, combatantId, abilityId, 6)).toBeNull();
	});

	it('normalizes persisted battles to canonical runtime fields only', () => {
		const normalized = service.normalizeBattleEncounter({
			id: 'battle-1', sourceEncounterId: 'enc-1', name: 'Battle', round: 1, activeTurnIndex: 0,
			createdAt: '2026-01-01T10:00:00Z', startedAt: '2026-01-01T10:00:00Z',
			updatedAt: '2026-01-01T10:00:00Z',
			combatants: [{
				id: 'combatant-1', sourceParticipantId: 'participant-1', name: 'Mage', side: 'enemy',
				initiative: 10, turnOrder: 0, maxHp: 12, currentHp: 12, temporaryHp: 0,
				defeated: false, hidden: false, collapsed: false, spellSlotsCollapsed: true,
				pendingAdd: false, conditions: [],
				specialAbilities: [], spellSlots: [],
				spells: [{ id: 'spell-1', name: 'Magic Missile', level: 1 }],
				features: [{ id: 'feature-1', name: 'Spellcasting', kind: 'spellcasting' }],
			}],
			pendingCombatants: [], lairActions: [], traps: [], turnHistory: [], pendingActions: [], turnSnapshots: [],
		});

		expect(normalized.combatants[0].sourceParticipantId).toBe('participant-1');
		expect(normalized.combatants[0].spells[0].name).toBe('Magic Missile');
		expect(normalized.combatants[0].features[0].name).toBe('Spellcasting');
	});

	it('keeps the configured number of snapshots', () => {
		let battle = service.createBattleFromEncounter(encounter);
		for (let index = 0; index < MAX_BATTLE_TURN_SNAPSHOTS + 1; index += 1) {
			battle = service.advanceTurn(battle);
		}
		expect(battle.turnSnapshots).toHaveSize(MAX_BATTLE_TURN_SNAPSHOTS);
	});
});
