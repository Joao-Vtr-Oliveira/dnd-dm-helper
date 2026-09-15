import type { AppBackup } from '../app-backup-service/app-backup-service';
import type { CampaignWorld } from '../../models/campaign-world-model';

export function createEmptyCampaignWorld(): CampaignWorld {
	return {
		schemaVersion: 1,
		calendar: {
			daysPerSeason: 30,
			seasons: [
				{ id: 'spring', label: 'Primavera', color: '#9ae6b4' },
				{ id: 'summer', label: 'Verão', color: '#f6e05e' },
				{ id: 'autumn', label: 'Outono', color: '#f6ad55' },
				{ id: 'winter', label: 'Inverno', color: '#90cdf4' },
			],
			epochDate: { year: 1, season: 'spring', day: 1, hour: 8, minute: 0 },
			events: [],
		},
		empires: [],
		states: [],
		settlements: [],
		organizations: [],
		pointsOfInterest: [],
	};
}

export function createEmptyBackupV2(world: CampaignWorld): AppBackup {
	return {
		app: 'dnd-dm-helper',
		schemaVersion: 2,
		type: 'campaign-backup',
		exportedAt: new Date().toISOString(),
		data: {
			encounters: [],
			battleEncounters: [],
			homebrewSheets: [],
			calendar: structuredClone(world.calendar.epochDate),
			campaignContext: { currentLocation: null },
			fiveEToolsHomebrew: null,
			fiveEToolsHomebrewBackups: [],
			fiveEToolsHomebrewCompositionPackages: [],
			settings: { encounterHubFilters: null },
			rawLocalStorage: {},
		},
	};
}
