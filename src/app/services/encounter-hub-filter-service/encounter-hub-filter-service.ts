import { Injectable } from '@angular/core';
import type { BattleEncounter } from '../../models/battle-encounter-model';
import type { SavedEncounter } from '../local-storage-service/local-storage-service';

export type EncounterHubStatusFilter = 'all' | 'prepared' | 'active' | 'paused' | 'completed';
export type EncounterHubSortOption = 'smart' | 'recent' | 'oldest' | 'updated' | 'name';
export type EncounterHubGroupLabel =
	| 'Hoje'
	| 'Ontem'
	| 'Últimos 7 dias'
	| 'Este mês'
	| 'Mais antigos';

export interface EncounterHubFilters {
	query: string;
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
	private readonly storageKey = 'dnd-dm-helper.encounter-hub.filters.v1';

	loadFilters(): EncounterHubFilters {
		try {
			const raw = localStorage.getItem(this.storageKey);
			if (!raw) return this.defaultFilters();

			const parsed = JSON.parse(raw) as Partial<EncounterHubFilters>;
			return {
				query: typeof parsed.query === 'string' ? parsed.query : '',
				status: this.normalizeStatus(parsed.status),
				sort: this.normalizeSort(parsed.sort),
			};
		} catch {
			return this.defaultFilters();
		}
	}

	saveFilters(filters: EncounterHubFilters) {
		localStorage.setItem(this.storageKey, JSON.stringify(filters));
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
				combatantCount: activeBattle?.combatants.length ?? encounter.data.creatures.length ?? 0,
			};
		});
	}

	filterItems(items: EncounterHubItem[], filters: EncounterHubFilters): EncounterHubItem[] {
		const query = filters.query.trim().toLowerCase();

		return items.filter((item) => {
			if (filters.status !== 'all' && item.status !== filters.status) return false;
			if (!query) return true;

			const tags = Array.isArray((item.encounter as any).tags) ? ((item.encounter as any).tags as string[]) : [];
			const description =
				typeof (item.encounter as any).description === 'string'
					? String((item.encounter as any).description)
					: '';
			const creatureNames = item.encounter.data.creatures.map((creature) => creature.name).join(' ');

			const haystack = [
				item.encounter.title,
				description,
				tags.join(' '),
				creatureNames,
				item.latestBattle?.name ?? '',
			]
				.join(' ')
				.toLowerCase();

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
			status: 'all',
			sort: 'smart',
		};
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
