import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import type { CampaignWorld } from '../../models/campaign-world-model';
import type { Encounter } from '../../models/encounter-model';
import { BattleEncounterService } from '../battle-encounter-service/battle-encounter-service';
import {
	EncounterHubFilterService,
	type EncounterHubFilters,
} from './encounter-hub-filter-service';

describe('EncounterHubFilterService', () => {
	let service: EncounterHubFilterService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideZonelessChangeDetection()],
		});
		service = TestBed.inject(EncounterHubFilterService);
	});

	function filters(overrides: Partial<EncounterHubFilters> = {}): EncounterHubFilters {
		return {
			query: '',
			tag: 'all',
			lifecycle: 'active',
			empireId: 'all',
			stateId: 'all',
			settlementId: 'all',
			organizationId: 'all',
			status: 'all',
			sort: 'smart',
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

	const world = {
		empires: [
			{ id: 'mornk', name: 'Mornk', aliases: [] },
			{ id: 'other-empire', name: 'Other', aliases: [] },
		],
		states: [
			{ id: 'feng', name: 'Feng', aliases: [], empireId: 'mornk' },
			{ id: 'drek', name: 'Drek', aliases: [], empireId: 'mornk' },
			{ id: 'other-state', name: 'Other State', aliases: [], empireId: 'other-empire' },
		],
		settlements: [
			{ id: 'feng-city', name: 'Feng City', aliases: [], stateId: 'feng', settlementType: 'city' },
			{ id: 'feng-village', name: 'Feng Village', aliases: [], stateId: 'feng', settlementType: 'village' },
			{ id: 'drek-city', name: 'Drek City', aliases: [], stateId: 'drek', settlementType: 'city' },
		],
		organizations: [],
		pointsOfInterest: [],
	} as unknown as CampaignWorld;

	it('prioritizes active and paused battles in smart sorting', () => {
		const encounters: Encounter[] = [
			{
				schemaVersion: 1,
				type: 'dnd-dm-helper-encounter',
				id: 'enc-1',
				title: 'Prepared',
				createdAt: Date.parse('2026-01-01T10:00:00.000Z'),
				updatedAt: Date.parse('2026-01-01T10:00:00.000Z'),
				tags: [],
				participants: [],
				lairActions: [],
				traps: [],
			},
			{
				schemaVersion: 1,
				type: 'dnd-dm-helper-encounter',
				id: 'enc-2',
				title: 'Running',
				createdAt: Date.parse('2026-01-01T10:00:00.000Z'),
				updatedAt: Date.parse('2026-01-01T10:00:00.000Z'),
				tags: [],
				participants: [],
				lairActions: [],
				traps: [],
			},
		];
		const battle = TestBed.inject(BattleEncounterService).createBattleFromEncounter(encounters[1]);
		const items = service.buildItems(
			encounters,
			[{ ...battle, status: 'active', updatedAt: '2026-01-02T10:00:00.000Z' }],
		);

		const sorted = service.sortItems(items, 'smart');

		expect(sorted[0].encounter.id).toBe('enc-2');
	});

	it('filters direct encounter descriptions, tags, and participant names', () => {
		const items = service.buildItems(
			[
				{
					schemaVersion: 1,
					type: 'dnd-dm-helper-encounter',
					id: 'enc-1',
					title: 'Goblin Roadblock',
					createdAt: 1,
					updatedAt: 1,
					description: 'A broken bridge blocks the forest road.',
					tags: ['forest', 'ambush'],
					participants: [
						{
								id: 'participant-scout',
								name: 'Goblin Scout',
								category: 'monster',
								initiative: null,
							sheet: {
								name: 'Goblin Scout', armorClass: 13, maxHp: 7, spellSlots: [], spells: [],
								specialAbilities: [], features: [],
							},
						},
					],
					lairActions: [],
					traps: [],
				},
			],
			[]
		);

		for (const query of ['bridge', 'forest', 'goblin scout']) {
			expect(service.filterItems(items, filters({ query, status: 'prepared' }), null)).toHaveSize(1);
		}
	});

	it('keeps editorial lifecycle independent from runtime battle status', () => {
		const archived = encounter({ id: 'archived', archived: true, title: 'Archived encounter' });
		const activeBattle = TestBed.inject(BattleEncounterService).createBattleFromEncounter(archived);
		const items = service.buildItems([archived], [{ ...activeBattle, status: 'active' }]);

		expect(service.filterItems(items, filters({ lifecycle: 'active' }), world)).toEqual([]);
		expect(
			service.filterItems(items, filters({ lifecycle: 'archived', status: 'active' }), world),
		).toHaveSize(1);
		expect(service.filterItems(items, filters({ lifecycle: 'all', status: 'active' }), world)).toHaveSize(1);
		expect(service.filterItems(items, filters({ lifecycle: 'all', status: 'prepared' }), world)).toEqual([]);
	});

	it('applies text, tag, location, and organization facets cumulatively', () => {
		const matching = encounter({
			id: 'matching',
			title: 'Moon Ambush',
			description: 'A night patrol near Feng.',
			tags: ['night', 'ambush'],
			locationRefs: [{ scopeType: 'state', scopeId: 'feng', relation: 'operation' }],
			organizationRefs: [{ organizationId: 'odl', relation: 'affiliated' }],
		});
		const tagOnly = encounter({
			id: 'tag-only',
			title: 'Moon Ambush elsewhere',
			tags: ['night', 'ambush'],
		});
		const otherOrganization = encounter({
			id: 'other-org',
			title: 'Moon Ambush guild',
			tags: ['night', 'ambush'],
			locationRefs: [{ scopeType: 'state', scopeId: 'feng', relation: 'operation' }],
			organizationRefs: [{ organizationId: 'winterhold', relation: 'member' }],
		});
		const items = service.buildItems([matching, tagOnly, otherOrganization], []);

		expect(
			service.filterItems(
				items,
				filters({ query: 'moon', tag: 'night', stateId: 'feng', organizationId: 'odl' }),
				world,
			),
		).toEqual([jasmine.objectContaining({ encounter: matching })]);
	});

	it('uses formal location hierarchy and never derives context from tags', () => {
		const empire = encounter({
			id: 'empire',
			tags: ['Feng'],
			locationRefs: [{ scopeType: 'empire', scopeId: 'mornk', relation: 'occurrence' }],
		});
		const state = encounter({
			id: 'state',
			locationRefs: [{ scopeType: 'state', scopeId: 'feng', relation: 'habitat' }],
		});
		const settlement = encounter({
			id: 'settlement',
			locationRefs: [{ scopeType: 'settlement', scopeId: 'feng-city', relation: 'base' }],
		});
		const sibling = encounter({
			id: 'sibling',
			locationRefs: [{ scopeType: 'settlement', scopeId: 'feng-village', relation: 'base' }],
		});
		const broken = encounter({
			id: 'broken',
			locationRefs: [{ scopeType: 'state', scopeId: 'missing', relation: 'base' }],
		});
		const items = service.buildItems([empire, state, settlement, sibling, broken], []);

		expect(service.filterItems(items, filters({ empireId: 'mornk' }), world).map((item) => item.encounter.id)).toEqual([
			'empire',
			'state',
			'settlement',
			'sibling',
		]);
		expect(service.filterItems(items, filters({ stateId: 'feng' }), world).map((item) => item.encounter.id)).toEqual([
			'state',
			'settlement',
			'sibling',
		]);
		expect(service.filterItems(items, filters({ settlementId: 'feng-city' }), world).map((item) => item.encounter.id)).toEqual([
			'settlement',
		]);
		expect(service.filterItems(items, filters({ stateId: 'drek' }), world)).toEqual([]);
	});

	it('treats missing metadata as active but never as contextual content', () => {
		const legacy = encounter({ id: 'legacy', tags: ['Feng', 'ODL'] });
		const items = service.buildItems([legacy], []);

		expect(service.filterItems(items, filters(), world)).toHaveSize(1);
		expect(service.filterItems(items, filters({ tag: 'feng' }), world)).toHaveSize(1);
		expect(service.filterItems(items, filters({ stateId: 'feng' }), world)).toEqual([]);
		expect(service.filterItems(items, filters({ organizationId: 'odl' }), world)).toEqual([]);
	});

	it('persists new preferences while keeping older runtime and sort preferences compatible', () => {
		localStorage.setItem(
			APP_STORAGE_KEYS.encounterHubFilters,
			JSON.stringify({ query: 'old', status: 'paused', sort: 'oldest' }),
		);
		expect(service.loadFilters()).toEqual(
			filters({ query: 'old', status: 'paused', sort: 'oldest' }),
		);

		const saved = filters({
			query: 'moon',
			tag: 'night',
			lifecycle: 'archived',
			empireId: 'mornk',
			stateId: 'feng',
			settlementId: 'feng-city',
			organizationId: 'odl',
			status: 'active',
			sort: 'name',
		});
		service.saveFilters(saved);
		expect(service.loadFilters()).toEqual(saved);
	});
});
