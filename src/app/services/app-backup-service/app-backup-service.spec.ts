import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { APP_LEGACY_PRIMARY_STORAGE_KEYS, APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
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
			providers: [
				provideZonelessChangeDetection(),
				provideHttpClient(),
				provideHttpClientTesting(),
			],
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
			pointsOfInterest: [],
		});
	});

	afterEach(() => http.verify());

	it('exports the complete project backup in the expected format', () => {
		localStorageService.createEncounter('Goblin Cave', {
			schemaVersion: 1,
			type: 'dnd-dm-helper-encounter',
			description: 'Cultists ambush the party in a cave.',
			tags: ['cult', 'cave'],
			participants: [
				{
					id: 'participant-cultist',
					sourceSheetId: 'sheet-cultist',
					name: 'Cultista',
					category: 'npc',
					initiative: 12,
					sheet: {
						name: 'Cultista',
						armorClass: '12',
						maxHp: 10,
						spellSlots: [],
						spells: [],
						specialAbilities: [],
						features: [],
					},
				},
			],
			lairActions: [],
			traps: [],
		});
		localStorageService.createSheet({
			title: 'Cultista',
			category: 'npc',
			tags: ['culto'],
			source: 'Mesa',
			data: {
				name: 'Cultista',
				armorClass: '12',
				maxHp: 10,
				spellSlots: [],
				spells: [],
				specialAbilities: [],
				features: [],
			},
			externalId: 'npc-cultista',
		});
		worldClock.setSeason('winter');

		const backup = service.exportAll();

		expect(backup.app).toBe('dnd-dm-helper');
		expect(backup.type).toBe('campaign-backup');
		expect(backup.schemaVersion).toBe(2);
		expect(backup.data.encounters).toHaveSize(1);
		expect(backup.data.homebrewSheets).toHaveSize(1);
		expect(backup.data.homebrewSheets[0].externalId).toBe('npc-cultista');
		expect(backup.data.encounters[0]).toEqual(jasmine.objectContaining({
			description: 'Cultists ambush the party in a cave.',
			tags: ['cult', 'cave'],
		}));
		expect(backup.data.encounters[0].participants[0].id).toBe('participant-cultist');
		expect(backup.data.calendar?.season).toBe('winter');
		expect(backup.data.rawLocalStorage[APP_STORAGE_KEYS.encounters]).toBeTruthy();
		expect(backup.data.campaignContext).toEqual({ currentLocation: null });
	});

	it('rejects incompatible JSON during validation', () => {
		const result = service.validateBackup({ foo: 'bar' });

		expect(result.valid).toBeFalse();
		expect(result.error).toBe('JSON inválido ou incompatível.');
	});

	it('accepts canonical calendar payloads and exposes a readable summary', () => {
		const backup = service.exportAll();
		backup.data.calendar = {
			year: 1200,
			season: 'summer',
			day: 3,
			hour: 6,
			minute: 0,
		};

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

	it('rejects V1 backups and malformed canonical encounters', () => {
		const backup = service.exportAll();
		const v1Backup = { ...backup, schemaVersion: 1 };
		backup.data.encounters = [
			{
				schemaVersion: 1,
				type: 'dnd-dm-helper-encounter',
				id: 'invalid-encounter',
				title: 'Invalid',
				createdAt: 1,
				updatedAt: 1,
				tags: [],
				participants: [],
				lairActions: [],
				traps: [],
			},
		] as unknown as typeof backup.data.encounters;
		delete (backup.data.encounters[0] as Partial<(typeof backup.data.encounters)[number]>).participants;

		expect(service.validateBackup(v1Backup).valid).toBeFalse();
		expect(service.validateBackup(backup).valid).toBeFalse();
	});

	it('clears absent calendar and filters instead of using raw storage fallbacks', () => {
		localStorage.setItem(
			APP_STORAGE_KEYS.worldDate,
			JSON.stringify({ year: 2222, season: 'winter', day: 15, hour: 20, minute: 45 }),
		);
		localStorage.setItem(
			APP_STORAGE_KEYS.encounterHubFilters,
			JSON.stringify({ query: 'stale', status: 'active', sort: 'name' }),
		);
		const backup = service.exportAll();
		backup.data.calendar = null;
		backup.data.settings = {};

		service.applyBackup(backup);

		expect(localStorage.getItem(APP_STORAGE_KEYS.worldDate)).toBeNull();
		expect(localStorage.getItem(APP_STORAGE_KEYS.encounterHubFilters)).toBeNull();
		expect(worldClock.current()).toEqual({ year: 1000, season: 'spring', day: 1, hour: 5, minute: 0 });
	});

	it('creates a safety backup and applies a valid backup', () => {
		const backup = service.exportAll();
		backup.data.encounters = [
			{
				schemaVersion: 1,
				type: 'dnd-dm-helper-encounter',
				id: 'enc-1',
				title: 'Backup Encounter',
				createdAt: Date.now(),
				updatedAt: Date.now(),
				description: 'A restored canonical encounter.',
				tags: ['backup'],
				participants: [],
				lairActions: [],
				traps: [],
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
		const safetyBackup = JSON.parse(
			localStorage.getItem(APP_STORAGE_KEYS.safetyBackupBeforeSync) ?? '{}',
		);
		expect(safetyBackup.data.campaignContext.currentLocation.scopeId).toBe('mornk');

		backup.data.campaignContext = {
			currentLocation: { scopeType: 'empire', scopeId: 'old-mornk' },
		};
		service.applyBackup(backup);
		expect(campaignContext.currentLocationRef()).toEqual({
			scopeType: 'empire',
			scopeId: 'old-mornk',
		});
		expect(campaignContext.locationError()).toContain('não encontrada');
	});

	it('exports parsed composition packages and restores them with arbitrary project storage', () => {
		const compositionPackages = [
			{
				id: 'package-1',
				name: 'Cult Tactics',
				source: 'Mesa',
				trait: [],
				action: [],
				bonus: [],
				reaction: [],
				legendary: [],
				spellcasting: [],
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		];
		localStorage.setItem(
			APP_STORAGE_KEYS.fiveEToolsHomebrewCompositionPackages,
			JSON.stringify(compositionPackages),
		);
		localStorage.setItem('dnd-dm-helper.custom-setting.v1', 'preserve-me');
		const backup = service.exportAll();

		expect(backup.data.fiveEToolsHomebrewCompositionPackages).toEqual(compositionPackages);
		expect(backup.data.rawLocalStorage['dnd-dm-helper.custom-setting.v1']).toBe('preserve-me');

		localStorage.removeItem(APP_STORAGE_KEYS.fiveEToolsHomebrewCompositionPackages);
		localStorage.removeItem('dnd-dm-helper.custom-setting.v1');
		service.applyBackup(backup);

		expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEYS.fiveEToolsHomebrewCompositionPackages) ?? '[]')).toEqual(
			compositionPackages,
		);
		expect(localStorage.getItem('dnd-dm-helper.custom-setting.v1')).toBe('preserve-me');
	});

	it('does not export or restore legacy encounter and sheet storage keys', () => {
		for (const key of APP_LEGACY_PRIMARY_STORAGE_KEYS) localStorage.setItem(key, 'legacy-data');
		const backup = service.exportAll();
		for (const key of APP_LEGACY_PRIMARY_STORAGE_KEYS) {
			expect(backup.data.rawLocalStorage[key]).toBeUndefined();
			backup.data.rawLocalStorage[key] = 'do-not-restore';
		}

		service.applyBackup(backup);

		for (const key of APP_LEGACY_PRIMARY_STORAGE_KEYS) {
			expect(localStorage.getItem(key)).toBeNull();
		}
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

	it('does not use raw storage as a V2 campaign context fallback', () => {
		const backup = service.exportAll();
		delete backup.data.campaignContext;
		backup.data.rawLocalStorage[APP_STORAGE_KEYS.campaignContext] = JSON.stringify({
			currentLocation: { scopeType: 'empire', scopeId: 'mornk' },
		});
		service.applyBackup(backup);
		expect(campaignContext.currentLocationRef()).toBeNull();
	});
});
