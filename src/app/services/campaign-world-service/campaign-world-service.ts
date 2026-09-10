import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
	type CampaignEmpire,
	type CampaignLocationRef,
	type CampaignOrganization,
	type CampaignOrganizationPresence,
	type CampaignSettlement,
	type CampaignState,
	type CampaignWorld,
	type CampaignWorldScopeType,
	type ResolvedCampaignLocation,
	SETTLEMENT_TYPE_LABELS,
	validateCampaignWorld,
} from '../../models/campaign-world-model';

export type CampaignWorldStatus = 'loading' | 'ready' | 'error';

@Injectable({ providedIn: 'root' })
export class CampaignWorldService {
	private readonly http = inject(HttpClient);
	private empiresById = new Map<string, CampaignEmpire>();
	private statesById = new Map<string, CampaignState>();
	private settlementsById = new Map<string, CampaignSettlement>();
	private organizationsById = new Map<string, CampaignOrganization>();
	private statesByEmpireId = new Map<string, CampaignState[]>();
	private settlementsByStateId = new Map<string, CampaignSettlement[]>();
	private organizationsByScope = new Map<string, CampaignOrganization[]>();

	readonly world = signal<CampaignWorld | null>(null);
	readonly status = signal<CampaignWorldStatus>('loading');
	readonly error = signal<string | null>(null);

	constructor() {
		this.load();
	}

	load(): void {
		this.status.set('loading');
		this.error.set(null);
		this.http.get<unknown>('/rpg_files/campaign-world.json').subscribe({
			next: (raw) => {
				const validation = validateCampaignWorld(raw);
				if (!validation.valid || !validation.world) {
					this.clearWorld(validation.error ?? 'Catálogo da campanha inválido.');
					return;
				}
				this.indexWorld(validation.world);
				this.world.set(validation.world);
				this.status.set('ready');
			},
			error: () => this.clearWorld('Não foi possível carregar o catálogo da campanha.'),
		});
	}

	getEmpire(id: string): CampaignEmpire | null {
		return this.empiresById.get(id) ?? null;
	}

	getState(id: string): CampaignState | null {
		return this.statesById.get(id) ?? null;
	}

	getSettlement(id: string): CampaignSettlement | null {
		return this.settlementsById.get(id) ?? null;
	}

	getOrganization(id: string): CampaignOrganization | null {
		return this.organizationsById.get(id) ?? null;
	}

	getStatesByEmpire(empireId: string): CampaignState[] {
		return this.statesByEmpireId.get(empireId) ?? [];
	}

	getSettlementsByState(stateId: string): CampaignSettlement[] {
		return this.settlementsByStateId.get(stateId) ?? [];
	}

	getOrganizationsByScope(scope: Pick<CampaignOrganizationPresence, 'scopeType' | 'scopeId'>): CampaignOrganization[] {
		return this.organizationsByScope.get(this.scopeKey(scope.scopeType, scope.scopeId)) ?? [];
	}

	resolveLocation(ref: CampaignLocationRef): ResolvedCampaignLocation | null {
		if (ref.scopeType === 'empire') {
			const empire = this.getEmpire(ref.scopeId);
			if (!empire) return null;
			return { ref, empire, state: null, settlement: null, label: empire.name, breadcrumb: [empire.name] };
		}
		if (ref.scopeType === 'state') {
			const state = this.getState(ref.scopeId);
			if (!state) return null;
			const empire = this.getEmpire(state.empireId);
			if (!empire) return null;
			return { ref, empire, state, settlement: null, label: state.name, breadcrumb: [empire.name, state.name] };
		}
		const settlement = this.getSettlement(ref.scopeId);
		if (!settlement) return null;
		const state = this.getState(settlement.stateId);
		const empire = state ? this.getEmpire(state.empireId) : null;
		if (!state || !empire) return null;
		const settlementLabel = [empire.name, state.name].includes(settlement.name)
			? `${settlement.name} (${SETTLEMENT_TYPE_LABELS[settlement.settlementType]})`
			: settlement.name;
		return {
			ref,
			empire,
			state,
			settlement,
			label: settlement.name,
			breadcrumb: [empire.name, state.name, settlementLabel],
		};
	}

	private clearWorld(error: string): void {
		this.empiresById.clear();
		this.statesById.clear();
		this.settlementsById.clear();
		this.organizationsById.clear();
		this.statesByEmpireId.clear();
		this.settlementsByStateId.clear();
		this.organizationsByScope.clear();
		this.world.set(null);
		this.error.set(error);
		this.status.set('error');
	}

	private indexWorld(world: CampaignWorld): void {
		this.empiresById = new Map(world.empires.map((item) => [item.id, item]));
		this.statesById = new Map(world.states.map((item) => [item.id, item]));
		this.settlementsById = new Map(world.settlements.map((item) => [item.id, item]));
		this.organizationsById = new Map(world.organizations.map((item) => [item.id, item]));
		this.statesByEmpireId = this.groupBy(world.states, (item) => item.empireId);
		this.settlementsByStateId = this.groupBy(world.settlements, (item) => item.stateId);
		this.organizationsByScope = new Map();
		for (const organization of world.organizations) {
			for (const presence of organization.presence) {
				const key = this.scopeKey(presence.scopeType, presence.scopeId);
				this.organizationsByScope.set(key, [...(this.organizationsByScope.get(key) ?? []), organization]);
			}
		}
	}

	private groupBy<T>(items: T[], keySelector: (item: T) => string): Map<string, T[]> {
		const groups = new Map<string, T[]>();
		for (const item of items) {
			const key = keySelector(item);
			groups.set(key, [...(groups.get(key) ?? []), item]);
		}
		return groups;
	}

	private scopeKey(scopeType: CampaignWorldScopeType, scopeId?: string): string {
		return `${scopeType}:${scopeId ?? ''}`;
	}
}
