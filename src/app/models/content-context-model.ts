import type { CampaignLocationScope } from './campaign-world-model';

export type ContentLocationRelationKind =
	| 'base'
	| 'occurrence'
	| 'habitat'
	| 'operation';

export type ContentOrganizationRelationKind =
	| 'member'
	| 'leader'
	| 'affiliated'
	| 'institution'
	| 'trained_by';

export interface ContentLocationRelation {
	scopeType: CampaignLocationScope;
	scopeId: string;
	relation: ContentLocationRelationKind;
}

export interface ContentOrganizationRelation {
	organizationId: string;
	relation: ContentOrganizationRelationKind;
}

const LOCATION_RELATION_KINDS: ContentLocationRelationKind[] = [
	'base',
	'occurrence',
	'habitat',
	'operation',
];
const ORGANIZATION_RELATION_KINDS: ContentOrganizationRelationKind[] = [
	'member',
	'leader',
	'affiliated',
	'institution',
	'trained_by',
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.trim();
	return normalized || null;
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
