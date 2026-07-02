import { TestBed } from '@angular/core/testing';
import { BattleEncounterStorageService } from './battle-encounter-storage-service';
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
		TestBed.configureTestingModule({});
		service = TestBed.inject(BattleEncounterStorageService);
	});

	it('creates and loads a battle encounter from localStorage', () => {
		const battle = service.createBattleFromEncounter(encounter);
		const loaded = service.getBattleEncounterById(battle.id);

		expect(loaded?.id).toBe(battle.id);
		expect(service.getBattleEncounters()).toHaveSize(1);
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
						},
					],
					turnHistory: [],
				},
			])
		);

		const loaded = service.getBattleEncounterById('old-battle');

		expect(loaded?.combatants[0].side).toBe('enemy');
		expect(loaded?.combatants[0].specialAbilities).toEqual([]);
		expect(loaded?.combatants[0].spellSlots).toEqual([]);
	});
});
