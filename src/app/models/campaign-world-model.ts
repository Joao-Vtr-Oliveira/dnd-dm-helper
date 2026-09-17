import type { CampaignCalendar, DeityId, Season } from './calendar-model';

export type CampaignSettlementType = string;
export type CampaignOrganizationType = string;
export type CampaignOrganizationScope = 'campaign' | 'regional' | 'local';
export type CampaignPointOfInterestType = string;
export type CampaignWorldScopeType = 'global' | 'empire' | 'state' | 'settlement';
export type CampaignLocationScope = Exclude<CampaignWorldScopeType, 'global'>;

export interface CampaignEmpire {
	id: string;
	name: string;
	aliases: string[];
	sourcePath?: string;
}

export interface CampaignState extends CampaignEmpire {
	empireId: string;
}

export interface CampaignSettlement extends CampaignEmpire {
	stateId: string;
	settlementType: CampaignSettlementType;
}

export interface CampaignOrganizationPresence {
	scopeType: CampaignWorldScopeType;
	scopeId?: string;
	presenceType: string;
	availableSheetExternalIds?: string[];
}

export interface CampaignOrganization extends CampaignEmpire {
	organizationType: CampaignOrganizationType;
	/** Controls where the organization is managed in the World UI. */
	scope?: CampaignOrganizationScope;
	parentOrganizationId?: string;
	presence: CampaignOrganizationPresence[];
	archived?: boolean;
}

export interface CampaignPointOfInterest extends CampaignEmpire {
	settlementId: string;
	poiType: CampaignPointOfInterestType;
	summary?: string;
	organizationIds?: string[];
}

export interface CampaignWorld {
	schemaVersion: 1;
	calendar: CampaignCalendar;
	empires: CampaignEmpire[];
	states: CampaignState[];
	settlements: CampaignSettlement[];
	organizations: CampaignOrganization[];
	pointsOfInterest: CampaignPointOfInterest[];
}

export interface CampaignLocationRef {
	scopeType: CampaignLocationScope;
	scopeId: string;
}

export interface ResolvedCampaignLocation {
	ref: CampaignLocationRef;
	empire: CampaignEmpire | null;
	state: CampaignState | null;
	settlement: CampaignSettlement | null;
	label: string;
	breadcrumb: string[];
}

export type CampaignWorldLocationEntity = CampaignEmpire | CampaignState | CampaignSettlement;

export interface CampaignLocationSearchResult {
	ref: CampaignLocationRef;
	entity: CampaignWorldLocationEntity;
	entityType: CampaignLocationScope;
	label: string;
	breadcrumb: string[];
}

export interface CampaignPointOfInterestSearchResult {
	pointOfInterest: CampaignPointOfInterest;
	settlement: CampaignSettlement;
	state: CampaignState;
	empire: CampaignEmpire;
	label: string;
	breadcrumb: string[];
}

export interface RelevantCampaignOrganization {
	organization: CampaignOrganization;
	directPresences: CampaignOrganizationPresence[];
	broaderPresences: CampaignOrganizationPresence[];
}

export const SETTLEMENT_TYPE_LABELS: Record<string, string> = {
	village: 'Vila',
	city: 'Cidade',
	capital: 'Capital',
	other: 'Custom',
};

export const POINT_OF_INTEREST_TYPE_LABELS: Record<string, string> = {
	academy: 'Academia',
	district: 'Distrito',
	government: 'Governo',
	inn: 'Estalagem',
	landmark: 'Marco',
	market: 'Mercado',
	natural: 'Natural',
	organization: 'Organização',
	other: 'Custom',
	port: 'Porto',
	residence: 'Residência',
	shop: 'Loja',
	tavern: 'Taverna',
	temple: 'Templo',
	workshop: 'Oficina',
};

export function normalizeCampaignWorldSearchText(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLocaleLowerCase()
		.trim();
}

export interface CampaignWorldValidationResult {
	valid: boolean;
	world?: CampaignWorld;
	error?: string;
}

const ORGANIZATION_SCOPES: CampaignOrganizationScope[] = ['campaign', 'regional', 'local'];

