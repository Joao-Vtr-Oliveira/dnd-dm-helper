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
			calendar: {
				daysPerSeason: 30,
				seasons: [
					{ id: 'spring', label: 'Primavera', color: '#9ae6b4' },
					{ id: 'summer', label: 'Verão', color: '#f6e05e' },
					{ id: 'autumn', label: 'Outono', color: '#f6ad55' },
					{ id: 'winter', label: 'Inverno', color: '#90cdf4' },
				],
				epochDate: { year: 1000, season: 'spring', day: 1, hour: 5, minute: 0 },
				events: [],
			},
			empires: [{ id: 'mornk', name: 'Mornk', aliases: [], sourcePath: 'Mornk.md' }],
			states: [
				{
					id: 'nagazav',
					name: 'Nagazav',
					empireId: 'mornk',
					aliases: [],
					sourcePath: 'Nagazav.md',
				},
			],
			settlements: [
				{
					id: 'nagawoods',
					name: 'Nagawoods',
					stateId: 'nagazav',
					settlementType: 'village',
					aliases: [],
					sourcePath: 'Nagawoods.md',
				},
			],
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
			archived: true,
			locationRefs: [{ scopeType: 'settlement', scopeId: 'nagawoods', relation: 'occurrence' }],
			organizationRefs: [{ organizationId: 'winterhold', relation: 'affiliated' }],
			participants: [
				{
					id: 'participant-cultist',
					sourceSheetId: 'sheet-cultist',
					name: 'Cultista',
					category: 'npc',
					initiative: 12,
					sheet: {
						name: 'Cultista',
						armorClass: 12,
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
			classes: ['ranger'],
			tags: ['culto'],
			source: 'Mesa',
			data: {
				name: 'Cultista',
				armorClass: 12,
				maxHp: 10,
				spellSlots: [],
				spells: [],
				specialAbilities: [],
				features: [],
			},
			externalId: 'npc-cultista',
			generic: false,
			locationRefs: [{ scopeType: 'state', scopeId: 'feng', relation: 'base' }],
			organizationRefs: [{ organizationId: 'guard', relation: 'institution' }],
		});
		worldClock.setSeason('winter');

		const backup = service.exportAll();

		expect(backup.app).toBe('dnd-dm-helper');
		expect(backup.type).toBe('campaign-backup');
		expect(backup.schemaVersion).toBe(2);
		expect(backup.data.encounters).toHaveSize(1);
		expect(backup.data.homebrewSheets).toHaveSize(1);
		expect(backup.data.homebrewSheets[0].externalId).toBe('npc-cultista');
		expect(backup.data.homebrewSheets[0].classes).toEqual(['ranger']);
		expect(backup.data.homebrewSheets[0].generic).toBeFalse();
		expect(backup.data.homebrewSheets[0].locationRefs).toEqual([
			{ scopeType: 'state', scopeId: 'feng', relation: 'base' },
		]);
		expect(backup.data.encounters[0]).toEqual(jasmine.objectContaining({
			description: 'Cultists ambush the party in a cave.',
			tags: ['cult', 'cave'],
			archived: true,
			locationRefs: [{ scopeType: 'settlement', scopeId: 'nagawoods', relation: 'occurrence' }],
			organizationRefs: [{ organizationId: 'winterhold', relation: 'affiliated' }],
		}));
		expect(backup.data.encounters[0].participants[0].id).toBe('participant-cultist');
		expect(backup.data.calendar?.season).toBe('winter');
		expect(backup.data.rawLocalStorage).toEqual({});
		expect(backup.data.campaignContext).toEqual({ currentLocation: null });

		service.applyBackup(backup);
		const restoredEncounter = localStorageService.listEncounters()[0];
		expect(restoredEncounter.archived).toBeTrue();
		expect(restoredEncounter.locationRefs).toEqual([
			{ scopeType: 'settlement', scopeId: 'nagawoods', relation: 'occurrence' },
		]);
		expect(restoredEncounter.organizationRefs).toEqual([
			{ organizationId: 'winterhold', relation: 'affiliated' },
		]);
		const restored = localStorageService.listSheets()[0];
		expect(restored.generic).toBeFalse();
		expect(restored.locationRefs).toEqual([
			{ scopeType: 'state', scopeId: 'feng', relation: 'base' },
		]);
		expect(restored.organizationRefs).toEqual([
			{ organizationId: 'guard', relation: 'institution' },
		]);
		expect(restored.classes).toEqual(['ranger']);
		expect('locationRefs' in restored.data).toBeFalse();
		expect('organizationRefs' in restored.data).toBeFalse();
	});

	it('rejects incompatible JSON during validation', () => {
		const result = service.validateBackup({ foo: 'bar' });

		expect(result.valid).toBeFalse();
		expect(result.error).toBe('JSON inválido ou incompatível.');
	});

	it('accepts the tracked V2 backup served by the application', async () => {
		const response = await fetch('/rpg_files/dnd-dm-helper-backup-v2.json');
		expect(response.ok).withContext(`asset returned ${response.status}`).toBeTrue();
		const backup = await response.json();
		const validation = service.validateBackup(backup);
		const validators = service as unknown as {
			isSavedEncounter(value: unknown): boolean;
			isBattleEncounter(value: unknown): boolean;
			isSavedSheet(value: unknown): boolean;
		};
		const collections: Array<[string, unknown[], (item: unknown) => boolean]> = [
			['encounters', backup.data.encounters, (item) => validators.isSavedEncounter(item)],
			['battleEncounters', backup.data.battleEncounters, (item) => validators.isBattleEncounter(item)],
			['homebrewSheets', backup.data.homebrewSheets, (item) => validators.isSavedSheet(item)],
		];
		const invalidCollections = collections
			.filter(([, items, validator]) => items.some((item) => !validator(item)))
			.map(([name]) => name);

		expect(validation.valid)
			.withContext(`${validation.error ?? 'unknown validation error'}: ${invalidCollections.join(', ')}`)
			.toBeTrue();
		expect(validation.summary).toEqual(jasmine.objectContaining({
			encounters: 7,
			battleEncounters: 5,
			homebrewSheets: 19,
			hasCampaignLocation: true,
			campaignLocationLabel: 'Localidade: Nagawoods',
		}));
	});

	it('restores the tracked backup position for the campaign clock and world', async () => {
		const response = await fetch('/rpg_files/dnd-dm-helper-backup-v2.json');
		service.applyBackup(await response.json());

		expect(campaignContext.currentLocationRef()).toEqual({
			scopeType: 'settlement',
			scopeId: 'nagawoods',
		});
		expect(campaignContext.resolvedCurrentLocation()?.breadcrumb).toEqual([
			'Mornk',
			'Nagazav',
			'Nagawoods',
		]);
		expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEYS.campaignContext) ?? '{}')).toEqual({
			currentLocation: { scopeType: 'settlement', scopeId: 'nagawoods' },
		});
	});

	it('falls back to the bundled V2 backup when the remote backup is incompatible', async () => {
		const nativeFetch = window.fetch.bind(window);
		const fetchSpy = spyOn(window, 'fetch').and.callFake((input, init) => {
			if (String(input).includes('raw.githubusercontent.com')) {
				return Promise.resolve(
					new Response(JSON.stringify({ schemaVersion: 1 }), {
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					}),
				);
			}
			return nativeFetch(input, init);
		});

		const backup = await service.fetchRemoteBackup();

		expect(backup.schemaVersion).toBe(2);
		expect(fetchSpy.calls.allArgs().some(([url]) => url === '/rpg_files/dnd-dm-helper-backup-v2.json'))
			.toBeTrue();
	});

	it('prefers a newer bundled backup over a stale remote backup', async () => {
		const nativeFetch = window.fetch.bind(window);
		const bundled = await nativeFetch('/rpg_files/dnd-dm-helper-backup-v2.json').then((response) =>
			response.json(),
		);
		const staleRemote = { ...bundled, exportedAt: '2026-01-01T00:00:00.000Z' };
		spyOn(window, 'fetch').and.callFake((input, init) => {
			if (String(input).includes('raw.githubusercontent.com')) {
				return Promise.resolve(
					new Response(JSON.stringify(staleRemote), {
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					}),
				);
			}
			return nativeFetch(input, init);
		});

		const backup = await service.fetchRemoteBackup();

		expect(backup.exportedAt).toBe(bundled.exportedAt);
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

	it('resolves the party location name from the imported world in a sync summary', () => {
		const backup = service.exportAll();
		backup.data.campaignContext = {
			currentLocation: { scopeType: 'settlement', scopeId: 'rockbell' },
		};
		const world = {
			settlements: [{ id: 'rockbell', name: 'Rockbell' }],
		} as unknown as import('../../models/campaign-world-model').CampaignWorld;

		expect(service.buildSummary(backup, world).campaignLocationLabel).toBe('Localidade: Rockbell');
		expect(
			service.buildSummary(backup, {
				settlements: [],
			} as unknown as import('../../models/campaign-world-model').CampaignWorld)
				.campaignLocationLabel,
		).toBe('Localidade: não encontrada no Mundo importado');
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

	it('exports parsed composition packages without duplicating formal project storage', () => {
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
		const backup = service.exportAll();

		expect(backup.data.fiveEToolsHomebrewCompositionPackages).toEqual(compositionPackages);
		expect(backup.data.rawLocalStorage).toEqual({});

		localStorage.removeItem(APP_STORAGE_KEYS.fiveEToolsHomebrewCompositionPackages);
		service.applyBackup(backup);

		expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEYS.fiveEToolsHomebrewCompositionPackages) ?? '[]')).toEqual(
			compositionPackages,
		);
		expect(localStorage.getItem('dnd-dm-helper.custom-setting.v1')).toBeNull();
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

	it('exports the same formal data after restore without reintroducing raw duplicates', () => {
		localStorageService.createSheet({
			title: 'Guard', category: 'npc', tags: [], source: 'Mesa',
			data: { name: 'Guard', armorClass: 15, maxHp: 11, spellSlots: [], spells: [], specialAbilities: [], features: [] },
		});
		const backup = service.exportAll();

		service.applyBackup(backup);
		const reexported = service.exportAll();

		expect(reexported.data).toEqual(backup.data);
		expect(reexported.data.rawLocalStorage).toEqual({});
	});

	it('restores older V2 records that do not have contextual metadata', () => {
		const backup = service.exportAll();
		backup.data.homebrewSheets = backup.data.homebrewSheets.map((sheet) => {
			const legacy = { ...sheet } as Record<string, unknown>;
			delete legacy['archived'];
			delete legacy['generic'];
			delete legacy['classes'];
			delete legacy['locationRefs'];
			delete legacy['organizationRefs'];
			return legacy as unknown as typeof sheet;
		});
		backup.data.encounters = backup.data.encounters.map((encounter) => {
			const legacy = { ...encounter } as Record<string, unknown>;
			delete legacy['archived'];
			delete legacy['locationRefs'];
			delete legacy['organizationRefs'];
			return legacy as unknown as typeof encounter;
		});

		expect(service.validateBackup(backup).valid).toBeTrue();
		service.applyBackup(backup);
		expect(service.exportAll().data.homebrewSheets.every((sheet) => !('locationRefs' in sheet))).toBeTrue();
		expect(service.exportAll().data.encounters.every((encounter) => !('locationRefs' in encounter))).toBeTrue();
	});

	it('keeps contextual metadata in preparation while restoring a battle as runtime-only data', () => {
		const sheet = localStorageService.createSheet({
			title: 'Contextual Guard',
			category: 'npc',
			classes: ['ranger'],
			locationRefs: [{ scopeType: 'settlement', scopeId: 'old-town', relation: 'base' }],
			organizationRefs: [{ organizationId: 'guard', relation: 'member' }],
			tags: [],
			source: 'Mesa',
			data: {
				name: 'Contextual Guard', armorClass: 12, maxHp: 10, spellSlots: [], spells: [],
				specialAbilities: [], features: [],
			},
		});
		const encounter = localStorageService.createEncounter('Contextual Patrol', {
			schemaVersion: 1,
			type: 'dnd-dm-helper-encounter',
			tags: [],
			locationRefs: [{ scopeType: 'settlement', scopeId: 'old-town', relation: 'occurrence' }],
			organizationRefs: [{ organizationId: 'guard', relation: 'institution' }],
			participants: [{
				id: 'participant-guard', sourceSheetId: sheet.id, name: sheet.data.name, category: 'npc', initiative: 10,
				sheet: structuredClone(sheet.data),
			}],
			lairActions: [], traps: [],
		});
		const battle = battleStorage.createBattleFromEncounter(encounter);
		const backup = service.exportAll();

		service.applyBackup(backup);
		const restoredBattle = battleStorage.getBattleEncounterById(battle.id)!;

		expect(service.exportAll().data.homebrewSheets[0].locationRefs).toEqual([
			{ scopeType: 'settlement', scopeId: 'old-town', relation: 'base' },
		]);
		expect(service.exportAll().data.encounters[0].organizationRefs).toEqual([
			{ organizationId: 'guard', relation: 'institution' },
		]);
		expect('locationRefs' in restoredBattle).toBeFalse();
		expect('organizationRefs' in restoredBattle).toBeFalse();
		expect(restoredBattle.combatants.every((item) => !('locationRefs' in item))).toBeTrue();
		expect(restoredBattle.referenceSheets.every((item) => !('organizationRefs' in item.sheet))).toBeTrue();
	});
});
