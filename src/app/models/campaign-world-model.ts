export type CampaignSettlementType = 'village' | 'city' | 'capital' | 'other';
export type CampaignOrganizationType = 'guild' | 'group' | 'cult' | 'family';
export type CampaignWorldScopeType = 'global' | 'empire' | 'state' | 'settlement';
export type CampaignLocationScope = Exclude<CampaignWorldScopeType, 'global'>;

export interface CampaignEmpire {
	id: string;
	name: string;
	aliases: string[];
	sourcePath: string;
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
}

export interface CampaignOrganization extends CampaignEmpire {
	organizationType: CampaignOrganizationType;
	parentOrganizationId?: string;
	presence: CampaignOrganizationPresence[];
}

export interface CampaignWorld {
	schemaVersion: 1;
	empires: CampaignEmpire[];
	states: CampaignState[];
	settlements: CampaignSettlement[];
	organizations: CampaignOrganization[];
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

export const SETTLEMENT_TYPE_LABELS: Record<CampaignSettlementType, string> = {
	village: 'Vila',
	city: 'Cidade',
	capital: 'Capital',
	other: 'Localidade',
};

export interface CampaignWorldValidationResult {
	valid: boolean;
	world?: CampaignWorld;
	error?: string;
}

const SETTLEMENT_TYPES: CampaignSettlementType[] = ['village', 'city', 'capital', 'other'];
const ORGANIZATION_TYPES: CampaignOrganizationType[] = ['guild', 'group', 'cult', 'family'];
const WORLD_SCOPE_TYPES: CampaignWorldScopeType[] = ['global', 'empire', 'state', 'settlement'];

interface UnknownCampaignRecord {
	schemaVersion?: unknown;
	empires?: unknown;
	states?: unknown;
	settlements?: unknown;
	organizations?: unknown;
	id?: unknown;
	name?: unknown;
	aliases?: unknown;
	sourcePath?: unknown;
	empireId?: unknown;
	stateId?: unknown;
	settlementType?: unknown;
	organizationType?: unknown;
	parentOrganizationId?: unknown;
	presence?: unknown;
	scopeType?: unknown;
	scopeId?: unknown;
	presenceType?: unknown;
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
	if (!hasText(value.id) || !hasText(value.name) || !hasText(value.sourcePath)) {
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

export function validateCampaignWorld(raw: unknown): CampaignWorldValidationResult {
	if (!isRecord(raw)) return { valid: false, error: 'Catálogo da campanha inválido.' };
	if (raw.schemaVersion !== 1) {
		return { valid: false, error: 'Versão do catálogo da campanha incompatível.' };
	}
	if (
		!Array.isArray(raw.empires) ||
		!Array.isArray(raw.states) ||
		!Array.isArray(raw.settlements) ||
		!Array.isArray(raw.organizations)
	) {
		return { valid: false, error: 'Catálogo da campanha possui coleções obrigatórias inválidas.' };
	}

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
			!ORGANIZATION_TYPES.includes(organization.organizationType as CampaignOrganizationType) ||
			!Array.isArray(organization.presence) ||
			(organization.parentOrganizationId !== undefined && !hasText(organization.parentOrganizationId))
		) {
			return { valid: false, error: error ?? 'Organização possui campos inválidos.' };
		}
		for (const presence of organization.presence) {
			if (
				!isRecord(presence) ||
				!WORLD_SCOPE_TYPES.includes(presence.scopeType as CampaignWorldScopeType) ||
				!hasText(presence.presenceType) ||
				(presence.scopeId !== undefined && !hasText(presence.scopeId)) ||
				(presence.scopeType !== 'global' && !hasText(presence.scopeId))
			) {
				return { valid: false, error: 'Presença de organização inválida.' };
			}
		}
	}

	const world: CampaignWorld = raw as unknown as CampaignWorld;
	for (const [items, type] of [
		[world.empires, 'impérios'],
		[world.states, 'estados'],
		[world.settlements, 'localidades'],
		[world.organizations, 'organizações'],
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
			return { valid: false, error: `Localidade referencia estado inexistente: ${settlement.stateId}.` };
		}
	}
	for (const organization of world.organizations) {
		if (organization.parentOrganizationId && !organizationIds.has(organization.parentOrganizationId)) {
			return {
				valid: false,
				error: `Organização referencia organização pai inexistente: ${organization.parentOrganizationId}.`,
			};
		}
		for (const presence of organization.presence) {
			if (presence.scopeType === 'empire' && !empireIds.has(presence.scopeId!)) {
				return { valid: false, error: `Presença referencia império inexistente: ${presence.scopeId}.` };
			}
			if (presence.scopeType === 'state' && !stateIds.has(presence.scopeId!)) {
				return { valid: false, error: `Presença referencia estado inexistente: ${presence.scopeId}.` };
			}
			if (presence.scopeType === 'settlement' && !settlementIds.has(presence.scopeId!)) {
				return { valid: false, error: `Presença referencia localidade inexistente: ${presence.scopeId}.` };
			}
		}
	}

	return { valid: true, world };
}

export function isCampaignLocationRef(raw: unknown): raw is CampaignLocationRef {
	if (!isRecord(raw) || !hasText(raw.scopeId)) return false;
	return raw.scopeType === 'empire' || raw.scopeType === 'state' || raw.scopeType === 'settlement';
}
