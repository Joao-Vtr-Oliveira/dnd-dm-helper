import type {
	CampaignOrganization,
	CampaignOrganizationPresence,
	ResolvedCampaignLocation,
} from './campaign-world-model';
import type { ContentLocationRelation } from './content-context-model';
import type { Encounter } from './encounter-model';
import type { SavedSheetInterface } from '../services/local-storage-service/local-storage-service';

export type ResolvedContextualContentKind = 'sheet' | 'encounter';
export type ResolvedContextualContentSection = 'here' | 'state-region' | 'broad-context';

export interface ResolvedContextualContent {
	kind: ResolvedContextualContentKind;
	content: SavedSheetInterface | Encounter;
	section: ResolvedContextualContentSection;
	matchedLocations: ContentLocationRelation[];
	reason: 'location' | 'generic' | 'organization';
	matchedOrganizations?: CampaignOrganization[];
}

export type CampaignOrganizationPresenceClassification =
	| 'physical'
	| 'remote-contact'
	| 'legacy'
	| 'network';

export interface RelevantCampaignOrganization {
	organization: CampaignOrganization;
	presence: CampaignOrganizationPresence;
	section: ResolvedContextualContentSection;
	classification: CampaignOrganizationPresenceClassification;
	physical: boolean;
}

export interface ContextualContentResolverInput {
	currentLocation: ResolvedCampaignLocation | null;
	sheets: SavedSheetInterface[];
	encounters: Encounter[];
	organizations: CampaignOrganization[];
	includeArchived?: boolean;
}

export interface ContextualContentResolution {
	currentLocation: ResolvedCampaignLocation | null;
	here: ResolvedContextualContent[];
	stateRegion: ResolvedContextualContent[];
	organizations: RelevantCampaignOrganization[];
	broadContext: ResolvedContextualContent[];
}
