import { TestBed } from '@angular/core/testing';

import { LocalStorageService } from './local-storage-service';

describe('LocalStorageService', () => {
  let service: LocalStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LocalStorageService);
		localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

	it('updates linked encounter and battle names when a sheet name changes and preserves custom names', () => {
		const sheet = service.createSheet({
			title: 'Goblin Shaman',
			category: 'monster',
			data: {
				id: 1,
				name: 'Goblin Shaman',
				initiative: 2,
				healthPoints: 12,
				maxHealthPoints: 12,
				armorClass: 13,
				temporaryHealthPoints: null,
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
		});

		service.createEncounter('Ruins', {
			creatures: [
				{
					id: 1,
					name: 'Goblin Shaman',
					sourceSheetId: sheet.id,
					initiative: 2,
					healthPoints: 12,
					maxHealthPoints: 12,
					armorClass: 13,
					temporaryHealthPoints: null,
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
					name: 'Boss Personalizado',
					sourceSheetId: sheet.id,
					initiative: 1,
					healthPoints: 20,
					maxHealthPoints: 20,
					armorClass: 14,
					temporaryHealthPoints: null,
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
			lairActions: [],
			traps: [],
			round: 0,
			battleCreated: false,
			shareEnabled: false,
			battleTrackerVersion: '5.123.0',
			sharedTimestamp: null,
			loaded: true,
		});

		localStorage.setItem(
			'dnd-dm-helper.battle-encounters.v1',
			JSON.stringify([
				{
					id: 'battle-1',
					sourceEncounterId: 'enc-1',
					name: 'Ruins',
					status: 'active',
					round: 1,
					activeTurnIndex: 0,
					createdAt: '2026-01-01T00:00:00.000Z',
					startedAt: '2026-01-01T00:00:00.000Z',
					updatedAt: '2026-01-01T00:00:00.000Z',
					combatants: [
						{
							id: 'c1',
							sourceSheetId: sheet.id,
							name: 'Goblin Shaman',
							initiative: 12,
							side: 'enemy',
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
							spellSlots: [],
							spells: {},
							sheetFeatures: [],
						},
						{
							id: 'c2',
							sourceSheetId: sheet.id,
							name: 'Goblin Shaman',
							displayName: 'Xamã Elite',
							initiative: 10,
							side: 'enemy',
							turnOrder: 1,
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
							spellSlots: [],
							spells: {},
							sheetFeatures: [],
						},
					],
					pendingCombatants: [],
					lairActions: [],
					traps: [],
					turnHistory: [],
				},
			]),
		);

		service.updateSheet(sheet.id, {
			title: 'Goblin Hexer',
			data: {
				...sheet.data,
				name: 'Goblin Hexer',
			},
		});

		const encounter = service.listEncounters()[0];
		const battle = JSON.parse(localStorage.getItem('dnd-dm-helper.battle-encounters.v1') || '[]')[0];

		expect(encounter.data.creatures[0].name).toBe('Goblin Hexer');
		expect(encounter.data.creatures[1].name).toBe('Boss Personalizado');
		expect(battle.combatants[0].name).toBe('Goblin Hexer');
		expect(battle.combatants[1].name).toBe('Goblin Shaman');
		expect(battle.combatants[1].displayName).toBe('Xamã Elite');
	});
});
