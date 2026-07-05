export const APP_STORAGE_KEYS = {
	encounters: 'dnd-dm-helper.encounters.v1',
	sheets: 'dnd-dm-helper.sheets.v1',
	battleEncounters: 'dnd-dm-helper.battle-encounters.v1',
	worldDate: 'dmh-world-date-v1',
	encounterHubFilters: 'dnd-dm-helper.encounter-hub.filters.v1',
	safetyBackupBeforeSync: 'dnd-dm-helper.last-local-backup-before-sync.v1',
	fiveEToolsHomebrew: 'dnd-dm-helper.5etools-homebrew.v1',
	fiveEToolsHomebrewBackups: 'dnd-dm-helper.5etools-homebrew.backups.v1',
} as const;

export const APP_POST_SYNC_TOAST_SESSION_KEY = 'dnd-dm-helper.post-sync-toast.v1';

export const APP_PRIMARY_STORAGE_KEYS = [
	APP_STORAGE_KEYS.encounters,
	APP_STORAGE_KEYS.sheets,
	APP_STORAGE_KEYS.battleEncounters,
	APP_STORAGE_KEYS.worldDate,
	APP_STORAGE_KEYS.encounterHubFilters,
] as const;

export function isProjectStorageKey(key: string): boolean {
	return key.startsWith('dnd-dm-helper.') || key === APP_STORAGE_KEYS.worldDate;
}
