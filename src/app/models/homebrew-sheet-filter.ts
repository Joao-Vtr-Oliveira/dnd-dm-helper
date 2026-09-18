import type { CampaignWorld } from './campaign-world-model';
import type { ContentLocationRelation } from './content-context-model';
import {
	DND_5E_CHARACTER_CLASSES,
	DND_5E_CREATURE_TYPES,
	type Dnd5eCharacterClass,
	type Dnd5eCreatureType,
	} from './dnd-5e-reference-model';
import type { HomebrewCategory, SavedSheetInterface } from '../services/local-storage-service/local-storage-service';

export type FilterAll<T extends string> = 'all' | T;
export type HomebrewSheetStatusFilter = 'active' | 'archived' | 'all';

export interface HomebrewSheetFilters {
	query: string;
	category: FilterAll<HomebrewCategory>;
	challengeRating?: FilterAll<string>;
	tag: FilterAll<string>;
	source: FilterAll<string>;
	status: HomebrewSheetStatusFilter;
	creatureType: FilterAll<Dnd5eCreatureType>;
	characterClass: FilterAll<Dnd5eCharacterClass>;
	empireId: FilterAll<string>;
	stateId: FilterAll<string>;
	settlementId: FilterAll<string>;
	organizationId: FilterAll<string>;
}

type ResolvedRelation = {
	scopeType: 'empire' | 'state' | 'settlement';
	empireId: string;
	stateId?: string;
	settlementId?: string;
};

export const HOME_BREW_SHEET_STATUS_OPTIONS: Array<{
	id: HomebrewSheetStatusFilter;
	label: string;
}> = [
	{ id: 'active', label: 'Ativas' },
	{ id: 'archived', label: 'Arquivadas' },
	{ id: 'all', label: 'Todas' },
];

export const HOME_BREW_SHEET_CREATURE_TYPE_OPTIONS: Array<{
	id: FilterAll<Dnd5eCreatureType>;
	label: string;
}> = [
	{ id: 'all', label: 'Todos os tipos' },
	...DND_5E_CREATURE_TYPES.map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) })),
];

export const HOME_BREW_SHEET_CLASS_OPTIONS: Array<{
	id: FilterAll<Dnd5eCharacterClass>;
	label: string;
}> = [
	{ id: 'all', label: 'Todas as classes' },
	...DND_5E_CHARACTER_CLASSES,
];

export function normalizeHomebrewSheetFilterText(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '');
}

export function filterHomebrewSheets(
	sheets: SavedSheetInterface[],
	filters: HomebrewSheetFilters,
	world: CampaignWorld | null,
): SavedSheetInterface[] {
	const query = normalizeHomebrewSheetFilterText(filters.query);
	return sheets.filter((sheet) => {
		if (filters.status === 'active' && sheet.archived) return false;
		if (filters.status === 'archived' && !sheet.archived) return false;
		if (filters.category !== 'all' && sheet.category !== filters.category) return false;
		if (
			filters.challengeRating &&
			filters.challengeRating !== 'all' &&
			normalizeHomebrewSheetFilterText(sheet.data.challengeRating ?? '') !==
				normalizeHomebrewSheetFilterText(filters.challengeRating)
		)
			return false;
		if (
			filters.tag !== 'all' &&
			!contentTagsFor(sheet).some(
				(tag) => normalizeHomebrewSheetFilterText(tag) === normalizeHomebrewSheetFilterText(filters.tag),
			)
		)
			return false;
		if (
			filters.source !== 'all' &&
			normalizeHomebrewSheetFilterText(sheet.source) !==
				normalizeHomebrewSheetFilterText(filters.source)
		)
			return false;
		if (filters.creatureType !== 'all' && creatureTypeFor(sheet) !== filters.creatureType) return false;
		if (
			filters.characterClass !== 'all' &&
			!(sheet.classes ?? []).includes(filters.characterClass)
		)
			return false;
		if (!matchesLocationFilters(sheet.locationRefs ?? [], filters, world))
			return false;
		if (
			filters.organizationId !== 'all' &&
			!(sheet.organizationRefs ?? []).some(
				(ref) => ref.organizationId === filters.organizationId,
			)
		)
			return false;
		if (!query) return true;

		return searchableHomebrewSheetText(sheet, world).includes(query);
	});
}