/** Older worlds did not classify organizations. Preserve them with a deterministic fallback. */
export function resolveCampaignOrganizationScope(
	organization: Pick<CampaignOrganization, 'scope' | 'presence'>,
): CampaignOrganizationScope {
	if (organization.scope) return organization.scope;
	if (organization.presence.some((presence) => presence.scopeType === 'global')) return 'campaign';
	const locationKeys = new Set(
		organization.presence
			.filter((presence) => presence.scopeType !== 'global')
			.map((presence) => `${presence.scopeType}:${presence.scopeId ?? ''}`),
	);
	return locationKeys.size === 1 && organization.presence.every((presence) => presence.scopeType === 'settlement')
		? 'local'
		: 'regional';
}

const SETTLEMENT_TYPES: CampaignSettlementType[] = ['village', 'city', 'capital', 'other'];
const POINT_OF_INTEREST_TYPES: CampaignPointOfInterestType[] = [
	'academy',
	'district',
	'government',
	'inn',
	'landmark',
	'market',
	'natural',
	'organization',
	'other',
	'port',
	'residence',
	'shop',
	'tavern',
	'temple',
	'workshop',
];
const WORLD_SCOPE_TYPES: CampaignWorldScopeType[] = ['global', 'empire', 'state', 'settlement'];

interface UnknownCampaignRecord {
	schemaVersion?: unknown;
	calendar?: unknown;
	empires?: unknown;
	states?: unknown;
	settlements?: unknown;
	organizations?: unknown;
	pointsOfInterest?: unknown;
	id?: unknown;
	name?: unknown;
	aliases?: unknown;
	sourcePath?: unknown;
	empireId?: unknown;
	stateId?: unknown;
	settlementId?: unknown;
	settlementType?: unknown;
	organizationType?: unknown;
	scope?: unknown;
	poiType?: unknown;
	summary?: unknown;
	organizationIds?: unknown;
	parentOrganizationId?: unknown;
	presence?: unknown;
	archived?: unknown;
	scopeType?: unknown;
	scopeId?: unknown;
	presenceType?: unknown;
	availableSheetExternalIds?: unknown;
	daysPerSeason?: unknown;
	seasons?: unknown;
	epochDate?: unknown;
	events?: unknown;
	color?: unknown;
	label?: unknown;
	year?: unknown;
	day?: unknown;
	hour?: unknown;
	minute?: unknown;
	title?: unknown;
	deity?: unknown;
	description?: unknown;
	tags?: unknown;
	[key: string]: unknown;
}

