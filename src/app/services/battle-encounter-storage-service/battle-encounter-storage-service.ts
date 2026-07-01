import { Injectable, inject } from '@angular/core';
import type {
	BattleEncounter,
	BattleEncounterCreateOptions,
} from '../../models/battle-encounter-model';
import { BattleEncounterService } from '../battle-encounter-service/battle-encounter-service';
import type { SavedEncounter } from '../local-storage-service/local-storage-service';

@Injectable({ providedIn: 'root' })
export class BattleEncounterStorageService {
	private readonly storageKey = 'dnd-dm-helper.battle-encounters.v1';
	private readonly battleEncounterService = inject(BattleEncounterService);

	getBattleEncounters(): BattleEncounter[] {
		const raw = localStorage.getItem(this.storageKey);
		if (!raw) return [];

		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];

			const normalized = parsed
				.filter((battle) => this.isBattleEncounterLike(battle))
				.map((battle) => this.battleEncounterService.normalizeBattleEncounter(battle))
				.sort(
					(left, right) =>
						Date.parse(right.updatedAt || '') - Date.parse(left.updatedAt || '')
				);

			const needsMigration = JSON.stringify(normalized) !== JSON.stringify(parsed);
			if (needsMigration) {
				localStorage.setItem(this.storageKey, JSON.stringify(normalized));
			}

			return normalized;
		} catch {
			return [];
		}
	}

	getBattleEncounterById(id: string): BattleEncounter | null {
		return this.getBattleEncounters().find((battle) => battle.id === id) ?? null;
	}

	getBattlesByEncounterId(encounterId: string): BattleEncounter[] {
		return this.getBattleEncounters().filter((battle) => battle.sourceEncounterId === encounterId);
	}

	getActiveBattleByEncounterId(encounterId: string): BattleEncounter | null {
		return (
			this.getBattlesByEncounterId(encounterId).find(
				(battle) => battle.status === 'active' || battle.status === 'paused'
			) ?? null
		);
	}

	getActiveBattles(): BattleEncounter[] {
		return this.getBattleEncounters().filter(
			(battle) => battle.status === 'active' || battle.status === 'paused'
		);
	}

	createBattleFromEncounter(
		encounter: SavedEncounter,
		options?: BattleEncounterCreateOptions
	): BattleEncounter {
		const battle = this.battleEncounterService.createBattleFromEncounter(
			{
				id: encounter.id,
				name: encounter.title,
				data: encounter.data,
			},
			options
		);

		this.saveBattleEncounter(battle);
		return battle;
	}

	saveBattleEncounter(battle: BattleEncounter): void {
		const normalizedBattle = this.battleEncounterService.normalizeBattleEncounter(battle);
		const all = this.getBattleEncounters();
		const index = all.findIndex((item) => item.id === normalizedBattle.id);

		if (index === -1) all.unshift(normalizedBattle);
		else all[index] = structuredClone(normalizedBattle);

		localStorage.setItem(this.storageKey, JSON.stringify(all));
	}

	pauseBattleEncounter(id: string): BattleEncounter | null {
		const battle = this.getBattleEncounterById(id);
		if (!battle) return null;

		const paused = this.battleEncounterService.pauseBattle(battle);
		this.saveBattleEncounter(paused);
		return paused;
	}

	resumeBattleEncounter(id: string): BattleEncounter | null {
		const battle = this.getBattleEncounterById(id);
		if (!battle) return null;

		const resumed = this.battleEncounterService.resumeBattle(battle);
		this.saveBattleEncounter(resumed);
		return resumed;
	}

	completeBattleEncounter(id: string): BattleEncounter | null {
		const battle = this.getBattleEncounterById(id);
		if (!battle) return null;

		const completed = this.battleEncounterService.completeBattle(battle);
		this.saveBattleEncounter(completed);
		return completed;
	}

	deleteBattleEncounter(id: string): void {
		const all = this.getBattleEncounters().filter((battle) => battle.id !== id);
		localStorage.setItem(this.storageKey, JSON.stringify(all));
	}

	private isBattleEncounterLike(value: unknown): boolean {
		if (!value || typeof value !== 'object') return false;

		const candidate = value as Partial<BattleEncounter>;
		return (
			typeof candidate.id === 'string' &&
			typeof candidate.sourceEncounterId === 'string' &&
			typeof candidate.name === 'string' &&
			typeof candidate.round === 'number' &&
			Array.isArray(candidate.combatants)
		);
	}
}