function creatureTypeFor(sheet: SavedSheetInterface): Dnd5eCreatureType | null {
	const type = normalizeHomebrewSheetFilterText((sheet.data.creatureType ?? '').split('(', 1)[0]);
	return DND_5E_CREATURE_TYPES.includes(type as Dnd5eCreatureType)
		? (type as Dnd5eCreatureType)
		: null;
}

function matchesLocationFilters(
	locationRefs: ContentLocationRelation[],
	filters: HomebrewSheetFilters,
	world: CampaignWorld | null,
): boolean {
	const selections = [
		['empire', filters.empireId],
		['state', filters.stateId],
		['settlement', filters.settlementId],
	] as const;
	if (selections.every(([, id]) => id === 'all')) return true;
	if (!world) return false;

	return selections.every(([scopeType, scopeId]) => {
		if (scopeId === 'all') return true;
		return locationRefs.some((relation) => {
			const resolved = resolveRelation(world, relation.scopeType, relation.scopeId);
			return resolved ? relationMatchesScope(world, resolved, scopeType, scopeId) : false;
		});
	});
}

function resolveRelation(
	world: CampaignWorld,
	scopeType: ResolvedRelation['scopeType'],
	scopeId: string,
): ResolvedRelation | null {
	if (scopeType === 'empire') {
		return world.empires.some((empire) => empire.id === scopeId)
			? { scopeType, empireId: scopeId }
			: null;
	}
	if (scopeType === 'state') {
		const state = world.states.find((item) => item.id === scopeId);
		return state && world.empires.some((empire) => empire.id === state.empireId)
			? { scopeType, empireId: state.empireId, stateId: state.id }
			: null;
	}
	const settlement = world.settlements.find((item) => item.id === scopeId);
	if (!settlement) return null;
	const state = world.states.find((item) => item.id === settlement.stateId);
	return state && world.empires.some((empire) => empire.id === state.empireId)
		? { scopeType, empireId: state.empireId, stateId: state.id, settlementId: settlement.id }
		: null;
}

function relationMatchesScope(
	world: CampaignWorld,
	relation: ResolvedRelation,
	scopeType: ResolvedRelation['scopeType'],
	scopeId: string,
): boolean {
	if (scopeType === 'empire') return relation.empireId === scopeId;
	if (scopeType === 'state') {
		const selectedState = world.states.find((state) => state.id === scopeId);
		if (!selectedState) return false;
		return relation.scopeType !== 'empire' && relation.stateId === selectedState.id;
	}
	const selectedSettlement = world.settlements.find((settlement) => settlement.id === scopeId);
	if (!selectedSettlement) return false;
	const selectedState = world.states.find((state) => state.id === selectedSettlement.stateId);
	if (!selectedState) return false;
	if (relation.scopeType !== 'settlement') return false;
	return relation.settlementId === selectedSettlement.id;
}

export function searchableHomebrewSheetText(sheet: SavedSheetInterface, world: CampaignWorld | null): string {
	const formalOrganizations = (sheet.organizationRefs ?? [])
		.map((ref) => world?.organizations.find((organization) => organization.id === ref.organizationId)?.name ?? '')
		.filter(Boolean);
	const formalLocations = (sheet.locationRefs ?? []).flatMap((ref) => {
		if (!world) return [];
		const resolved = resolveRelation(world, ref.scopeType, ref.scopeId);
		return resolved
			? [
					world.empires.find((empire) => empire.id === resolved.empireId)?.name ?? '',
					resolved.stateId
						? world.states.find((state) => state.id === resolved.stateId)?.name ?? ''
						: '',
					resolved.settlementId
						? world.settlements.find((settlement) => settlement.id === resolved.settlementId)?.name ?? ''
						: '',
				]
			: [];
	});
	return [
		sheet.title,
		sheet.data.name,
		...(sheet.tags ?? []),
		...(sheet.data.aliases ?? []),
		...(sheet.data.tags ?? []),
		...(sheet.data.groups ?? []),
		sheet.source,
		sheet.data.source ?? '',
		sheet.data.origin ?? '',
		sheet.category,
		sheet.data.creatureType ?? '',
		...(sheet.classes ?? []),
		...formalOrganizations,
		...formalLocations,
	]
		.map(normalizeHomebrewSheetFilterText)
		.join(' ');
}

function contentTagsFor(sheet: SavedSheetInterface): string[] {
	return [
		...(sheet.tags ?? []),
		...(sheet.data.tags ?? []),
		...(sheet.data.groups ?? []),
	];
}
