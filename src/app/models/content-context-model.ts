import {
	resolveCampaignOrganizationScope,
	type CampaignLocationScope,
	type CampaignWorld,
} from './campaign-world-model';

export type ContentLocationRelationKind =
	| 'base'
	| 'occurrence'
	| 'habitat'
	| 'operation'
	| 'regional'
	| 'generic';

export type ContentOrganizationRelationKind =
	| 'member'
	| 'leader'
	| 'affiliated'
	| 'institution'
	| 'trained_by'
	| 'associated';

export interface ContentLocationRelation {
	scopeType: CampaignLocationScope;
	scopeId: string;
	relation: ContentLocationRelationKind;
}

export interface ContentOrganizationRelation {
	organizationId: string;
	relation: ContentOrganizationRelationKind;
}

export interface LegacyContentTagSource {
	tags?: string[];
	data?: {
		tags?: string[];
		groups?: string[];
	};
}

export interface LegacyContentContextRelations {
	locationRefs: ContentLocationRelation[];
	organizationRefs: ContentOrganizationRelation[];
}

const LOCATION_RELATION_KINDS: ContentLocationRelationKind[] = [
	'base',
	'occurrence',
	'habitat',
	'operation',
	'regional',
	'generic',
];
const ORGANIZATION_RELATION_KINDS: ContentOrganizationRelationKind[] = [
	'member',
	'leader',
	'affiliated',
	'institution',
	'trained_by',
	'associated',
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.trim();
	return normalized || null;
}

export function normalizeContentContextText(value: string): string {
	return value
		.trim()
		.toLocaleLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '');
}

/**
 * Matches only exact legacy tags against registered geographic and organization identities.
 * Ambiguous geographic names remain manual.
 */
export function resolveLegacyContentContextRelations(
	source: LegacyContentTagSource,
	world: CampaignWorld | null,
): LegacyContentContextRelations {
	if (!world) return { locationRefs: [], organizationRefs: [] };
	const tags = new Set(
		[source.tags ?? [], source.data?.tags ?? [], source.data?.groups ?? []]
			.flat()
			.map(normalizeContentContextText)
			.filter(Boolean),
	);
	const locationCandidates = [
		...world.empires.map((empire) => ({
			scopeType: 'empire' as const,
			scopeId: empire.id,
			names: [empire.name, ...empire.aliases],
		})),
		...world.states.map((state) => ({
			scopeType: 'state' as const,
			scopeId: state.id,
			names: [state.name, ...state.aliases],
		})),
		...world.settlements.map((settlement) => ({
			scopeType: 'settlement' as const,
			scopeId: settlement.id,
			names: [settlement.name, ...settlement.aliases],
		})),
	];
	const locationRefs = [...tags].flatMap((tag) => {
		const matches = locationCandidates.filter((candidate) =>
			candidate.names.some((name) => normalizeContentContextText(name) === tag),
		);
		return matches.length === 1
			? [{ scopeType: matches[0].scopeType, scopeId: matches[0].scopeId, relation: 'regional' as const }]
			: [];
	});
	const organizationRefs = world.organizations.flatMap((organization) => {
		if (
			resolveCampaignOrganizationScope(organization) === 'local' ||
			(organization.organizationType !== 'group' && organization.organizationType !== 'guild')
		)
			return [];
		const names = [organization.name, ...organization.aliases].map(normalizeContentContextText);
		return names.some((name) => tags.has(name))
			? [{ organizationId: organization.id, relation: 'associated' as const }]
			: [];
	});
	return { locationRefs, organizationRefs };
}

export function isLegacyContextTag(tag: string, world: CampaignWorld | null): boolean {
	const relations = resolveLegacyContentContextRelations({ tags: [tag] }, world);
	return relations.locationRefs.length > 0 || relations.organizationRefs.length > 0;
}

export function isContentLocationRelation(value: unknown): value is ContentLocationRelation {
	if (!isRecord(value) || !text(value['scopeId'])) return false;
	return (
		(value['scopeType'] === 'empire' ||
			value['scopeType'] === 'state' ||
			value['scopeType'] === 'settlement') &&
		LOCATION_RELATION_KINDS.includes(value['relation'] as ContentLocationRelationKind)
	);
}

export function isContentOrganizationRelation(value: unknown): value is ContentOrganizationRelation {
	return (
		isRecord(value) &&
		!!text(value['organizationId']) &&
		ORGANIZATION_RELATION_KINDS.includes(value['relation'] as ContentOrganizationRelationKind)
	);
}

export function normalizeContentLocationRelations(value: unknown): ContentLocationRelation[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item) => {
		if (!isContentLocationRelation(item)) return [];
		return [
			{
				scopeType: item.scopeType,
				scopeId: item.scopeId.trim(),
				relation: item.relation,
			},
		];
	});
}

export function normalizeContentOrganizationRelations(value: unknown): ContentOrganizationRelation[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item) => {
		if (!isContentOrganizationRelation(item)) return [];
		return [
			{
				organizationId: item.organizationId.trim(),
				relation: item.relation,
			},
		];
	});
}
