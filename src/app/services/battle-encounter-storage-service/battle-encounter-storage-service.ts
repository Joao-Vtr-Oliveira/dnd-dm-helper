import { Injectable, inject } from '@angular/core';
import type {
	BattleEncounter,
	BattleEncounterCreateOptions,
} from '../../models/battle-encounter-model';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import { BattleEncounterService } from '../battle-encounter-service/battle-encounter-service';
import type { SavedEncounter } from '../local-storage-service/local-storage-service';
import { LocalStorageService } from '../local-storage-service/local-storage-service';
import { WorkspaceStorageService } from '../workspace-service/workspace-storage-service';

export type BattlePreparationResult =
	| { kind: 'existing'; battle: BattleEncounter }
	| { kind: 'created'; battle: BattleEncounter };

@Injectable({ providedIn: 'root' })
export class BattleEncounterStorageService {
	private readonly storageKey = APP_STORAGE_KEYS.battleEncounters;
	private readonly battleEncounterService = inject(BattleEncounterService);
	private readonly localStorageService = inject(LocalStorageService);
	private readonly storage = inject(WorkspaceStorageService);

	getBattleEncounters(): BattleEncounter[] {
		const raw = this.storage.getItem(this.storageKey);
		if (!raw) return [];

		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];

			const normalized = parsed
				.filter((battle) => this.isBattleEncounterLike(battle))
				.map((battle) =>
					this.battleEncounterService.refreshLinkedSheetSnapshots(
						this.battleEncounterService.normalizeBattleEncounter(battle),
						this.localStorageService.listSheets(),
					),
				)
				.sort(
					(left, right) =>
						Date.parse(right.updatedAt || '') - Date.parse(left.updatedAt || '')
				);

			const needsMigration = JSON.stringify(normalized) !== JSON.stringify(parsed);
			if (needsMigration) {
				this.storage.setItem(this.storageKey, JSON.stringify(normalized));
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
		const battle = this.battleEncounterService.createBattleFromEncounter(encounter, options);

		this.saveBattleEncounter(battle);
		return battle;
	}

	getOrCreateBattleFromEncounter(
		encounter: SavedEncounter,
		options?: BattleEncounterCreateOptions,
		allowConcurrent = false,
	): BattlePreparationResult {
		if (!allowConcurrent) {
			const existing = this.getActiveBattleByEncounterId(encounter.id);
			if (existing) {
				const battle = options
					? this.battleEncounterService.applyBattleSetup(existing, options)
					: existing;
				if (options) this.saveBattleEncounter(battle);
				return { kind: 'existing', battle };
			}
		}

		return { kind: 'created', battle: this.createBattleFromEncounter(encounter, options) };
	}

	saveBattleEncounter(battle: BattleEncounter): void {
		const normalizedBattle = this.battleEncounterService.normalizeBattleEncounter(battle);
		const all = this.getBattleEncounters();
		const index = all.findIndex((item) => item.id === normalizedBattle.id);

		if (index === -1) all.unshift(normalizedBattle);
		else all[index] = structuredClone(normalizedBattle);

		this.storage.setItem(this.storageKey, JSON.stringify(all));
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
		this.storage.setItem(this.storageKey, JSON.stringify(all));
	}

	deleteBattlesByEncounterId(encounterId: string): void {
		const all = this.getBattleEncounters().filter(
			(battle) => battle.sourceEncounterId !== encounterId
		);
		this.storage.setItem(this.storageKey, JSON.stringify(all));
	}

	private isBattleEncounterLike(value: unknown): boolean {
		if (!value || typeof value !== 'object') return false;

		const candidate = value as Partial<BattleEncounter>;
		return (
			typeof candidate.id === 'string' &&
			(candidate.sourceEncounterId === undefined || typeof candidate.sourceEncounterId === 'string') &&
			typeof candidate.name === 'string' &&
			typeof candidate.round === 'number' &&
			Array.isArray(candidate.combatants)
		);
	}
}
