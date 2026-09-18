import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type {
	CampaignOrganization,
	ResolvedCampaignLocation,
} from '../../models/campaign-world-model';
import type { Encounter } from '../../models/encounter-model';
import type { SavedSheetInterface } from '../local-storage-service/local-storage-service';
import { ContextualContentResolverService } from './contextual-content-resolver-service';

describe('ContextualContentResolverService', () => {
	let service: ContextualContentResolverService;

	const location: ResolvedCampaignLocation = {
		ref: { scopeType: 'settlement', scopeId: 'feng-city' },
		empire: { id: 'mornk', name: 'Mornk', aliases: [] },
		state: { id: 'feng', name: 'Feng', aliases: [], empireId: 'mornk' },
		settlement: {
			id: 'feng-city',
			name: 'Feng City',
			aliases: [],
			stateId: 'feng',
			settlementType: 'city',
		},
		label: 'Feng City',
		breadcrumb: ['Mornk', 'Feng', 'Feng City'],
	};

	function sheet(overrides: Partial<SavedSheetInterface> = {}): SavedSheetInterface {
		return {
			id: crypto.randomUUID(),
			title: 'Sheet',
			createdAt: 1,
			updatedAt: 1,
			category: 'monster',
			tags: [],
			source: 'Test',
			data: {
				name: 'Sheet',
				armorClass: 10,
				maxHp: 1,
				spellSlots: [],
				spells: [],
				specialAbilities: [],
				features: [],
			},
			...overrides,
		};
	}

	function encounter(overrides: Partial<Encounter> = {}): Encounter {
		return {
			schemaVersion: 1,
			type: 'dnd-dm-helper-encounter',
			id: crypto.randomUUID(),
			title: 'Encounter',
			createdAt: 1,
			updatedAt: 1,
			tags: [],
			participants: [],
			lairActions: [],
			traps: [],
			...overrides,
		};
	}

	function organization(overrides: Partial<CampaignOrganization> = {}): CampaignOrganization {
		return {
			id: crypto.randomUUID(),
			name: 'Organization',
			aliases: [],
			organizationType: 'guild',
			scope: 'campaign',
			presence: [],
			...overrides,
		};
	}

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
		service = TestBed.inject(ContextualContentResolverService);
	});

	it('separates settlement, state, empire, and generic content into explainable sections', () => {
		const here = sheet({ id: 'here', locationRefs: [{ scopeType: 'settlement', scopeId: 'feng-city', relation: 'base' }] });
		const state = sheet({ id: 'state', locationRefs: [{ scopeType: 'state', scopeId: 'feng', relation: 'habitat' }] });
		const empire = sheet({ id: 'empire', locationRefs: [{ scopeType: 'empire', scopeId: 'mornk', relation: 'occurrence' }] });
		const sibling = sheet({ id: 'sibling', locationRefs: [{ scopeType: 'settlement', scopeId: 'feng-village', relation: 'base' }] });
		const generic = sheet({ id: 'generic', generic: true });
		const stateEncounter = encounter({ id: 'state-encounter', locationRefs: [{ scopeType: 'state', scopeId: 'feng', relation: 'operation' }] });

		const result = service.resolve({
			currentLocation: location,
			sheets: [here, state, empire, sibling, generic],
			encounters: [stateEncounter],
			organizations: [],
		});

		expect(result.here.map((item) => item.content.id)).toEqual(['here']);
		expect(result.stateRegion.map((item) => item.content.id)).toEqual(['state', 'state-encounter']);
		expect(result.broadContext.map((item) => item.content.id)).toEqual(['empire', 'generic']);
		expect(result.here[0].matchedLocations[0].relation).toBe('base');
		expect(result.broadContext[1].reason).toBe('generic');
	});

	it('does not promote settlement content when the current position is only a state', () => {
		const stateLocation = { ...location, ref: { scopeType: 'state' as const, scopeId: 'feng' }, settlement: null };
		const directState = sheet({ id: 'state', locationRefs: [{ scopeType: 'state', scopeId: 'feng', relation: 'base' }] });
		const childSettlement = sheet({ id: 'child', locationRefs: [{ scopeType: 'settlement', scopeId: 'feng-city', relation: 'base' }] });

		const result = service.resolve({
			currentLocation: stateLocation,
			sheets: [directState, childSettlement],
			encounters: [],
			organizations: [],
		});

		expect(result.stateRegion.map((item) => item.content.id)).toEqual(['state']);
		expect(result.here).toEqual([]);
	});

	it('returns only exact organizational presences and never linked members', () => {
		const localAgent = organization({
			id: 'local-agent',
			presence: [{ scopeType: 'settlement', scopeId: 'feng-city', presenceType: 'agent' }],
		});
		const stateContact = organization({
			id: 'state-contact',
			presence: [{ scopeType: 'state', scopeId: 'feng', presenceType: 'remote-contact' }],
		});
		const empireHeadquarters = organization({
			id: 'empire-hq',
			presence: [{ scopeType: 'empire', scopeId: 'mornk', presenceType: 'headquarters' }],
		});
		const globalNetwork = organization({
			id: 'global',
			presence: [{ scopeType: 'global', presenceType: 'global-network' }],
		});
		const otherSettlement = organization({
			id: 'other-settlement',
			presence: [{ scopeType: 'settlement', scopeId: 'other-city', presenceType: 'post' }],
		});
		const linkedOnly = organization({ id: 'linked-only' });

		const result = service.resolve({
			currentLocation: location,
			sheets: [],
			encounters: [],
			organizations: [localAgent, stateContact, empireHeadquarters, globalNetwork, otherSettlement, linkedOnly],
		});

		expect(result.organizations.map((item) => item.organization.id)).toEqual([
			'local-agent',
			'state-contact',
			'empire-hq',
		]);
		expect(result.organizations[0]).toEqual(
			jasmine.objectContaining({ section: 'here', classification: 'physical', physical: true }),
		);
		expect(result.organizations[1]).toEqual(
			jasmine.objectContaining({ section: 'state-region', classification: 'remote-contact', physical: false }),
		);
		expect(result.organizations[2]).toEqual(
			jasmine.objectContaining({ section: 'broad-context', classification: 'physical', physical: true }),
		);
	});

	it('preserves legacy presence forms without reclassifying them as physical', () => {
		const legacy = organization({
			presence: [{ scopeType: 'settlement', scopeId: 'feng-city', presenceType: 'clandestine contact' }],
		});

		const result = service.resolve({ currentLocation: location, sheets: [], encounters: [], organizations: [legacy] });

		expect(result.organizations[0]).toEqual(
			jasmine.objectContaining({ classification: 'legacy', physical: false, section: 'here' }),
		);
	});

	it('excludes archived content, broken references, and organization-linked content without location', () => {
		const archived = sheet({ id: 'archived', archived: true, locationRefs: [{ scopeType: 'settlement', scopeId: 'feng-city', relation: 'base' }] });
		const broken = encounter({ id: 'broken', locationRefs: [{ scopeType: 'state', scopeId: 'missing', relation: 'operation' }] });
		const linked = sheet({ id: 'linked', organizationRefs: [{ organizationId: 'guild', relation: 'member' }] });
		const result = service.resolve({
			currentLocation: location,
			sheets: [archived, linked],
			encounters: [broken],
			organizations: [organization({ id: 'guild', presence: [] })],
		});

		expect(result.here).toEqual([]);
		expect(result.stateRegion).toEqual([]);
		expect(result.broadContext).toEqual([]);
		expect(result.organizations).toEqual([]);
		expect(
		service.resolve({
			currentLocation: location,
			sheets: [archived],
			encounters: [],
			organizations: [],
			includeArchived: true,
		}).here.map((item) => item.content.id),
		).toEqual(['archived']);
	});

	it('returns no contextual content without a current location', () => {
		const result = service.resolve({ currentLocation: null, sheets: [sheet({ generic: true })], encounters: [], organizations: [] });

		expect(result).toEqual({
			currentLocation: null,
			here: [],
			stateRegion: [],
			organizations: [],
			broadContext: [],
		});
	});
});
