import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
	type CampaignEmpire,
	type CampaignLocationRef,
	type CampaignLocationSearchResult,
	type CampaignOrganization,
	type CampaignOrganizationPresence,
	type CampaignPointOfInterest,
	type CampaignPointOfInterestSearchResult,
	type CampaignSettlement,
	type CampaignState,
	type CampaignWorld,
	type CampaignWorldScopeType,
	type ResolvedCampaignLocation,
	type RelevantCampaignOrganization,
	SETTLEMENT_TYPE_LABELS,
	normalizeCampaignWorldSearchText,
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
	private pointsOfInterestById = new Map<string, CampaignPointOfInterest>();
	private statesByEmpireId = new Map<string, CampaignState[]>();
	private settlementsByStateId = new Map<string, CampaignSettlement[]>();
	private pointsOfInterestBySettlementId = new Map<string, CampaignPointOfInterest[]>();
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

	getPointOfInterest(id: string): CampaignPointOfInterest | null {
		return this.pointsOfInterestById.get(id) ?? null;
	}

	getStatesByEmpire(empireId: string): CampaignState[] {
		return this.statesByEmpireId.get(empireId) ?? [];
	}

	getSettlementsByState(stateId: string): CampaignSettlement[] {
		return this.settlementsByStateId.get(stateId) ?? [];
	}

	getPointsOfInterestBySettlement(settlementId: string): CampaignPointOfInterest[] {
		return this.pointsOfInterestBySettlementId.get(settlementId) ?? [];
	}

	getOrganizationsByScope(
		scope: Pick<CampaignOrganizationPresence, 'scopeType' | 'scopeId'>,
	): CampaignOrganization[] {
		return this.organizationsByScope.get(this.scopeKey(scope.scopeType, scope.scopeId)) ?? [];
	}

	searchLocations(query: string): CampaignLocationSearchResult[] {
		const normalizedQuery = normalizeCampaignWorldSearchText(query);
		if (!normalizedQuery) return [];
		const results: CampaignLocationSearchResult[] = [];
		for (const [items, scopeType] of [
			[this.world()?.empires ?? [], 'empire'],
			[this.world()?.states ?? [], 'state'],
			[this.world()?.settlements ?? [], 'settlement'],
		] as const) {
			for (const entity of items) {
				if (!this.matchesLocationSearch(entity, normalizedQuery)) continue;
				const ref: CampaignLocationRef = { scopeType, scopeId: entity.id };
				const resolved = this.resolveLocation(ref);
				if (!resolved) continue;
				results.push({
					ref,
					entity,
					entityType: scopeType,
					label: resolved.label,
					breadcrumb: resolved.breadcrumb,
				});
			}
		}
		return results.sort((left, right) => left.label.localeCompare(right.label));
	}

	searchPointsOfInterest(query: string): CampaignPointOfInterestSearchResult[] {
		const normalizedQuery = normalizeCampaignWorldSearchText(query);
		if (!normalizedQuery) return [];
		const results: CampaignPointOfInterestSearchResult[] = [];
		for (const pointOfInterest of this.world()?.pointsOfInterest ?? []) {
			if (!this.matchesLocationSearch(pointOfInterest, normalizedQuery)) continue;
			const settlement = this.getSettlement(pointOfInterest.settlementId);
			const state = settlement && this.getState(settlement.stateId);
			const empire = state && this.getEmpire(state.empireId);
			if (!settlement || !state || !empire) continue;
			const resolvedSettlement = this.resolveLocation({
				scopeType: 'settlement',
				scopeId: settlement.id,
			});
			if (!resolvedSettlement) continue;
			results.push({
				pointOfInterest,
				settlement,
				state,
				empire,
				label: pointOfInterest.name,
				breadcrumb: resolvedSettlement.breadcrumb,
			});
		}
		return results.sort(
			(left, right) =>
				left.label.localeCompare(right.label) ||
				left.breadcrumb.join('\u0000').localeCompare(right.breadcrumb.join('\u0000')),
		);
	}

	getRelevantOrganizations(ref: CampaignLocationRef): RelevantCampaignOrganization[] {
		const resolved = this.resolveLocation(ref);
		if (!resolved) return [];
		const directKey = this.scopeKey(ref.scopeType, ref.scopeId);
		const broaderKeys = [this.scopeKey('global')];
		if (resolved.empire && ref.scopeType !== 'empire') {
			broaderKeys.push(this.scopeKey('empire', resolved.empire.id));
		}
		if (resolved.state && ref.scopeType === 'settlement') {
			broaderKeys.push(this.scopeKey('state', resolved.state.id));
		}
		const relevantKeys = new Set([directKey, ...broaderKeys]);
		return (this.world()?.organizations ?? [])
			.map((organization) => {
				const relevant = organization.presence.filter((presence) =>
					relevantKeys.has(this.scopeKey(presence.scopeType, presence.scopeId)),
				);
				return {
					organization,
					directPresences: relevant.filter(
						(presence) => this.scopeKey(presence.scopeType, presence.scopeId) === directKey,
					),
					broaderPresences: relevant.filter(
						(presence) => this.scopeKey(presence.scopeType, presence.scopeId) !== directKey,
					),
				};
			})
			.filter((item) => item.directPresences.length || item.broaderPresences.length)
			.sort((left, right) => left.organization.name.localeCompare(right.organization.name));
	}

	resolveLocation(ref: CampaignLocationRef): ResolvedCampaignLocation | null {
		if (ref.scopeType === 'empire') {
			const empire = this.findLocation(this.world()?.empires ?? [], ref.scopeId);
			if (!empire) return null;
			return {
				ref: { scopeType: 'empire', scopeId: empire.id },
				empire,
				state: null,
				settlement: null,
				label: empire.name,
				breadcrumb: [empire.name],
			};
		}
		if (ref.scopeType === 'state') {
			const state = this.findLocation(this.world()?.states ?? [], ref.scopeId);
			if (!state) return null;
			const empire = this.getEmpire(state.empireId);
			if (!empire) return null;
			return {
				ref: { scopeType: 'state', scopeId: state.id },
				empire,
				state,
				settlement: null,
				label: state.name,
				breadcrumb: [empire.name, state.name],
			};
		}
		const settlement = this.findLocation(this.world()?.settlements ?? [], ref.scopeId);
		if (!settlement) return null;
		const state = this.getState(settlement.stateId);
		const empire = state ? this.getEmpire(state.empireId) : null;
		if (!state || !empire) return null;
		const settlementLabel = [empire.name, state.name].includes(settlement.name)
			? `${settlement.name} (${SETTLEMENT_TYPE_LABELS[settlement.settlementType]})`
			: settlement.name;
		return {
			ref: { scopeType: 'settlement', scopeId: settlement.id },
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
		this.pointsOfInterestById.clear();
		this.statesByEmpireId.clear();
		this.settlementsByStateId.clear();
		this.pointsOfInterestBySettlementId.clear();
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
		this.pointsOfInterestById = new Map(world.pointsOfInterest.map((item) => [item.id, item]));
		this.statesByEmpireId = this.groupBy(world.states, (item) => item.empireId);
		this.settlementsByStateId = this.groupBy(world.settlements, (item) => item.stateId);
		this.pointsOfInterestBySettlementId = this.groupBy(
			world.pointsOfInterest,
			(item) => item.settlementId,
		);
		this.organizationsByScope = new Map();
		for (const organization of world.organizations) {
			for (const presence of organization.presence) {
				const key = this.scopeKey(presence.scopeType, presence.scopeId);
				this.organizationsByScope.set(key, [
					...(this.organizationsByScope.get(key) ?? []),
					organization,
				]);
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

	private matchesLocationSearch(
		entity: Pick<CampaignEmpire, 'name' | 'aliases'>,
		normalizedQuery: string,
	): boolean {
		return [entity.name, ...entity.aliases].some((value) =>
			normalizeCampaignWorldSearchText(value).includes(normalizedQuery),
		);
	}

	private findLocation<T extends CampaignEmpire>(items: T[], value: string): T | null {
		const normalizedValue = normalizeCampaignWorldSearchText(value);
		return (
			items.find((item) =>
				[item.id, item.name, ...item.aliases].some(
					(candidate) => normalizeCampaignWorldSearchText(candidate) === normalizedValue,
				),
			) ?? null
		);
	}
}
