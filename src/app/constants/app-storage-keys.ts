export const APP_STORAGE_KEYS = {
	encounters: 'dnd-dm-helper.encounters.v2',
	sheets: 'dnd-dm-helper.sheets.v2',
	battleEncounters: 'dnd-dm-helper.battle-encounters.v1',
	worldDate: 'dmh-world-date-v1',
	encounterHubFilters: 'dnd-dm-helper.encounter-hub.filters.v1',
	campaignContext: 'dnd-dm-helper.campaign-context.v1',
	campaignWorld: 'dnd-dm-helper.campaign-world.v1',
	safetyWorldBeforeImport: 'dnd-dm-helper.last-local-world-before-import.v1',
	safetyWorldBeforeBootstrap: 'dnd-dm-helper.world-before-bootstrap.v1',
	safetyWorldRawBeforeBootstrap: 'dnd-dm-helper.world-raw-before-bootstrap.v1',
	safetyBackupBeforeSync: 'dnd-dm-helper.last-local-backup-before-sync.v1',
	fiveEToolsHomebrew: 'dnd-dm-helper.5etools-homebrew.v1',
	fiveEToolsHomebrewBackups: 'dnd-dm-helper.5etools-homebrew.backups.v1',
	fiveEToolsHomebrewCompositionPackages: 'dnd-dm-helper.5etools-homebrew.composition-packages.v1',
} as const;

export const APP_LEGACY_PRIMARY_STORAGE_KEYS = [
	'dnd-dm-helper.encounters.v1',
	'dnd-dm-helper.sheets.v1',
] as const;

export const APP_PRIMARY_STORAGE_KEYS = [
	APP_STORAGE_KEYS.encounters,
	APP_STORAGE_KEYS.sheets,
	APP_STORAGE_KEYS.battleEncounters,
	APP_STORAGE_KEYS.worldDate,
	APP_STORAGE_KEYS.encounterHubFilters,
	APP_STORAGE_KEYS.campaignContext,
	APP_STORAGE_KEYS.fiveEToolsHomebrewCompositionPackages,
	APP_STORAGE_KEYS.fiveEToolsHomebrew,
	APP_STORAGE_KEYS.fiveEToolsHomebrewBackups,
] as const;

/** Known project keys which have no formal campaign-backup section yet. */
export const APP_RAW_BACKUP_STORAGE_KEYS = [] as const;

export function isProjectStorageKey(key: string): boolean {
	return (
		APP_PRIMARY_STORAGE_KEYS.includes(key as (typeof APP_PRIMARY_STORAGE_KEYS)[number]) ||
		APP_LEGACY_PRIMARY_STORAGE_KEYS.includes(
			key as (typeof APP_LEGACY_PRIMARY_STORAGE_KEYS)[number],
		) ||
		key === APP_STORAGE_KEYS.safetyBackupBeforeSync
	);
}

export function isRawBackupStorageKey(key: string): boolean {
	return APP_RAW_BACKUP_STORAGE_KEYS.includes(
		key as (typeof APP_RAW_BACKUP_STORAGE_KEYS)[number],
	);
}
