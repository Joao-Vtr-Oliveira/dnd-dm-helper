import { Injectable, inject } from '@angular/core';
import type { WorldDate } from '../../models/calendar-model';
import type { BattleEncounter } from '../../models/battle-encounter-model';
import {
	APP_POST_SYNC_TOAST_SESSION_KEY,
	APP_PRIMARY_STORAGE_KEYS,
	APP_STORAGE_KEYS,
	isProjectStorageKey,
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

export interface AppBackup {
	app: 'dnd-dm-helper';
	schemaVersion: 1;
	type: 'campaign-backup';
	exportedAt: string;
	data: {
		encounters: SavedEncounter[];
		battleEncounters: BattleEncounter[];
		homebrewSheets: SavedSheetInterface[];
		calendar: WorldDate | null;
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

	exportAll(): AppBackup {
		return {
			app: 'dnd-dm-helper',
			schemaVersion: 1,
			type: 'campaign-backup',
			exportedAt: new Date().toISOString(),
			data: {
				encounters: this.localStorageService.listEncounters(),
				battleEncounters: this.battleStorage.getBattleEncounters(),
				homebrewSheets: this.localStorageService.listSheets(),
				calendar: this.readStoredCalendar(),
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
		let response: Response;
		try {
			response = await fetch(environment.defaultSyncBackupUrl, {
				headers: { Accept: 'application/json' },
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
		if (candidate.schemaVersion !== 1) return invalid('JSON inválido ou incompatível.');
		if (
			typeof candidate.exportedAt !== 'string' ||
			Number.isNaN(Date.parse(candidate.exportedAt))
		) {
			return invalid('JSON inválido ou incompatível.');
		}
		if (!candidate.data || typeof candidate.data !== 'object') {
			return invalid('JSON inválido ou incompatível.');
		}

		const data = candidate.data as AppBackup['data'];
		if (!Array.isArray(data.encounters)) return invalid('JSON inválido ou incompatível.');
		if (!Array.isArray(data.battleEncounters)) return invalid('JSON inválido ou incompatível.');
		if (!Array.isArray(data.homebrewSheets)) return invalid('JSON inválido ou incompatível.');
		if (data.calendar != null && typeof data.calendar !== 'object') {
			return invalid('JSON inválido ou incompatível.');
		}
		if (
			!data.rawLocalStorage ||
			typeof data.rawLocalStorage !== 'object' ||
			Array.isArray(data.rawLocalStorage)
		) {
			return invalid('JSON inválido ou incompatível.');
		}

		const backup: AppBackup = {
			app: 'dnd-dm-helper',
			schemaVersion: 1,
			type: 'campaign-backup',
			exportedAt: candidate.exportedAt,
			data: {
				encounters: data.encounters,
				battleEncounters: data.battleEncounters,
				homebrewSheets: data.homebrewSheets,
				calendar: this.resolveCalendarFromBackupData(data),
				settings: {
					encounterHubFilters:
						data.settings && typeof data.settings === 'object'
							? (data.settings.encounterHubFilters ?? null)
							: null,
				},
				rawLocalStorage: Object.entries(data.rawLocalStorage).reduce<Record<string, string>>(
					(result, [key, value]) => {
						if (typeof key === 'string' && typeof value === 'string' && isProjectStorageKey(key)) {
							result[key] = value;
						}
						return result;
					},
					{},
				),
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
		localStorage.setItem(
			APP_STORAGE_KEYS.battleEncounters,
			JSON.stringify(normalizedBackup.data.battleEncounters),
		);
		localStorage.setItem(
			APP_STORAGE_KEYS.sheets,
			JSON.stringify(normalizedBackup.data.homebrewSheets),
		);

		if (normalizedBackup.data.calendar) {
			localStorage.setItem(
				APP_STORAGE_KEYS.worldDate,
				JSON.stringify(normalizedBackup.data.calendar),
			);
			this.worldClock.setDate(normalizedBackup.data.calendar);
		}

		if (normalizedBackup.data.settings.encounterHubFilters) {
			localStorage.setItem(
				APP_STORAGE_KEYS.encounterHubFilters,
				JSON.stringify(normalizedBackup.data.settings.encounterHubFilters),
			);
		}

		for (const [key, value] of Object.entries(normalizedBackup.data.rawLocalStorage)) {
			if (!isProjectStorageKey(key)) continue;
			if (APP_PRIMARY_STORAGE_KEYS.includes(key as (typeof APP_PRIMARY_STORAGE_KEYS)[number]))
				continue;
			if (key === APP_STORAGE_KEYS.safetyBackupBeforeSync) continue;
			localStorage.setItem(key, value);
		}
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
			exportedAt: backup.exportedAt,
		};
	}

	storePostSyncToast(message: string): void {
		sessionStorage.setItem(APP_POST_SYNC_TOAST_SESSION_KEY, message);
	}

	consumePostSyncToast(): string | null {
		const message = sessionStorage.getItem(APP_POST_SYNC_TOAST_SESSION_KEY);
		if (message) sessionStorage.removeItem(APP_POST_SYNC_TOAST_SESSION_KEY);
		return message;
	}

	private collectProjectStorageEntries(): Record<string, string> {
		const entries: Record<string, string> = {};
		for (let index = 0; index < localStorage.length; index += 1) {
			const key = localStorage.key(index);
			if (!key || !isProjectStorageKey(key)) continue;
			if (key === APP_STORAGE_KEYS.safetyBackupBeforeSync) continue;
			const value = localStorage.getItem(key);
			if (value != null) entries[key] = value;
		}
		return entries;
	}

	private buildDownloadFileName(isoString: string): string {
		void isoString;
		return 'dnd-dm-helper-backup.json';
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

	private resolveCalendarFromBackupData(
		data: Partial<AppBackup['data']> | undefined,
	): WorldDate | null {
		const directCalendar = this.normalizeCalendar(data?.calendar);
		if (directCalendar) return directCalendar;

		const rawStorageValue =
			data?.rawLocalStorage && typeof data.rawLocalStorage === 'object'
				? (data.rawLocalStorage as Record<string, unknown>)[APP_STORAGE_KEYS.worldDate]
				: undefined;

		return this.normalizeCalendar(rawStorageValue);
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
			typeof candidate.year !== 'number' ||
			typeof candidate.day !== 'number' ||
			typeof candidate.hour !== 'number' ||
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
			minute: typeof candidate.minute === 'number' ? candidate.minute : 0,
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
}