function isRecord(value: unknown): value is UnknownCampaignRecord {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function hasStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateBaseEntity(value: unknown, type: string): string | null {
	if (!isRecord(value)) return `${type} inválido.`;
	if (
		!hasText(value.id) ||
		!hasText(value.name) ||
		(value.sourcePath !== undefined && !hasText(value.sourcePath))
	) {
		return `${type} possui campos obrigatórios inválidos.`;
	}
	if (!hasStringArray(value.aliases)) return `${type} possui aliases inválidos.`;
	return null;
}

function validateUniqueIds(items: Array<{ id: string }>, type: string): string | null {
	const ids = new Set<string>();
	for (const item of items) {
		if (ids.has(item.id)) return `ID duplicado em ${type}: ${item.id}.`;
		ids.add(item.id);
	}
	return null;
}

const SEASON_IDS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const DEITY_IDS: DeityId[] = [
	'luuren',
	'atronos',
	'dreyc',
	'ruuz',
	'vozc',
	'luna',
	'pulacc',
	'geraldo',
	'achos',
];

function isIntegerInRange(value: unknown, min: number, max?: number): value is number {
	return (
		typeof value === 'number' &&
		Number.isInteger(value) &&
		value >= min &&
		(max === undefined || value <= max)
	);
}

function validateCalendar(raw: unknown): string | null {
	if (!isRecord(raw)) return 'Calendário da campanha inválido.';
	if (!isIntegerInRange(raw.daysPerSeason, 1)) {
		return 'Calendário possui duração de estação inválida.';
	}
	if (!Array.isArray(raw.seasons) || raw.seasons.length !== SEASON_IDS.length) {
		return 'Calendário possui estações inválidas.';
	}

	const seasonIds = new Set<Season>();
	for (const season of raw.seasons) {
		if (
			!isRecord(season) ||
			!SEASON_IDS.includes(season.id as Season) ||
			!hasText(season.label) ||
			!hasText(season.color) ||
			seasonIds.has(season.id as Season)
		) {
			return 'Calendário possui estação inválida.';
		}
		seasonIds.add(season.id as Season);
	}
	if (seasonIds.size !== SEASON_IDS.length) return 'Calendário possui estações incompletas.';

	if (!isRecord(raw.epochDate)) return 'Calendário possui data-base inválida.';
	const epochDate = raw.epochDate;
	if (
		!isIntegerInRange(epochDate.year, 0) ||
		!SEASON_IDS.includes(epochDate['season'] as Season) ||
		!isIntegerInRange(epochDate.day, 1, raw.daysPerSeason as number) ||
		!isIntegerInRange(epochDate.hour, 0, 23) ||
		!isIntegerInRange(epochDate.minute, 0, 59)
	) {
		return 'Calendário possui data-base inválida.';
	}

	if (!Array.isArray(raw.events)) return 'Calendário possui eventos inválidos.';
	const eventIds = new Set<string>();
	for (const event of raw.events) {
		if (
			!isRecord(event) ||
			!hasText(event.id) ||
			eventIds.has(event.id) ||
			!SEASON_IDS.includes(event['season'] as Season) ||
			!isIntegerInRange(event.day, 1, raw.daysPerSeason as number) ||
			!hasText(event.title) ||
			!hasText(event.description) ||
			(event.deity !== undefined && !hasText(event.deity)) ||
			(event.tags !== undefined && !hasStringArray(event.tags))
		) {
			return 'Calendário possui evento inválido.';
		}
		eventIds.add(event.id);
	}

	return null;
}

export function validateCampaignWorld(raw: unknown): CampaignWorldValidationResult {
	if (!isRecord(raw)) return { valid: false, error: 'Catálogo da campanha inválido.' };
	if (raw.schemaVersion !== 1) {
		return { valid: false, error: 'Versão do catálogo da campanha incompatível.' };
	}
	if (
		!isRecord(raw.calendar) ||
		!Array.isArray(raw.empires) ||
		!Array.isArray(raw.states) ||
		!Array.isArray(raw.settlements) ||
		!Array.isArray(raw.organizations) ||
		!Array.isArray(raw.pointsOfInterest)
	) {
		return { valid: false, error: 'Catálogo da campanha possui coleções obrigatórias inválidas.' };
	}
	const calendarError = validateCalendar(raw.calendar);
	if (calendarError) return { valid: false, error: calendarError };

	for (const empire of raw.empires) {
		const error = validateBaseEntity(empire, 'Império');
		if (error) return { valid: false, error };
	}
	for (const state of raw.states) {
		const error = validateBaseEntity(state, 'Estado');
		if (error || !isRecord(state) || !hasText(state.empireId)) {
			return { valid: false, error: error ?? 'Estado possui império inválido.' };
		}
	}
	for (const settlement of raw.settlements) {
		const error = validateBaseEntity(settlement, 'Localidade');
		if (
			error ||
			!isRecord(settlement) ||
			!hasText(settlement.stateId) ||
			!SETTLEMENT_TYPES.includes(settlement.settlementType as CampaignSettlementType)
		) {
			return { valid: false, error: error ?? 'Localidade possui campos geográficos inválidos.' };
		}
	}
	for (const organization of raw.organizations) {
		const error = validateBaseEntity(organization, 'Organização');
		if (
			error ||
			!isRecord(organization) ||
			!hasText(organization.organizationType) ||
			!Array.isArray(organization.presence) ||
			(organization.scope !== undefined &&
				!ORGANIZATION_SCOPES.includes(organization.scope as CampaignOrganizationScope)) ||
			(organization.parentOrganizationId !== undefined &&
				!hasText(organization.parentOrganizationId)) ||
			(organization.archived !== undefined && typeof organization.archived !== 'boolean')
		) {
			return { valid: false, error: error ?? 'Organização possui campos inválidos.' };
		}
		for (const presence of organization.presence) {
			if (
				!isRecord(presence) ||
				!WORLD_SCOPE_TYPES.includes(presence.scopeType as CampaignWorldScopeType) ||
				!hasText(presence.presenceType) ||
				(presence.scopeId !== undefined && !hasText(presence.scopeId)) ||
				(presence.scopeType !== 'global' && !hasText(presence.scopeId)) ||
				(presence.availableSheetExternalIds !== undefined &&
					(!hasStringArray(presence.availableSheetExternalIds) ||
						presence.availableSheetExternalIds.some((externalId) => !hasText(externalId))))
			) {
				return { valid: false, error: 'Presença de organização inválida.' };
			}
		}
	}
	for (const pointOfInterest of raw.pointsOfInterest) {
		const error = validateBaseEntity(pointOfInterest, 'Ponto de interesse');
		if (
			error ||
			!isRecord(pointOfInterest) ||
			!hasText(pointOfInterest.settlementId) ||
			!POINT_OF_INTEREST_TYPES.includes(pointOfInterest.poiType as CampaignPointOfInterestType) ||
			(pointOfInterest.summary !== undefined && !hasText(pointOfInterest.summary)) ||
			(pointOfInterest.organizationIds !== undefined &&
				!hasStringArray(pointOfInterest.organizationIds))
		) {
			return { valid: false, error: error ?? 'Ponto de interesse possui campos inválidos.' };
		}
	}

	const world: CampaignWorld = raw as unknown as CampaignWorld;
	for (const [items, type] of [
		[world.empires, 'impérios'],
		[world.states, 'estados'],
		[world.settlements, 'localidades'],
		[world.organizations, 'organizações'],
		[world.pointsOfInterest, 'pontos de interesse'],
	] as const) {
		const error = validateUniqueIds(items, type);
		if (error) return { valid: false, error };
	}

	const empireIds = new Set(world.empires.map((item) => item.id));
	const stateIds = new Set(world.states.map((item) => item.id));
	const settlementIds = new Set(world.settlements.map((item) => item.id));
	const organizationIds = new Set(world.organizations.map((item) => item.id));
	for (const state of world.states) {
		if (!empireIds.has(state.empireId)) {
			return { valid: false, error: `Estado referencia império inexistente: ${state.empireId}.` };
		}
	}
	for (const settlement of world.settlements) {
		if (!stateIds.has(settlement.stateId)) {
			return {
				valid: false,
				error: `Localidade referencia estado inexistente: ${settlement.stateId}.`,
			};
		}
	}
	for (const organization of world.organizations) {
		if (
			organization.parentOrganizationId &&
			!organizationIds.has(organization.parentOrganizationId)
		) {
			return {
				valid: false,
				error: `Organização referencia organização pai inexistente: ${organization.parentOrganizationId}.`,
			};
		}
		for (const presence of organization.presence) {
			if (presence.scopeType === 'empire' && !empireIds.has(presence.scopeId!)) {
				return {
					valid: false,
					error: `Presença referencia império inexistente: ${presence.scopeId}.`,
				};
			}
			if (presence.scopeType === 'state' && !stateIds.has(presence.scopeId!)) {
				return {
					valid: false,
					error: `Presença referencia estado inexistente: ${presence.scopeId}.`,
				};
			}
			if (presence.scopeType === 'settlement' && !settlementIds.has(presence.scopeId!)) {
				return {
					valid: false,
					error: `Presença referencia localidade inexistente: ${presence.scopeId}.`,
				};
			}
		}
	}
	for (const pointOfInterest of world.pointsOfInterest) {
		if (!settlementIds.has(pointOfInterest.settlementId)) {
			return {
				valid: false,
				error: `Ponto de interesse referencia localidade inexistente: ${pointOfInterest.settlementId}.`,
			};
		}
		for (const organizationId of pointOfInterest.organizationIds ?? []) {
			if (!organizationIds.has(organizationId)) {
				return {
					valid: false,
					error: `Ponto de interesse referencia organização inexistente: ${organizationId}.`,
				};
			}
		}
	}

	return { valid: true, world };
}

export function isCampaignLocationRef(raw: unknown): raw is CampaignLocationRef {
	if (!isRecord(raw) || !hasText(raw.scopeId)) return false;
	return raw.scopeType === 'empire' || raw.scopeType === 'state' || raw.scopeType === 'settlement';
}
