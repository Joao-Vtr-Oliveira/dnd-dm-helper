import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SavedEncounter } from '../local-storage-service/local-storage-service';
import { BattleEncounterStorageService } from './battle-encounter-storage-service';

describe('BattleEncounterStorageService', () => {
	let service: BattleEncounterStorageService;
	const encounter: SavedEncounter = {
		schemaVersion: 1,
		type: 'dnd-dm-helper-encounter',
		id: 'enc-1',
		title: 'Bridge Ambush',
		description: 'Bandits defend a narrow bridge.',
		createdAt: 1,
		updatedAt: 1,
		tags: [],
		participants: [{
			id: 'bandit-captain', name: 'Bandit Captain', category: 'monster', initiative: 15,
			sheet: {
				name: 'Bandit Captain', armorClass: 15, maxHp: 65, spellSlots: [], spells: [],
				specialAbilities: [], features: [],
			},
		}],
		lairActions: [],
		traps: [],
	};

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
		service = TestBed.inject(BattleEncounterStorageService);
	});

	it('forwards a SavedEncounter directly and persists its description', () => {
		const battle = service.createBattleFromEncounter(encounter);
		const loaded = service.getBattleEncounterById(battle.id);

		expect(battle.sourceEncounterId).toBe(encounter.id);
		expect(battle.description).toBe(encounter.description);
		expect(battle.combatants[0].sourceParticipantId).toBe('bandit-captain');
		expect(loaded).toEqual(battle);
	});

	it('reuses active battles unless concurrent creation is requested', () => {
		const first = service.getOrCreateBattleFromEncounter(encounter);
		const reused = service.getOrCreateBattleFromEncounter(encounter);
		const concurrent = service.getOrCreateBattleFromEncounter(encounter, undefined, true);

		expect(first.kind).toBe('created');
		expect(reused).toEqual(jasmine.objectContaining({ kind: 'existing', battle: first.battle }));
		expect(concurrent.battle.id).not.toBe(first.battle.id);
	});

	it('normalizes legacy persisted runtime data when loading', () => {
		localStorage.setItem('dnd-dm-helper.battle-encounters.v1', JSON.stringify([{
			id: 'old-battle', sourceEncounterId: 'enc-1', name: 'Old Battle', status: 'active', round: 1,
			activeTurnIndex: 0, createdAt: '2026-01-01T10:00:00Z', startedAt: '2026-01-01T10:00:00Z',
			updatedAt: '2026-01-01T10:00:00Z', combatants: [], turnHistory: [],
		}]));

		expect(service.getBattleEncounterById('old-battle')?.turnSnapshots).toEqual([]);
		expect(service.getBattleEncounterById('old-battle')?.pendingActions).toEqual([]);
	});
});
