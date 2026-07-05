import { Injectable } from '@angular/core';
import type { BattleTracker, CreatureInterface } from '../../models/battleTracker-model';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import type { BattleEncounter } from '../../models/battle-encounter-model';

export type SavedEncounter = {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	data: BattleTracker;
};

export type HomebrewCategory = 'monster' | 'npc' | 'pc' | 'other';
type LegacyHomebrewCategory =
	| HomebrewCategory
	| 'ally'
	| 'boss'
	| 'PC'
	| 'player'
	| 'pet'
	| 'item';

export interface SavedSheetInterface {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	data: CreatureInterface;

	category: HomebrewCategory;
	tags: string[];
	source: string;
}

@Injectable({ providedIn: 'root' })
export class LocalStorageService {
	private readonly KEYEncounters = APP_STORAGE_KEYS.encounters;
	private readonly KEYSheets = APP_STORAGE_KEYS.sheets;
	private readonly KEYBattleEncounters = APP_STORAGE_KEYS.battleEncounters;

	// ENCOUNTERS:

	listEncounters(): SavedEncounter[] {
		const raw = localStorage.getItem(this.KEYEncounters);
		if (!raw) return [];
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	getEncounter(id: string): SavedEncounter | null {
		return this.listEncounters().find((e) => e.id === id) ?? null;
	}

	upsertEncounter(enc: SavedEncounter) {
		const all = this.listEncounters();
		const idx = all.findIndex((x) => x.id === enc.id);
		if (idx === -1) all.unshift(enc);
		else all[idx] = enc;
		localStorage.setItem(this.KEYEncounters, JSON.stringify(all));
	}

	createEncounter(title: string, data: BattleTracker): SavedEncounter {
		const now = Date.now();
		const item: SavedEncounter = {
			id: crypto.randomUUID(),
			title: (title || '').trim() || 'Untitled Encounter',
			createdAt: now,
			updatedAt: now,
			data: structuredClone(data),
		};
		this.upsertEncounter(item);
		return item;
	}

	updateEncounter(id: string, patch: Partial<Omit<SavedEncounter, 'id'>>) {
		const curr = this.getEncounter(id);
		if (!curr) return;
		this.upsertEncounter({
			...curr,
			...patch,
			updatedAt: Date.now(),
		});
	}

	deleteEncounter(id: string) {
		const all = this.listEncounters().filter((e) => e.id !== id);
		localStorage.setItem(this.KEYEncounters, JSON.stringify(all));
	}

	duplicateEncounter(id: string): SavedEncounter | null {
		const curr = this.getEncounter(id);
		if (!curr) return null;
		return this.createEncounter(`${curr.title} (copy)`, curr.data);
	}

	// HOMEBREW SHEETS:

	listSheets(): SavedSheetInterface[] {
		const raw = localStorage.getItem(this.KEYSheets);
		if (!raw) return [];
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			const normalized = parsed.map((sheet) => this.normalizeSheet(sheet));
			if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
				localStorage.setItem(this.KEYSheets, JSON.stringify(normalized));
			}
			return normalized;
		} catch {
			return [];
		}
	}

	getSheet(id: string): SavedSheetInterface | null {
		return this.listSheets().find((e) => e.id === id) ?? null;
	}

	upsertSheet(sheet: SavedSheetInterface) {
		const all = this.listSheets();
		const normalizedSheet = this.normalizeSheet(sheet);
		const idx = all.findIndex((x) => x.id === normalizedSheet.id);
		if (idx === -1) all.unshift(normalizedSheet);
		else all[idx] = normalizedSheet;
		localStorage.setItem(this.KEYSheets, JSON.stringify(all));
	}

	createSheet(params: {
		title: string;
		data: CreatureInterface;
		category: HomebrewCategory;
		tags?: string[];
		source?: string;
	}): SavedSheetInterface {
		const now = Date.now();
		const cleanTitle = (params.title || '').trim() || 'Untitled Homebrew';

		const item: SavedSheetInterface = {
			id: crypto.randomUUID(),
			title: cleanTitle,
			createdAt: now,
			updatedAt: now,
			data: structuredClone(params.data),
			category: this.normalizeHomebrewCategory(params.category),
			tags: (params.tags ?? []).map((t) => t.trim()).filter(Boolean),
			source: (params.source || '').trim(),
		};

		this.upsertSheet(item);
		return item;
	}

	updateSheet(id: string, patch: Partial<Omit<SavedSheetInterface, 'id'>>) {
		const curr = this.getSheet(id);
		if (!curr) return;
		const nextSheet = this.normalizeSheet({
			...curr,
			...patch,
			updatedAt: Date.now(),
		});
		this.upsertSheet(nextSheet);
		this.syncSheetNameReferences(curr, nextSheet);
	}

	deleteSheet(id: string) {
		const all = this.listSheets().filter((e) => e.id !== id);
		localStorage.setItem(this.KEYSheets, JSON.stringify(all));
	}

	duplicateSheet(id: string): SavedSheetInterface | null {
		const curr = this.getSheet(id);
		if (!curr) return null;

		return this.createSheet({
			title: `${curr.title} (copy)`,
			data: curr.data,
			category: curr.category,
			tags: curr.tags,
			source: curr.source,
		});
	}

	private normalizeSheet(sheet: Partial<SavedSheetInterface>): SavedSheetInterface {
		const now = Date.now();
		return {
			id: typeof sheet.id === 'string' ? sheet.id : crypto.randomUUID(),
			title: (sheet.title || '').trim() || 'Untitled Homebrew',
			createdAt: typeof sheet.createdAt === 'number' ? sheet.createdAt : now,
			updatedAt: typeof sheet.updatedAt === 'number' ? sheet.updatedAt : now,
			data: structuredClone(sheet.data ?? ({} as CreatureInterface)),
			category: this.normalizeHomebrewCategory(sheet.category),
			tags: Array.isArray(sheet.tags) ? sheet.tags.map((tag) => tag.trim()).filter(Boolean) : [],
			source: (sheet.source || '').trim(),
		};
	}

	private normalizeHomebrewCategory(value: unknown): HomebrewCategory {
		const category = value as LegacyHomebrewCategory | undefined;
		if (category === 'pc' || category === 'PC' || category === 'player') return 'pc';
		if (category === 'npc' || category === 'ally' || category === 'pet') return 'npc';
		if (category === 'other' || category === 'item') return 'other';
		return 'monster';
	}

	private syncSheetNameReferences(previous: SavedSheetInterface, next: SavedSheetInterface) {
		const previousName = previous.data?.name?.trim();
		const nextName = next.data?.name?.trim();
		if (!previousName || !nextName || previousName === nextName) return;

		this.syncEncounterSheetNames(next.id, previousName, nextName);
		this.syncBattleSheetNames(next.id, previousName, nextName);
	}

	private syncEncounterSheetNames(sheetId: string, previousName: string, nextName: string) {
		const encounters = this.listEncounters();
		let changed = false;

		const updated = encounters.map((encounter) => {
			const creatures = encounter.data?.creatures ?? [];
			let encounterChanged = false;
			const nextCreatures = creatures.map((creature) => {
				if (creature.sourceSheetId !== sheetId) return creature;
				const renamed = this.renameDefaultSheetName(creature.name, previousName, nextName);
				if (!renamed) return creature;
				changed = true;
				encounterChanged = true;
				return {
					...creature,
					name: renamed,
				};
			});

			if (!encounterChanged) return encounter;
			return {
				...encounter,
				updatedAt: Date.now(),
				data: {
					...encounter.data,
					creatures: nextCreatures,
				},
			};
		});

		if (changed) {
			localStorage.setItem(this.KEYEncounters, JSON.stringify(updated));
		}
	}

	private syncBattleSheetNames(sheetId: string, previousName: string, nextName: string) {
		const raw = localStorage.getItem(this.KEYBattleEncounters);
		if (!raw) return;

		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return;

			let changed = false;
			const updated = parsed.map((entry) => {
				if (!entry || typeof entry !== 'object') return entry;
				const battle = entry as Partial<BattleEncounter>;
				const combatantsChanged = this.renameBattleCombatants(
					battle.combatants,
					sheetId,
					previousName,
					nextName,
				);
				const pendingChanged = this.renameBattleCombatants(
					battle.pendingCombatants,
					sheetId,
					previousName,
					nextName,
				);

				if (combatantsChanged === battle.combatants && pendingChanged === battle.pendingCombatants) {
					return entry;
				}

				changed = true;
				return {
					...entry,
					updatedAt: new Date().toISOString(),
					combatants: combatantsChanged,
					pendingCombatants: pendingChanged,
				};
			});

			if (changed) {
				localStorage.setItem(this.KEYBattleEncounters, JSON.stringify(updated));
			}
		} catch {
			return;
		}
	}

	private renameBattleCombatants(
		combatants: BattleEncounter['combatants'] | BattleEncounter['pendingCombatants'] | undefined,
		sheetId: string,
		previousName: string,
		nextName: string,
	) {
		if (!Array.isArray(combatants)) return combatants;

		let changed = false;
		const renamed = combatants.map((combatant) => {
			if (!combatant || combatant.sourceSheetId !== sheetId) return combatant;
			if ((combatant.displayName || '').trim()) return combatant;
			const nextCombatantName = this.renameDefaultSheetName(combatant.name, previousName, nextName);
			if (!nextCombatantName) return combatant;
			changed = true;
			return {
				...combatant,
				name: nextCombatantName,
			};
		});

		return changed ? renamed : combatants;
	}

	private renameDefaultSheetName(currentName: string, previousName: string, nextName: string): string | null {
		const trimmedCurrentName = (currentName || '').trim();
		if (!trimmedCurrentName) return null;
		if (trimmedCurrentName === previousName) return nextName;
		if (trimmedCurrentName.startsWith(`${previousName} #`)) {
			return `${nextName}${trimmedCurrentName.slice(previousName.length)}`;
		}
		return null;
	}
}
