import { Injectable, inject } from '@angular/core';
import type { BattleEncounter } from '../../models/battle-encounter-model';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import type { CampaignWorld } from '../../models/campaign-world-model';
import type { SavedEncounter } from '../local-storage-service/local-storage-service';
import { WorkspaceStorageService } from '../workspace-service/workspace-storage-service';

export type EncounterHubStatusFilter = 'all' | 'prepared' | 'active' | 'paused' | 'completed';
export type EncounterHubLifecycleFilter = 'active' | 'archived' | 'all';
export type EncounterHubSortOption = 'smart' | 'recent' | 'oldest' | 'updated' | 'name';
export type EncounterHubGroupLabel =
	| 'Hoje'
	| 'Ontem'
	| 'Últimos 7 dias'
	| 'Este mês'
	| 'Mais antigos';

export interface EncounterHubFilters {
	query: string;
	tag: string;
	lifecycle: EncounterHubLifecycleFilter;
	empireId: string;
	stateId: string;
	settlementId: string;
	organizationId: string;
	status: EncounterHubStatusFilter;
	sort: EncounterHubSortOption;
}

export interface EncounterHubItem {
	encounter: SavedEncounter;
	activeBattle: BattleEncounter | null;
	latestBattle: BattleEncounter | null;
	status: Exclude<EncounterHubStatusFilter, 'all'>;
	referenceTimestamp: number;
	combatantCount: number;
}

@Injectable({ providedIn: 'root' })
export class EncounterHubFilterService {
	private readonly storageKey = APP_STORAGE_KEYS.encounterHubFilters;
	private readonly storage = inject(WorkspaceStorageService);

	loadFilters(): EncounterHubFilters {
		try {
			const raw = this.storage.getItem(this.storageKey);
			if (!raw) return this.defaultFilters();

			return this.normalizeFilters(JSON.parse(raw));
		} catch {
			return this.defaultFilters();
		}
	}

	normalizeFilters(value: unknown): EncounterHubFilters {
		const parsed = value && typeof value === 'object' && !Array.isArray(value)
			? (value as Partial<EncounterHubFilters>)
			: {};
		return {
			query: typeof parsed.query === 'string' ? parsed.query : '',
			tag: typeof parsed.tag === 'string' ? parsed.tag : 'all',
			lifecycle: this.normalizeLifecycle(parsed.lifecycle),
			empireId: typeof parsed.empireId === 'string' ? parsed.empireId : 'all',
			stateId: typeof parsed.stateId === 'string' ? parsed.stateId : 'all',
			settlementId: typeof parsed.settlementId === 'string' ? parsed.settlementId : 'all',
			organizationId: typeof parsed.organizationId === 'string' ? parsed.organizationId : 'all',
			status: this.normalizeStatus(parsed.status),
			sort: this.normalizeSort(parsed.sort),
		};
	}

	saveFilters(filters: EncounterHubFilters) {
		this.storage.setItem(this.storageKey, JSON.stringify(filters));
	}

	buildItems(encounters: SavedEncounter[], battles: BattleEncounter[]): EncounterHubItem[] {
		return encounters.map((encounter) => {
			const relatedBattles = battles
				.filter((battle) => battle.sourceEncounterId === encounter.id)
				.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
			const activeBattle =
				relatedBattles.find((battle) => battle.status === 'active' || battle.status === 'paused') ?? null;
			const latestBattle = relatedBattles[0] ?? null;
			const status = activeBattle?.status ?? (latestBattle?.status === 'completed' ? 'completed' : 'prepared');
			const referenceTimestamp = activeBattle
				? Date.parse(activeBattle.updatedAt)
				: latestBattle
					? Date.parse(latestBattle.updatedAt)
					: encounter.updatedAt;

			return {
				encounter,
				activeBattle,
				latestBattle,
				status,
				referenceTimestamp,
				combatantCount: activeBattle?.combatants.length ?? encounter.participants.length,
			};
		});
	}

