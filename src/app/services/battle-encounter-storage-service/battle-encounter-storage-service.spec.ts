import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BattleEncounterStorageService } from './battle-encounter-storage-service';
import { BattleEncounterService } from '../battle-encounter-service/battle-encounter-service';
import type { SavedEncounter } from '../local-storage-service/local-storage-service';

describe('BattleEncounterStorageService', () => {
	let service: BattleEncounterStorageService;

	const encounter: SavedEncounter = {
		id: 'enc-1',
		title: 'Bridge Ambush',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		data: {
			creatures: [
				{
					id: 0,
					name: 'Bandit Captain',
					initiative: 15,
					healthPoints: 65,
					maxHealthPoints: 65,
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
				},
			],
			creatureIdCount: 1,
			lairActions: [],
			traps: [],
			round: 0,
			battleCreated: false,
			shareEnabled: false,
			battleTrackerVersion: '5.123.0',
			sharedTimestamp: null,
			loaded: true,
		},
	};

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			providers: [provideZonelessChangeDetection()],
		});
		service = TestBed.inject(BattleEncounterStorageService);
	});

	it('creates and loads a battle encounter from localStorage', () => {
		const battle = service.createBattleFromEncounter(encounter);
		const loaded = service.getBattleEncounterById(battle.id);

		expect(loaded?.id).toBe(battle.id);
		expect(service.getBattleEncounters()).toHaveSize(1);
	});

	it('persists turn snapshots so undo remains available after reload', () => {
		const battle = service.createBattleFromEncounter(encounter);
		const advanced = TestBed.inject(BattleEncounterService).advanceTurn(battle);
		service.saveBattleEncounter(advanced);

		const reloaded = service.getBattleEncounterById(battle.id);
		expect(reloaded?.turnSnapshots).toHaveSize(1);
		expect(reloaded && TestBed.inject(BattleEncounterService).undoTurn(reloaded).activeTurnIndex).toBe(0);
	});

	it('persists unresolved concentration checks and removes them after resolution', () => {
		const battleService = TestBed.inject(BattleEncounterService);
		const battle = service.createBattleFromEncounter(encounter);
		const combatantId = battle.combatants[0].id;
		const concentrating = battleService.startConcentration(battle, combatantId);
		const damaged = battleService.applyDamage(concentrating, combatantId, 28);
		service.saveBattleEncounter(damaged);

		const reloaded = service.getBattleEncounterById(battle.id)!;
		expect(reloaded.pendingActions).toHaveSize(1);
		expect(reloaded.pendingActions[0].type).toBe('concentration-check');

		const resolved = battleService.resolveConcentrationCheck(reloaded, reloaded.pendingActions[0].id, true)!;
		service.saveBattleEncounter(resolved.battle);
		expect(service.getBattleEncounterById(battle.id)?.pendingActions).toEqual([]);
	});

	it('finds the active battle by encounter id', () => {
		const battle = service.createBattleFromEncounter(encounter);

		expect(service.getActiveBattleByEncounterId(encounter.id)?.id).toBe(battle.id);
	});

	it('keeps completed battles saved but out of active shortcuts', () => {
		const battle = service.createBattleFromEncounter(encounter);
		service.completeBattleEncounter(battle.id);

		expect(service.getBattleEncounterById(battle.id)?.status).toBe('completed');
		expect(service.getActiveBattleByEncounterId(encounter.id)).toBeNull();
	});

	it('reuses an ongoing battle unless concurrent creation is explicit', () => {
		const first = service.getOrCreateBattleFromEncounter(encounter);
		const reused = service.getOrCreateBattleFromEncounter(encounter);
		const concurrent = service.getOrCreateBattleFromEncounter(encounter, undefined, true);

		expect(first.kind).toBe('created');
		expect(reused.kind).toBe('existing');
		expect(reused.battle.id).toBe(first.battle.id);
		expect(concurrent.kind).toBe('created');
		expect(concurrent.battle.id).not.toBe(first.battle.id);
	});

	it('creates a new battle when the previous battle is completed', () => {
		const first = service.createBattleFromEncounter(encounter);
		service.completeBattleEncounter(first.id);

		const next = service.getOrCreateBattleFromEncounter(encounter);

		expect(next.kind).toBe('created');
		expect(next.battle.id).not.toBe(first.id);
	});

	it('deletes all battles associated to an encounter', () => {
		service.createBattleFromEncounter(encounter);
		service.createBattleFromEncounter({
			...encounter,
			id: 'enc-2',
			title: 'Forest Chase',
		});

		service.deleteBattlesByEncounterId(encounter.id);

		expect(service.getBattlesByEncounterId(encounter.id)).toEqual([]);
		expect(service.getBattleEncounters()).toHaveSize(1);
	});

	it('migrates older battles safely when loading from localStorage', () => {
		localStorage.setItem(
			'dnd-dm-helper.battle-encounters.v1',
			JSON.stringify([
				{
					id: 'old-battle',
					sourceEncounterId: 'enc-1',
					name: 'Old Battle',
					status: 'active',
					round: 1,
					activeTurnIndex: 0,
					createdAt: '2026-01-01T10:00:00.000Z',
					startedAt: '2026-01-01T10:00:00.000Z',
					updatedAt: '2026-01-01T10:00:00.000Z',
					combatants: [
						{
							id: 'c1',
							name: 'Legacy Goblin',
							initiative: 12,
							turnOrder: 0,
							maxHp: 10,
							currentHp: 10,
						temporaryHp: 0,
						defeated: false,
						hidden: false,
						conditions: [],
						specialAbilities: [
							{
								id: 'legacy-ability',
								name: 'Legacy Breath',
								rechargeType: 'dice',
								isAvailable: false,
								lastRechargeRoll: 3,
								lastRechargeAttemptAtRound: 1,
							},
						],
					},
				],
				turnHistory: [],
				},
			])
		);

		const loaded = service.getBattleEncounterById('old-battle');

		expect(loaded?.combatants[0].side).toBe('enemy');
		expect(loaded?.combatants[0].specialAbilities[0].recoveryType).toBe('dice-recharge');
		expect(loaded?.combatants[0].specialAbilities[0].lastRechargeAttemptAtRound).toBe(1);
		expect(loaded?.combatants[0].specialAbilities[0].lastRechargeRoll).toBe(3);
		expect(loaded?.combatants[0].spellSlots).toEqual([]);
		expect(loaded?.lairActions).toEqual([]);
		expect(loaded?.traps).toEqual([]);
		expect(loaded?.turnSnapshots).toEqual([]);
		expect(loaded?.pendingActions).toEqual([]);
	});
});
