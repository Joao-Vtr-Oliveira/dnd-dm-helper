import { TestBed } from '@angular/core/testing';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import { BattleEncounterStorageService } from '../battle-encounter-storage-service/battle-encounter-storage-service';
import { AppBackupService } from './app-backup-service';
import { LocalStorageService } from '../local-storage-service/local-storage-service';
import { WorldClockService } from '../WorldClockService/world-clock-service';

describe('AppBackupService', () => {
	let service: AppBackupService;
	let localStorageService: LocalStorageService;
	let battleStorage: BattleEncounterStorageService;
	let worldClock: WorldClockService;

	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		TestBed.configureTestingModule({});
		service = TestBed.inject(AppBackupService);
		localStorageService = TestBed.inject(LocalStorageService);
		battleStorage = TestBed.inject(BattleEncounterStorageService);
		worldClock = TestBed.inject(WorldClockService);
	});

	it('exports the complete project backup in the expected format', () => {
		localStorageService.createEncounter('Goblin Cave', {
			creatures: [],
			creatureIdCount: 0,
			round: 0,
			battleCreated: false,
			shareEnabled: false,
			battleTrackerVersion: '5.123.0',
			sharedTimestamp: null,
			loaded: true,
		});
		localStorageService.createSheet({
			title: 'Cultista',
			category: 'npc',
			tags: ['culto'],
			source: 'Mesa',
			data: {
				id: 1,
				name: 'Cultista',
				initiative: 1,
				healthPoints: 10,
				maxHealthPoints: 10,
				temporaryHealthPoints: 0,
				armorClass: '12',
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
		worldClock.setSeason('winter');

		const backup = service.exportAll();

		expect(backup.app).toBe('dnd-dm-helper');
		expect(backup.type).toBe('campaign-backup');
		expect(backup.schemaVersion).toBe(1);
		expect(backup.data.encounters).toHaveSize(1);
		expect(backup.data.homebrewSheets).toHaveSize(1);
		expect(backup.data.calendar?.season).toBe('winter');
		expect(backup.data.rawLocalStorage[APP_STORAGE_KEYS.encounters]).toBeTruthy();
	});

	it('rejects incompatible JSON during validation', () => {
		const result = service.validateBackup({ foo: 'bar' });

		expect(result.valid).toBeFalse();
		expect(result.error).toBe('JSON inválido ou incompatível.');
	});

	it('creates a safety backup and applies a valid backup', () => {
		const backup = service.exportAll();
		backup.data.encounters = [
			{
				id: 'enc-1',
				title: 'Backup Encounter',
				createdAt: Date.now(),
				updatedAt: Date.now(),
				data: {
					creatures: [],
					creatureIdCount: 0,
					round: 0,
					battleCreated: false,
					shareEnabled: false,
					battleTrackerVersion: '5.123.0',
					sharedTimestamp: null,
					loaded: true,
				},
			},
		];
		backup.data.homebrewSheets = [];
		backup.data.battleEncounters = [];
		backup.data.calendar = {
			year: 1111,
			season: 'autumn',
			day: 7,
			hour: 9,
			minute: 30,
		};

		service.createSafetyBackupBeforeSync();
		service.applyBackup(backup);

		expect(localStorage.getItem(APP_STORAGE_KEYS.safetyBackupBeforeSync)).toBeTruthy();
		expect(localStorageService.listEncounters()[0].title).toBe('Backup Encounter');
		expect(worldClock.current().season).toBe('autumn');
		expect(battleStorage.getBattleEncounters()).toEqual([]);
	});
});
