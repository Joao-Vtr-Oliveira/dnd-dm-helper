import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import { BattleEncounterStorageService } from '../battle-encounter-storage-service/battle-encounter-storage-service';
import { AppBackupService } from './app-backup-service';
import { LocalStorageService } from '../local-storage-service/local-storage-service';
import { WorldClockService } from '../WorldClockService/world-clock-service';
import { CampaignContextService } from '../campaign-context-service/campaign-context-service';

describe('AppBackupService', () => {
	let service: AppBackupService;
	let localStorageService: LocalStorageService;
	let battleStorage: BattleEncounterStorageService;
	let worldClock: WorldClockService;
	let campaignContext: CampaignContextService;
	let http: HttpTestingController;

	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		TestBed.configureTestingModule({
			providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
		});
		service = TestBed.inject(AppBackupService);
		localStorageService = TestBed.inject(LocalStorageService);
		battleStorage = TestBed.inject(BattleEncounterStorageService);
		worldClock = TestBed.inject(WorldClockService);
		campaignContext = TestBed.inject(CampaignContextService);
		http = TestBed.inject(HttpTestingController);
		http.expectOne('/rpg_files/campaign-world.json').flush({
			schemaVersion: 1,
			empires: [{ id: 'mornk', name: 'Mornk', aliases: [], sourcePath: 'Mornk.md' }],
			states: [],
			settlements: [],
			organizations: [],
		});
	});

	afterEach(() => http.verify());

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
			externalId: 'npc-cultista',
		});
		worldClock.setSeason('winter');

		const backup = service.exportAll();

		expect(backup.app).toBe('dnd-dm-helper');
		expect(backup.type).toBe('campaign-backup');
		expect(backup.schemaVersion).toBe(1);
		expect(backup.data.encounters).toHaveSize(1);
		expect(backup.data.homebrewSheets).toHaveSize(1);
		expect(backup.data.homebrewSheets[0].externalId).toBe('npc-cultista');
		expect(backup.data.calendar?.season).toBe('winter');
		expect(backup.data.rawLocalStorage[APP_STORAGE_KEYS.encounters]).toBeTruthy();
		expect(backup.data.campaignContext).toEqual({ currentLocation: null });
	});

	it('rejects incompatible JSON during validation', () => {
		const result = service.validateBackup({ foo: 'bar' });

		expect(result.valid).toBeFalse();
		expect(result.error).toBe('JSON inválido ou incompatível.');
	});

	it('accepts legacy calendar payloads without minute and exposes a readable summary', () => {
		const backup = service.exportAll();
		backup.data.calendar = {
			year: 1200,
			season: 'summer',
			day: 3,
			hour: 6,
		} as typeof backup.data.calendar;

		const validation = service.validateBackup(backup);
		const summary = service.buildSummary(backup);

		expect(validation.valid).toBeTrue();
		expect(validation.backup?.data.calendar).toEqual({
			year: 1200,
			season: 'summer',
			day: 3,
			hour: 6,
			minute: 0,
		});
		expect(summary.calendarLabel).toContain('Verão');
	});

	it('restores the calendar from the rawLocalStorage payload when the top-level calendar field is absent', () => {
		const backup = service.exportAll();
		backup.data.calendar = null;
		backup.data.rawLocalStorage[APP_STORAGE_KEYS.worldDate] = JSON.stringify({
			year: 2222,
			season: 'winter',
			day: 15,
			hour: 20,
			minute: 45,
		});

		const validation = service.validateBackup(backup);
		service.applyBackup(backup);

		expect(validation.valid).toBeTrue();
		expect(validation.backup?.data.calendar).toEqual({
			year: 2222,
			season: 'winter',
			day: 15,
			hour: 20,
			minute: 45,
		});
		expect(worldClock.current()).toEqual({
			year: 2222,
			season: 'winter',
			day: 15,
			hour: 20,
			minute: 45,
		});
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

	it('exports, restores, and safety-backs up campaign context immediately', () => {
		campaignContext.setCurrentLocation({ scopeType: 'empire', scopeId: 'mornk' });
		const backup = service.exportAll();
		expect(backup.data.campaignContext).toEqual({
			currentLocation: { scopeType: 'empire', scopeId: 'mornk' },
		});

		service.createSafetyBackupBeforeSync();
		const safetyBackup = JSON.parse(localStorage.getItem(APP_STORAGE_KEYS.safetyBackupBeforeSync) ?? '{}');
		expect(safetyBackup.data.campaignContext.currentLocation.scopeId).toBe('mornk');

		backup.data.campaignContext = { currentLocation: { scopeType: 'empire', scopeId: 'old-mornk' } };
		service.applyBackup(backup);
		expect(campaignContext.currentLocationRef()).toEqual({ scopeType: 'empire', scopeId: 'old-mornk' });
		expect(campaignContext.locationError()).toContain('não encontrada');
	});

	it('uses explicit campaign context before raw storage and clears stale context for old backups', () => {
		const backup = service.exportAll();
		backup.data.campaignContext = { currentLocation: { scopeType: 'empire', scopeId: 'mornk' } };
		backup.data.rawLocalStorage[APP_STORAGE_KEYS.campaignContext] = JSON.stringify({
			currentLocation: { scopeType: 'empire', scopeId: 'raw-mornk' },
		});
		service.applyBackup(backup);
		expect(campaignContext.currentLocationRef()?.scopeId).toBe('mornk');

		campaignContext.setCurrentLocation({ scopeType: 'empire', scopeId: 'mornk' });
		delete backup.data.campaignContext;
		delete backup.data.rawLocalStorage[APP_STORAGE_KEYS.campaignContext];
		service.applyBackup(backup);
		expect(campaignContext.currentLocationRef()).toBeNull();
	});

	it('falls back to raw storage when an older backup has no explicit campaign context', () => {
		const backup = service.exportAll();
		delete backup.data.campaignContext;
		backup.data.rawLocalStorage[APP_STORAGE_KEYS.campaignContext] = JSON.stringify({
			currentLocation: { scopeType: 'empire', scopeId: 'mornk' },
		});
		service.applyBackup(backup);
		expect(campaignContext.currentLocationRef()).toEqual({ scopeType: 'empire', scopeId: 'mornk' });
	});
});
