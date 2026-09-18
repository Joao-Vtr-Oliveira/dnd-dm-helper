import { Injectable } from '@angular/core';
import {
	isCampaignOrganizationEligible,
	type CampaignOrganizationPresence,
	type ResolvedCampaignLocation,
} from '../../models/campaign-world-model';
import type {
	CampaignOrganizationPresenceClassification,
	ContextualContentResolution,
	ContextualContentResolverInput,
	RelevantCampaignOrganization,
	ResolvedContextualContent,
	ResolvedContextualContentSection,
} from '../../models/contextual-content-resolver-model';
import type { ContentLocationRelation } from '../../models/content-context-model';
import type { Encounter } from '../../models/encounter-model';
import type { SavedSheetInterface } from '../local-storage-service/local-storage-service';

@Injectable({ providedIn: 'root' })
export class ContextualContentResolverService {
	resolve(input: ContextualContentResolverInput): ContextualContentResolution {
		const includeArchived = input.includeArchived === true;
		const result: ContextualContentResolution = {
			currentLocation: input.currentLocation,
			here: [],
			stateRegion: [],
			organizations: [],
			broadContext: [],
		};

		if (!input.currentLocation) return result;

		for (const sheet of input.sheets) {
			if (!includeArchived && sheet.archived === true) continue;
			this.resolveContent(sheet, 'sheet', input, result);
		}
		for (const encounter of input.encounters) {
			if (!includeArchived && encounter.archived === true) continue;
			this.resolveContent(encounter, 'encounter', input, result);
		}

		for (const organization of input.organizations) {
			if (!isCampaignOrganizationEligible(organization)) continue;
			if (!includeArchived && organization.archived === true) continue;
			for (const presence of organization.presence) {
				const relevant = this.resolveOrganizationPresence(input, organization, presence);
				result.organizations.push(...relevant);
			}
		}

		return result;
	}

	private resolveContent(
		content: SavedSheetInterface | Encounter,
		kind: 'sheet' | 'encounter',
		input: ContextualContentResolverInput,
		result: ContextualContentResolution,
	): void {
		if (kind === 'sheet' && (content as SavedSheetInterface).generic === true) {
			result.broadContext.push({
				kind,
				content,
				section: 'broad-context',
				matchedLocations: [],
				reason: 'generic',
			});
			return;
		}

		const bySection = new Map<ResolvedContextualContentSection, ContentLocationRelation[]>();
		for (const relation of content.locationRefs ?? []) {
			const sections = [
				this.sectionForLocation(input.currentLocation!, relation),
				this.sectionForRegion(input.regionalStateId, input.regionalSettlementIds, relation),
			].filter((section, index, all): section is ResolvedContextualContentSection =>
				!!section && all.indexOf(section) === index,
			);
			for (const section of sections) {
				bySection.set(section, [...(bySection.get(section) ?? []), relation]);
			}
		}

		for (const [section, matchedLocations] of bySection) {
			const resolved: ResolvedContextualContent = {
				kind,
				content,
				section,
				matchedLocations,
				reason: 'location',
			};
			if (section === 'here') result.here.push(resolved);
			else if (section === 'state-region') result.stateRegion.push(resolved);
			else result.broadContext.push(resolved);
		}
	}

	private sectionForLocation(
		currentLocation: ResolvedCampaignLocation,
		relation: ContentLocationRelation,
	): ResolvedContextualContentSection | null {
		if (relation.scopeType === 'settlement') {
			return currentLocation.settlement?.id === relation.scopeId ? 'here' : null;
		}
		if (relation.scopeType === 'state') {
			return currentLocation.state?.id === relation.scopeId ? 'state-region' : null;
		}
		return currentLocation.empire?.id === relation.scopeId ? 'broad-context' : null;
	}

	private sectionForRegion(
		regionalStateId: string | undefined,
		regionalSettlementIds: readonly string[] | undefined,
		relation: ContentLocationRelation,
	): ResolvedContextualContentSection | null {
		if (!regionalStateId) return null;
		if (relation.scopeType === 'state') return relation.scopeId === regionalStateId ? 'state-region' : null;
		if (relation.scopeType === 'settlement') {
			return regionalSettlementIds?.includes(relation.scopeId) ? 'state-region' : null;
		}
		return null;
	}

	private resolveOrganizationPresence(
		input: ContextualContentResolverInput,
		organization: RelevantCampaignOrganization['organization'],
		presence: CampaignOrganizationPresence,
	): RelevantCampaignOrganization[] {
		const sections = [
			this.organizationSectionForPresence(input.currentLocation!, presence),
			this.organizationSectionForRegion(input.regionalStateId, input.regionalSettlementIds, presence),
		].filter((section, index, all): section is ResolvedContextualContentSection =>
			!!section && all.indexOf(section) === index,
		);
		const classification = this.classifyPresence(presence);
		if (classification === 'network') return [];
		return sections.map((section) => ({
			organization,
			presence,
			section,
			classification,
			physical: classification === 'physical',
		}));
	}

	private organizationSectionForPresence(
		currentLocation: ResolvedCampaignLocation,
		presence: CampaignOrganizationPresence,
	): ResolvedContextualContentSection | null {
		if (presence.scopeType === 'global') return null;
		if (presence.scopeType === 'settlement') {
			return currentLocation.settlement?.id === presence.scopeId ? 'here' : null;
		}
		if (presence.scopeType === 'state') {
			return currentLocation.state?.id === presence.scopeId ? 'state-region' : null;
		}
		return currentLocation.empire?.id === presence.scopeId ? 'broad-context' : null;
	}

	private organizationSectionForRegion(
		regionalStateId: string | undefined,
		regionalSettlementIds: readonly string[] | undefined,
		presence: CampaignOrganizationPresence,
	): ResolvedContextualContentSection | null {
		if (!regionalStateId) return null;
		if (presence.scopeType === 'state') {
			return presence.scopeId === regionalStateId ? 'state-region' : null;
		}
		if (presence.scopeType === 'settlement') {
			return presence.scopeId && regionalSettlementIds?.includes(presence.scopeId)
				? 'state-region'
				: null;
		}
		return null;
	}

	private classifyPresence(
		presence: CampaignOrganizationPresence,
	): CampaignOrganizationPresenceClassification {
		if (presence.presenceType === 'global-network') return 'network';
		if (presence.presenceType === 'remote-contact') return 'remote-contact';
		if (
			presence.presenceType === 'headquarters' ||
			presence.presenceType === 'post' ||
			presence.presenceType === 'agent' ||
			presence.presenceType === 'operation'
		) {
			return 'physical';
		}
		return 'legacy';
	}
}
