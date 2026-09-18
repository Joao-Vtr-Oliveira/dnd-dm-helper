import type { CampaignWorld } from '../../models/campaign-world-model';
import type { CreatureSheet } from '../../models/creature-sheet-model';
import type { SavedSheetInterface } from '../../services/local-storage-service/local-storage-service';
import { filterHomebrewSheets, type HomebrewSheetFilters } from './homebrew-sheet-filter';

describe('filterHomebrewSheets', () => {
	const world = {
		empires: [
			{ id: 'empire-north', name: 'North', aliases: [] },
			{ id: 'empire-south', name: 'Komic', aliases: [] },
		],
		states: [
			{ id: 'state-frost', name: 'Frost', aliases: [], empireId: 'empire-north' },
			{ id: 'state-pine', name: 'Pine', aliases: [], empireId: 'empire-north' },
		],
		settlements: [
			{ id: 'settlement-ice', name: 'Ice', aliases: [], stateId: 'state-frost', settlementType: 'city' },
			{ id: 'settlement-snow', name: 'Snow', aliases: [], stateId: 'state-frost', settlementType: 'city' },
		],
		organizations: [
			{
				id: 'winterhold',
				name: 'Winterhold',
				aliases: ['Winter Hold'],
				organizationType: 'guild',
				scope: 'campaign',
				presence: [],
			},
		],
		pointsOfInterest: [],
	} as unknown as CampaignWorld;

	function filters(overrides: Partial<HomebrewSheetFilters> = {}): HomebrewSheetFilters {
		return {
			query: '',
			category: 'all',
			tag: 'all',
			source: 'all',
			status: 'active',
			creatureType: 'all',
			characterClass: 'all',
			empireId: 'all',
			stateId: 'all',
			settlementId: 'all',
			organizationId: 'all',
			...overrides,
		};
	}

	function sheet(
		overrides: Omit<Partial<SavedSheetInterface>, 'data'> & { data?: Partial<CreatureSheet> } = {},
	): SavedSheetInterface {
		const { data, ...saved } = overrides;
		return {
			id: crypto.randomUUID(),
			title: 'Sheet',
			createdAt: 0,
			updatedAt: 0,
			category: 'monster',
			tags: [],
			source: 'HB',
			...saved,
			data: {
				name: 'Sheet',
				armorClass: 10,
				maxHp: 1,
				spellSlots: [],
				spells: [],
				specialAbilities: [],
				features: [],
				...data,
			},
		};
	}

	it('treats missing archived metadata as active and supports all lifecycle views', () => {
		const active = sheet({ title: 'Active' });
		const archived = sheet({ title: 'Archived', archived: true });

		expect(filterHomebrewSheets([active, archived], filters(), world)).toEqual([active]);
		expect(filterHomebrewSheets([active, archived], filters({ status: 'archived' }), world)).toEqual([
			archived,
		]);
		expect(filterHomebrewSheets([active, archived], filters({ status: 'all' }), world)).toEqual([
			active,
			archived,
		]);
	});

	it('filters fixed creature types using formal classes only', () => {
		const warlock = sheet({
			title: 'Arcane NPC',
			tags: ['Warlock'],
			classes: ['warlock'],
			data: { name: 'Arcane NPC', creatureType: 'humanoid (elf)' },
		});
		const namedWarlock = sheet({
			title: 'Warlock Guard',
			data: { name: 'Warlock Guard', creatureType: 'humanoid' },
		});
		const customType = sheet({ data: { name: 'Custom', creatureType: 'shadow spirit' } });

		expect(filterHomebrewSheets([warlock, namedWarlock, customType], filters({ creatureType: 'humanoid' }), world)).toEqual([
			warlock,
			namedWarlock,
		]);
		expect(filterHomebrewSheets([warlock, namedWarlock, customType], filters({ characterClass: 'warlock' }), world)).toEqual([
			warlock,
		]);
		const tagOnly = sheet({ title: 'Tag only', tags: ['Warlock'] });
		expect(filterHomebrewSheets([tagOnly], filters({ characterClass: 'warlock' }), world)).toEqual([]);
	});

	it('searches legacy data tags and groups without using them as formal relationships', () => {
		const sheetWithLegacyData = sheet({
			data: {
				name: 'Scout',
				tags: ['night watch'],
				groups: ['Frost guard'],
			},
		});

		expect(filterHomebrewSheets([sheetWithLegacyData], filters({ query: 'frost guard' }), world)).toEqual([
			sheetWithLegacyData,
		]);
		expect(filterHomebrewSheets([sheetWithLegacyData], filters({ query: 'night watch' }), world)).toEqual([
			sheetWithLegacyData,
		]);
	});

	it('matches the selected tag positively across envelope tags and legacy tag fields', () => {
		const envelopeTag = sheet({ title: 'Envelope', tags: ['Feng'] });
		const dataTag = sheet({ title: 'Data tag', data: { tags: ['Feng'] } });
		const group = sheet({ title: 'Group', data: { groups: ['Feng'] } });
		const other = sheet({ title: 'Other', tags: ['Drek'] });

		expect(
			filterHomebrewSheets([envelopeTag, dataTag, group, other], filters({ tag: 'feng' }), world),
		).toEqual([envelopeTag, dataTag, group]);
	});

	it('matches selected states and settlements without including broader locations or sibling settlements', () => {
		const empire = sheet({
			title: 'Empire',
			locationRefs: [{ scopeType: 'empire', scopeId: 'empire-north', relation: 'occurrence' }],
		});
		const state = sheet({
			title: 'State',
			locationRefs: [{ scopeType: 'state', scopeId: 'state-frost', relation: 'habitat' }],
		});
		const settlement = sheet({
			title: 'Settlement',
			locationRefs: [{ scopeType: 'settlement', scopeId: 'settlement-ice', relation: 'base' }],
		});
		const sibling = sheet({
			title: 'Sibling',
			locationRefs: [{ scopeType: 'settlement', scopeId: 'settlement-snow', relation: 'base' }],
		});
		const broken = sheet({
			title: 'Broken',
			locationRefs: [{ scopeType: 'state', scopeId: 'missing', relation: 'habitat' }],
		});
		const sheets = [empire, state, settlement, sibling, broken];

		expect(filterHomebrewSheets(sheets, filters({ settlementId: 'settlement-ice' }), world)).toEqual([settlement]);
		expect(filterHomebrewSheets(sheets, filters({ stateId: 'state-frost' }), world)).toEqual([
			state,
			settlement,
			sibling,
		]);
		expect(filterHomebrewSheets(sheets, filters({ empireId: 'empire-north' }), world)).toEqual([
			empire,
			state,
			settlement,
			sibling,
		]);
	});

	it('filters organizations by direct ID and composes every active facet', () => {
	const matching = sheet({
			tags: ['Wizard'],
			classes: ['wizard'],
			organizationRefs: [{ organizationId: 'arcane-order', relation: 'member' }],
			locationRefs: [{ scopeType: 'state', scopeId: 'state-frost', relation: 'operation' }],
			data: { name: 'Wizard', creatureType: 'humanoid' },
		});
		const tagOnly = sheet({ tags: ['Wizard'], data: { name: 'Tag only', creatureType: 'humanoid' } });
		const archived = sheet({
			archived: true,
			tags: ['Wizard'],
			organizationRefs: [{ organizationId: 'arcane-order', relation: 'member' }],
			locationRefs: [{ scopeType: 'state', scopeId: 'state-frost', relation: 'operation' }],
			data: { name: 'Archived', creatureType: 'humanoid' },
		});
		const organizationOnly = sheet({
			title: 'Organization only',
			organizationRefs: [{ organizationId: 'arcane-order', relation: 'member' }],
		});

		expect(
			filterHomebrewSheets(
				[matching, tagOnly, archived, organizationOnly],
				filters({
					creatureType: 'humanoid',
					characterClass: 'wizard',
					stateId: 'state-frost',
					organizationId: 'arcane-order',
				}),
				world,
			),
		).toEqual([matching]);
		expect(
			filterHomebrewSheets([organizationOnly], filters({ organizationId: 'arcane-order' }), world),
		).toEqual([organizationOnly]);
		expect(
			filterHomebrewSheets([organizationOnly], filters({ stateId: 'state-frost' }), world),
		).toEqual([]);
	});

	it('does not derive contextual filters from tags or groups', () => {
		const heXiao = sheet({ tags: ['Komic', 'Rogue'], data: { name: 'He Xiao' } });
		const winterholdMage = sheet({ tags: ['Winterhold'], data: { name: 'Rosa' } });
		const unrelated = sheet({ tags: ['Komic veteran'], data: { name: 'Unrelated' } });

		expect(filterHomebrewSheets([heXiao, winterholdMage, unrelated], filters({ empireId: 'empire-south' }), world)).toEqual([]);
		expect(
			filterHomebrewSheets(
				[heXiao, winterholdMage, unrelated],
				filters({ organizationId: 'winterhold' }),
				world,
			),
		).toEqual([]);
	});

	it('requires explicit location metadata for the Talha Feng/Drek case', () => {
		const talha = sheet({
			title: 'Talha Trusk',
			tags: ['Feng', 'Mornk', 'Feudal'],
			locationRefs: [
				{ scopeType: 'state', scopeId: 'state-frost', relation: 'base' },
				{ scopeType: 'settlement', scopeId: 'settlement-ice', relation: 'operation' },
			],
		});
		const tagOnly = sheet({ title: 'Tag only', tags: ['Frost'] });

		expect(filterHomebrewSheets([talha], filters({ stateId: 'state-frost' }), world)).toEqual([talha]);
		expect(filterHomebrewSheets([talha], filters({ stateId: 'state-pine' }), world)).toEqual([]);
		expect(
			filterHomebrewSheets(
				[{ ...talha, tags: [], data: { ...talha.data, tags: [], groups: [] } }],
				filters({ stateId: 'state-frost' }),
				world,
			),
		).toHaveSize(1);
		expect(filterHomebrewSheets([tagOnly], filters({ stateId: 'state-frost' }), world)).toEqual([]);
		expect(filterHomebrewSheets([talha], filters({ settlementId: 'settlement-ice' }), world)).toEqual([talha]);
	});
});