	filterItems(
		items: EncounterHubItem[],
		filters: EncounterHubFilters,
		world: CampaignWorld | null = null,
	): EncounterHubItem[] {
		const query = normalizeFilterText(filters.query);

		return items.filter((item) => {
			if (filters.lifecycle === 'active' && item.encounter.archived) return false;
			if (filters.lifecycle === 'archived' && !item.encounter.archived) return false;
			if (filters.status !== 'all' && item.status !== filters.status) return false;
			if (
				filters.tag !== 'all' &&
				!item.encounter.tags.some((tag) => normalizeFilterText(tag) === normalizeFilterText(filters.tag))
			)
				return false;
			if (!matchesLocationFilters(item.encounter.locationRefs ?? [], filters, world)) return false;
			if (
				filters.organizationId !== 'all' &&
				!(item.encounter.organizationRefs ?? []).some(
					(ref) => ref.organizationId === filters.organizationId,
				)
			)
				return false;
			if (!query) return true;

			const tags = item.encounter.tags;
			const description = item.encounter.description ?? '';
			const creatureNames = item.encounter.participants.map((participant) => participant.name).join(' ');
			const notes = item.encounter.notes ?? '';

			const haystack = normalizeFilterText([
				item.encounter.title,
				description,
				tags.join(' '),
				creatureNames,
				notes,
				item.latestBattle?.name ?? '',
			].join(' '));

			return haystack.includes(query);
		});
	}

	sortItems(items: EncounterHubItem[], sort: EncounterHubSortOption): EncounterHubItem[] {
		const sorted = [...items];

		if (sort === 'name') {
			return sorted.sort((left, right) => left.encounter.title.localeCompare(right.encounter.title));
		}

		if (sort === 'oldest') {
			return sorted.sort((left, right) => left.referenceTimestamp - right.referenceTimestamp);
		}

		if (sort === 'recent' || sort === 'updated') {
			return sorted.sort((left, right) => right.referenceTimestamp - left.referenceTimestamp);
		}

		return sorted.sort((left, right) => {
			const leftPriority = this.smartPriority(left);
			const rightPriority = this.smartPriority(right);

			if (leftPriority !== rightPriority) return leftPriority - rightPriority;
			return right.referenceTimestamp - left.referenceTimestamp;
		});
	}

	groupItems(items: EncounterHubItem[], now = new Date()): Array<{ label: EncounterHubGroupLabel; items: EncounterHubItem[] }> {
		const groups = new Map<EncounterHubGroupLabel, EncounterHubItem[]>();
		const orderedLabels: EncounterHubGroupLabel[] = [
			'Hoje',
			'Ontem',
			'Últimos 7 dias',
			'Este mês',
			'Mais antigos',
		];

		for (const item of items) {
			const label = this.groupLabelForTimestamp(item.referenceTimestamp, now);
			const existing = groups.get(label) ?? [];
			existing.push(item);
			groups.set(label, existing);
		}

		return orderedLabels
			.filter((label) => (groups.get(label)?.length ?? 0) > 0)
			.map((label) => ({ label, items: groups.get(label) ?? [] }));
	}

	private groupLabelForTimestamp(timestamp: number, now: Date): EncounterHubGroupLabel {
		const target = new Date(timestamp);
		const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const diffMs = startOfToday - new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffDays <= 0) return 'Hoje';
		if (diffDays === 1) return 'Ontem';
		if (diffDays <= 6) return 'Últimos 7 dias';
		if (target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth()) {
			return 'Este mês';
		}
		return 'Mais antigos';
	}

	private smartPriority(item: EncounterHubItem): number {
		if (item.status === 'active') return 0;
		if (item.status === 'paused') return 1;
		if (item.status === 'prepared') return 2;
		return 3;
	}

	private defaultFilters(): EncounterHubFilters {
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
		};
	}

	private normalizeLifecycle(value: unknown): EncounterHubLifecycleFilter {
		if (value === 'active' || value === 'archived' || value === 'all') return value;
		return 'active';
	}

	private normalizeStatus(value: unknown): EncounterHubStatusFilter {
		if (
			value === 'all' ||
			value === 'prepared' ||
			value === 'active' ||
			value === 'paused' ||
			value === 'completed'
		) {
			return value;
		}
		return 'all';
	}

	private normalizeSort(value: unknown): EncounterHubSortOption {
		if (
			value === 'smart' ||
			value === 'recent' ||
			value === 'oldest' ||
			value === 'updated' ||
			value === 'name'
		) {
			return value;
		}
		return 'smart';
	}
}

type ResolvedRelation = {
	scopeType: 'empire' | 'state' | 'settlement';
	empireId: string;
	stateId?: string;
	settlementId?: string;
};

function normalizeFilterText(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '');
}

function matchesLocationFilters(
	locationRefs: NonNullable<SavedEncounter['locationRefs']>,
	filters: EncounterHubFilters,
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
		return !!selectedState && relation.scopeType !== 'empire' && relation.stateId === selectedState.id;
	}
	const selectedSettlement = world.settlements.find((settlement) => settlement.id === scopeId);
	return !!selectedSettlement && relation.scopeType === 'settlement' && relation.settlementId === scopeId;
}
