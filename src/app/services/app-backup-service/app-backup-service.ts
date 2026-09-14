import { Injectable, inject } from '@angular/core';
import type { WorldDate } from '../../models/calendar-model';
import type { BattleEncounter } from '../../models/battle-encounter-model';
import type { FiveEToolsCompositionPackage } from '../../models/fiveetools-homebrew-model';
import type {
	FiveEToolsHomebrewFile,
	FiveEToolsStoredBackup,
} from '../../models/fiveetools-homebrew-model';
import {
	APP_LEGACY_PRIMARY_STORAGE_KEYS,
	APP_PRIMARY_STORAGE_KEYS,
	APP_STORAGE_KEYS,
	isRawBackupStorageKey,
} from '../../constants/app-storage-keys';
import { environment } from '../../../environments/environment';
import { BattleEncounterStorageService } from '../battle-encounter-storage-service/battle-encounter-storage-service';
import {
	EncounterHubFilterService,
	type EncounterHubFilters,
} from '../encounter-hub-filter-service/encounter-hub-filter-service';
import {
	LocalStorageService,
	type SavedEncounter,
	type SavedSheetInterface,
} from '../local-storage-service/local-storage-service';
import { WorldClockService } from '../WorldClockService/world-clock-service';
import {
	normalizeCampaignContext,
	type CampaignContextState,
} from '../../models/campaign-context-model';
import { CampaignContextService } from '../campaign-context-service/campaign-context-service';
import { FiveEToolsHomebrewService } from '../fiveetools-homebrew-service/fiveetools-homebrew-service';

export interface AppBackup {
	app: 'dnd-dm-helper';
	schemaVersion: 2;
	type: 'campaign-backup';
	exportedAt: string;
	data: {
		encounters: SavedEncounter[];
		battleEncounters: BattleEncounter[];
		homebrewSheets: SavedSheetInterface[];
		calendar: WorldDate | null;
		campaignContext?: CampaignContextState | null;
		fiveEToolsHomebrew: FiveEToolsHomebrewFile | null;
		fiveEToolsHomebrewBackups: FiveEToolsStoredBackup[];
		fiveEToolsHomebrewCompositionPackages: FiveEToolsCompositionPackage[];
		settings: {
			encounterHubFilters?: EncounterHubFilters | null;
		};
		rawLocalStorage: Record<string, string>;
	};
}

export interface AppBackupSummary {
	encounters: number | null;
	battleEncounters: number | null;
	homebrewSheets: number | null;
	hasCalendar: boolean;
	calendarLabel: string | null;
	hasCampaignLocation: boolean;
	campaignLocationLabel: string | null;
	exportedAt: string | null;
}

export interface AppBackupValidationResult {
	valid: boolean;
	backup?: AppBackup;
	error?: string;
	summary: AppBackupSummary;
}

@Injectable({ providedIn: 'root' })
export class AppBackupService {
	private readonly localStorageService = inject(LocalStorageService);
	private readonly battleStorage = inject(BattleEncounterStorageService);
	private readonly worldClock = inject(WorldClockService);
	private readonly encounterHubFilterService = inject(EncounterHubFilterService);
	private readonly campaignContext = inject(CampaignContextService);
	private readonly fiveEToolsHomebrew = inject(FiveEToolsHomebrewService);

	exportAll(): AppBackup {
		return {
			app: 'dnd-dm-helper',
			schemaVersion: 2,
			type: 'campaign-backup',
			exportedAt: new Date().toISOString(),
			data: {
				encounters: this.localStorageService.listEncounters(),
				battleEncounters: this.battleStorage.getBattleEncounters(),
				homebrewSheets: this.localStorageService.listSheets(),
				calendar: this.readStoredCalendar(),
				campaignContext: this.campaignContext.getState(),
				fiveEToolsHomebrew: this.fiveEToolsHomebrew.getStoredHomebrewFile(),
				fiveEToolsHomebrewBackups: this.fiveEToolsHomebrew.listBackups(),
				fiveEToolsHomebrewCompositionPackages: this.readStoredCompositionPackages(),
				settings: {
					encounterHubFilters: this.encounterHubFilterService.loadFilters(),
				},
				rawLocalStorage: this.collectProjectStorageEntries(),
			},
		};
	}

	downloadBackup(): void {
		const backup = this.exportAll();
		const json = JSON.stringify(backup, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = this.buildDownloadFileName(backup.exportedAt);
		anchor.click();
		URL.revokeObjectURL(url);
	}

	async fetchRemoteBackup(): Promise<AppBackup> {
		// The bundled asset is published with the app while the GitHub backup may lag behind it.
		// Fetch both and retain the newest valid campaign rather than silently restoring stale sheets.
		const [bundled, remote] = await Promise.allSettled([
			this.fetchBackup('/rpg_files/dnd-dm-helper-backup-v2.json'),
			this.fetchBackup(environment.defaultSyncBackupUrl),
		]);
		const backups = [bundled, remote].flatMap((result) =>
			result.status === 'fulfilled' ? [result.value] : [],
		);
		if (backups.length) {
			return backups.reduce((newest, candidate) =>
				Date.parse(candidate.exportedAt) > Date.parse(newest.exportedAt) ? candidate : newest,
			);
		}
		throw remote.status === 'rejected'
			? remote.reason
			: new Error('Erro ao sincronizar: não foi possível acessar o backup remoto.');
	}

	private async fetchBackup(url: string): Promise<AppBackup> {
		let response: Response;
		try {
			response = await fetch(url, {
				headers: { Accept: 'application/json' },
				cache: 'no-store',
			});
		} catch {
			throw new Error('Erro ao sincronizar: não foi possível acessar o backup remoto.');
		}

		if (!response.ok) {
			throw new Error(`Erro ao sincronizar: backup remoto retornou ${response.status}.`);
		}

		let raw: unknown;
		try {
			raw = await response.json();
		} catch {
			throw new Error('JSON inválido ou incompatível.');
		}

		const validation = this.validateBackup(raw);
		if (!validation.valid || !validation.backup) {
			throw new Error(validation.error ?? 'JSON inválido ou incompatível.');
		}

		return validation.backup;
	}

	validateBackup(raw: unknown): AppBackupValidationResult {
		const invalid = (error: string): AppBackupValidationResult => ({
			valid: false,
			error,
			summary: this.buildSummaryFromUnknown(raw),
		});

		if (!raw || typeof raw !== 'object') return invalid('JSON inválido ou incompatível.');
		const candidate = raw as Partial<AppBackup>;
		if (candidate.app !== 'dnd-dm-helper') return invalid('JSON inválido ou incompatível.');
		if (candidate.type !== 'campaign-backup') return invalid('JSON inválido ou incompatível.');
		if (candidate.schemaVersion !== 2) return invalid('JSON inválido ou incompatível.');
		if (
			typeof candidate.exportedAt !== 'string' ||
			Number.isNaN(Date.parse(candidate.exportedAt))
		) {
			return invalid('JSON inválido ou incompatível.');
		}
		if (!candidate.data || typeof candidate.data !== 'object') {
			return invalid('JSON inválido ou incompatível.');
		}

		const data = candidate.data as Partial<AppBackup['data']>;
		if (!Array.isArray(data.encounters) || !data.encounters.every((item) => this.isSavedEncounter(item))) {
			return invalid('JSON inválido ou incompatível.');
		}
		if (
			!Array.isArray(data.battleEncounters) ||
			!data.battleEncounters.every((item) => this.isBattleEncounter(item))
		) {
			return invalid('JSON inválido ou incompatível.');
		}
		if (!Array.isArray(data.homebrewSheets) || !data.homebrewSheets.every((item) => this.isSavedSheet(item))) {
			return invalid('JSON inválido ou incompatível.');
		}
		if (
			data.fiveEToolsHomebrew != null &&
			!this.fiveEToolsHomebrew.validateHomebrewJson(data.fiveEToolsHomebrew).valid
		) {
			return invalid('JSON inválido ou incompatível.');
		}
		if (
			!Array.isArray(data.fiveEToolsHomebrewBackups) ||
			!data.fiveEToolsHomebrewBackups.every((item) => this.isFiveEToolsStoredBackup(item))
		) {
			return invalid('JSON inválido ou incompatível.');
		}
		if (
			!Array.isArray(data.fiveEToolsHomebrewCompositionPackages) ||
			!data.fiveEToolsHomebrewCompositionPackages.every((item) => this.isCompositionPackage(item))
		) {
			return invalid('JSON inválido ou incompatível.');
		}
		if (data.calendar != null && (!this.isRecord(data.calendar) || !this.normalizeCalendar(data.calendar))) {
			return invalid('JSON inválido ou incompatível.');
		}
		if (
			Object.prototype.hasOwnProperty.call(data, 'campaignContext') &&
			data.campaignContext !== null &&
			!normalizeCampaignContext(data.campaignContext)
		) {
			return invalid('JSON inválido ou incompatível.');
		}
		if (
			data.settings != null &&
			(!this.isRecord(data.settings) ||
				(data.settings.encounterHubFilters != null &&
					!this.isEncounterHubFilters(data.settings.encounterHubFilters)))
		) {
			return invalid('JSON inválido ou incompatível.');
		}
		if (
			!data.rawLocalStorage ||
			typeof data.rawLocalStorage !== 'object' ||
			Array.isArray(data.rawLocalStorage) ||
			!Object.values(data.rawLocalStorage).every((value) => typeof value === 'string')
		) {
			return invalid('JSON inválido ou incompatível.');
		}

		const rawLocalStorage = Object.entries(data.rawLocalStorage).reduce<Record<string, string>>(
			(result, [key, value]) => {
				if (
					typeof value === 'string' &&
					isRawBackupStorageKey(key)
				) {
					result[key] = value;
				}
				return result;
			},
			{},
		);

		const backup: AppBackup = {
			app: 'dnd-dm-helper',
			schemaVersion: 2,
			type: 'campaign-backup',
			exportedAt: candidate.exportedAt,
			data: {
				encounters: data.encounters,
				battleEncounters: data.battleEncounters,
				homebrewSheets: data.homebrewSheets,
				calendar: this.normalizeCalendar(data.calendar),
				campaignContext: data.campaignContext === null ? null : normalizeCampaignContext(data.campaignContext),
				fiveEToolsHomebrew: data.fiveEToolsHomebrew ?? null,
				fiveEToolsHomebrewBackups: data.fiveEToolsHomebrewBackups,
				fiveEToolsHomebrewCompositionPackages: data.fiveEToolsHomebrewCompositionPackages,
				settings: {
					encounterHubFilters:
						data.settings && this.isRecord(data.settings)
							? (data.settings.encounterHubFilters ?? null)
							: null,
				},
				rawLocalStorage,
			},
		};

		return {
			valid: true,
			backup,
			summary: this.buildSummary(backup),
		};
	}

	applyBackup(backup: AppBackup): void {
		const validation = this.validateBackup(backup);
		if (!validation.valid || !validation.backup) {
			throw new Error(validation.error ?? 'JSON inválido ou incompatível.');
		}

		const normalizedBackup = validation.backup;
		localStorage.setItem(
			APP_STORAGE_KEYS.encounters,
			JSON.stringify(normalizedBackup.data.encounters),
		);
		this.fiveEToolsHomebrew.restoreStoredState(
			normalizedBackup.data.fiveEToolsHomebrew,
			normalizedBackup.data.fiveEToolsHomebrewBackups,
		);
		localStorage.setItem(
			APP_STORAGE_KEYS.battleEncounters,
			JSON.stringify(normalizedBackup.data.battleEncounters),
		);
		localStorage.setItem(
			APP_STORAGE_KEYS.sheets,
			JSON.stringify(normalizedBackup.data.homebrewSheets),
		);
		localStorage.setItem(
			APP_STORAGE_KEYS.fiveEToolsHomebrewCompositionPackages,
			JSON.stringify(normalizedBackup.data.fiveEToolsHomebrewCompositionPackages),
		);

		if (normalizedBackup.data.calendar) {
			localStorage.setItem(
				APP_STORAGE_KEYS.worldDate,
				JSON.stringify(normalizedBackup.data.calendar),
			);
			this.worldClock.setDate(normalizedBackup.data.calendar);
		} else {
			this.worldClock.reset();
			localStorage.removeItem(APP_STORAGE_KEYS.worldDate);
		}

		if (normalizedBackup.data.settings.encounterHubFilters) {
			localStorage.setItem(
				APP_STORAGE_KEYS.encounterHubFilters,
				JSON.stringify(normalizedBackup.data.settings.encounterHubFilters),
			);
		} else {
			localStorage.removeItem(APP_STORAGE_KEYS.encounterHubFilters);
		}

		for (const [key, value] of Object.entries(normalizedBackup.data.rawLocalStorage)) {
			if (!isRawBackupStorageKey(key)) continue;
			localStorage.setItem(key, value);
		}

		this.campaignContext.restore(normalizedBackup.data.campaignContext ?? null);

		for (const key of APP_LEGACY_PRIMARY_STORAGE_KEYS) localStorage.removeItem(key);
	}

	createSafetyBackupBeforeSync(): void {
		const backup = this.exportAll();
		localStorage.setItem(APP_STORAGE_KEYS.safetyBackupBeforeSync, JSON.stringify(backup));
	}

	buildSummary(backup: AppBackup): AppBackupSummary {
		return {
			encounters: backup.data.encounters.length,
			battleEncounters: backup.data.battleEncounters.length,
			homebrewSheets: backup.data.homebrewSheets.length,
			hasCalendar: backup.data.calendar != null,
			calendarLabel: this.formatCalendarLabel(backup.data.calendar),
			hasCampaignLocation: backup.data.campaignContext?.currentLocation != null,
			campaignLocationLabel: this.formatCampaignLocation(backup.data.campaignContext ?? null),
			exportedAt: backup.exportedAt,
		};
	}

	private collectProjectStorageEntries(): Record<string, string> {
		const entries: Record<string, string> = {};
		for (let index = 0; index < localStorage.length; index += 1) {
			const key = localStorage.key(index);
			if (!key || !isRawBackupStorageKey(key)) continue;
			const value = localStorage.getItem(key);
			if (value != null) entries[key] = value;
		}
		return entries;
	}

	private buildDownloadFileName(isoString: string): string {
		void isoString;
		return 'dnd-dm-helper-backup-v2.json';
	}

	private readStoredCalendar(): WorldDate | null {
		try {
			const raw = localStorage.getItem(APP_STORAGE_KEYS.worldDate);
			if (!raw) return this.worldClock.current();
			return this.normalizeCalendar(JSON.parse(raw));
		} catch {
			return this.worldClock.current();
		}
	}

	private readStoredCompositionPackages(): FiveEToolsCompositionPackage[] {
		try {
			const raw = localStorage.getItem(APP_STORAGE_KEYS.fiveEToolsHomebrewCompositionPackages);
			if (!raw) return [];
			const parsed: unknown = JSON.parse(raw);
			return Array.isArray(parsed) ? (parsed as FiveEToolsCompositionPackage[]) : [];
		} catch {
			return [];
		}
	}

	private isSavedEncounter(value: unknown): value is SavedEncounter {
		if (!this.isRecord(value)) return false;
		return (
			value['schemaVersion'] === 1 &&
			value['type'] === 'dnd-dm-helper-encounter' &&
			typeof value['id'] === 'string' &&
			typeof value['title'] === 'string' &&
			this.isFiniteNumber(value['createdAt']) &&
			this.isFiniteNumber(value['updatedAt']) &&
			Array.isArray(value['tags']) &&
			value['tags'].every((tag) => typeof tag === 'string') &&
			Array.isArray(value['participants']) &&
			value['participants'].every((participant) => this.isEncounterParticipant(participant)) &&
			Array.isArray(value['lairActions']) &&
			Array.isArray(value['traps'])
		);
	}

	private isEncounterParticipant(value: unknown): boolean {
		if (!this.isRecord(value) || !this.isRecord(value['sheet'])) return false;
		const sheet = value['sheet'];
		return (
			typeof value['id'] === 'string' &&
			typeof value['name'] === 'string' &&
			(value['category'] === 'monster' || value['category'] === 'npc' || value['category'] === 'pc' || value['category'] === 'other') &&
			(value['initiative'] === null || this.isFiniteNumber(value['initiative'])) &&
			(value['sourceSheetId'] === undefined || typeof value['sourceSheetId'] === 'string') &&
			typeof sheet['name'] === 'string' &&
			(sheet['armorClass'] === null || this.isFiniteNumber(sheet['armorClass'])) &&
			this.isFiniteNumber(sheet['maxHp']) &&
			Array.isArray(sheet['spellSlots']) &&
			Array.isArray(sheet['spells']) &&
			Array.isArray(sheet['specialAbilities']) &&
			Array.isArray(sheet['features'])
		);
	}

	private isBattleEncounter(value: unknown): value is BattleEncounter {
		if (!this.isRecord(value)) return false;
		return (
			typeof value['id'] === 'string' &&
			(value['sourceEncounterId'] === undefined || typeof value['sourceEncounterId'] === 'string') &&
			typeof value['name'] === 'string' &&
			(value['status'] === 'active' ||
				value['status'] === 'paused' ||
				value['status'] === 'completed') &&
			this.isFiniteNumber(value['round']) &&
			this.isFiniteNumber(value['activeTurnIndex']) &&
			this.isIsoDate(value['createdAt']) &&
			this.isIsoDate(value['startedAt']) &&
			this.isIsoDate(value['updatedAt']) &&
			Array.isArray(value['combatants']) &&
			Array.isArray(value['pendingCombatants']) &&
			Array.isArray(value['lairActions']) &&
			Array.isArray(value['traps']) &&
			Array.isArray(value['turnHistory']) &&
			Array.isArray(value['pendingActions']) &&
			Array.isArray(value['turnSnapshots'])
		);
	}

	private isSavedSheet(value: unknown): value is SavedSheetInterface {
		if (!this.isRecord(value) || !this.isRecord(value['data'])) return false;
		const data = value['data'];
		return (
			typeof value['id'] === 'string' &&
			(value['externalId'] === undefined || typeof value['externalId'] === 'string') &&
			typeof value['title'] === 'string' &&
			this.isFiniteNumber(value['createdAt']) &&
			this.isFiniteNumber(value['updatedAt']) &&
			(value['category'] === 'monster' ||
				value['category'] === 'npc' ||
				value['category'] === 'pc' ||
				value['category'] === 'other') &&
			Array.isArray(value['tags']) &&
			value['tags'].every((tag) => typeof tag === 'string') &&
			typeof value['source'] === 'string' &&
			typeof data['name'] === 'string' &&
			(data['armorClass'] === null || this.isFiniteNumber(data['armorClass'])) &&
			this.isFiniteNumber(data['maxHp']) &&
			Array.isArray(data['spellSlots']) &&
			Array.isArray(data['spells']) &&
			Array.isArray(data['specialAbilities']) &&
			Array.isArray(data['features'])
		);
	}

	private isCompositionPackage(value: unknown): value is FiveEToolsCompositionPackage {
		if (!this.isRecord(value)) return false;
		return (
			typeof value['id'] === 'string' &&
			typeof value['name'] === 'string' &&
			(value['source'] === undefined || typeof value['source'] === 'string') &&
			(value['description'] === undefined || typeof value['description'] === 'string') &&
			this.isIsoDate(value['createdAt']) &&
			this.isIsoDate(value['updatedAt']) &&
			['trait', 'action', 'bonus', 'reaction', 'legendary', 'spellcasting'].every(
				(key) => value[key] === undefined || Array.isArray(value[key]),
			)
		);
	}

	private isFiveEToolsStoredBackup(value: unknown): value is FiveEToolsStoredBackup {
		if (!this.isRecord(value)) return false;
		return (
			typeof value['id'] === 'string' &&
			typeof value['label'] === 'string' &&
			typeof value['createdAt'] === 'string' &&
			this.fiveEToolsHomebrew.validateHomebrewJson(value['file']).valid
		);
	}

	private isEncounterHubFilters(value: unknown): value is EncounterHubFilters {
		if (!this.isRecord(value)) return false;
		return (
			typeof value['query'] === 'string' &&
			(value['status'] === 'all' ||
				value['status'] === 'prepared' ||
				value['status'] === 'active' ||
				value['status'] === 'paused' ||
				value['status'] === 'completed') &&
			(value['sort'] === 'smart' ||
				value['sort'] === 'recent' ||
				value['sort'] === 'oldest' ||
				value['sort'] === 'updated' ||
				value['sort'] === 'name')
		);
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return !!value && typeof value === 'object' && !Array.isArray(value);
	}

	private isFiniteNumber(value: unknown): value is number {
		return typeof value === 'number' && Number.isFinite(value);
	}

	private isIsoDate(value: unknown): value is string {
		return typeof value === 'string' && !Number.isNaN(Date.parse(value));
	}

	private normalizeCalendar(raw: unknown): WorldDate | null {
		let parsed: unknown = raw;
		if (typeof parsed === 'string') {
			try {
				parsed = JSON.parse(parsed);
			} catch {
				return null;
			}
		}

		if (!parsed || typeof parsed !== 'object') return null;
		const candidate = parsed as Partial<WorldDate>;
		if (
			!this.isFiniteNumber(candidate.year) ||
			!this.isFiniteNumber(candidate.day) ||
			!this.isFiniteNumber(candidate.hour) ||
			!this.isFiniteNumber(candidate.minute) ||
			(candidate.season !== 'spring' &&
				candidate.season !== 'summer' &&
				candidate.season !== 'autumn' &&
				candidate.season !== 'winter')
		) {
			return null;
		}

		return {
			year: candidate.year,
			season: candidate.season,
			day: candidate.day,
			hour: candidate.hour,
			minute: candidate.minute,
		};
	}

	private buildSummaryFromUnknown(raw: unknown): AppBackupSummary {
		if (!raw || typeof raw !== 'object') {
			return {
				encounters: null,
				battleEncounters: null,
				 homebrewSheets: null,
				hasCalendar: false,
				calendarLabel: null,
				hasCampaignLocation: false,
				campaignLocationLabel: null,
				exportedAt: null,
			};
		}

		const candidate = raw as Partial<AppBackup>;
		const data = candidate.data as Partial<AppBackup['data']> | undefined;
		return {
			encounters: Array.isArray(data?.encounters) ? data!.encounters!.length : null,
			battleEncounters: Array.isArray(data?.battleEncounters)
				? data!.battleEncounters!.length
				: null,
			homebrewSheets: Array.isArray(data?.homebrewSheets) ? data!.homebrewSheets!.length : null,
			hasCalendar: !!data?.calendar,
			calendarLabel: this.formatCalendarLabel(this.normalizeCalendar(data?.calendar)),
			hasCampaignLocation: normalizeCampaignContext(data?.campaignContext)?.currentLocation != null,
			campaignLocationLabel: this.formatCampaignLocation(
				normalizeCampaignContext(data?.campaignContext),
			),
			exportedAt:
				typeof candidate.exportedAt === 'string' && !Number.isNaN(Date.parse(candidate.exportedAt))
					? candidate.exportedAt
					: null,
		};
	}

	private formatCalendarLabel(calendar: WorldDate | null): string | null {
		if (!calendar) return null;
		const seasonLabels: Record<WorldDate['season'], string> = {
			spring: 'Primavera',
			summer: 'Verão',
			autumn: 'Outono',
			winter: 'Inverno',
		};
		const seasonLabel = seasonLabels[calendar.season] ?? calendar.season;
		return `${seasonLabel}, Ano ${calendar.year}, Dia ${calendar.day}, ${String(calendar.hour).padStart(2, '0')}:${String(calendar.minute ?? 0).padStart(2, '0')}`;
	}

	private formatCampaignLocation(context: CampaignContextState | null): string | null {
		const location = context?.currentLocation;
		if (!location) return null;
		const typeLabels = {
			empire: 'Império',
			state: 'Estado',
			settlement: 'Localidade',
		} as const;
		const name = location.scopeId
			.split('-')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
		return `${typeLabels[location.scopeType]}: ${name}`;
	}
}
