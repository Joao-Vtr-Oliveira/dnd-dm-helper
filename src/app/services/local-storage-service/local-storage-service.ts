import { Injectable } from '@angular/core';
import type { BattleTracker, CreatureInterface } from '../../models/battleTracker-model';

export type SavedEncounter = {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	data: BattleTracker;
};

export type HomebrewCategory = 'monster' | 'npc' | 'ally' | 'boss' | 'other' | 'PC';

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
	private readonly KEYEncounters = 'dnd-dm-helper.encounters.v1';
	private readonly KEYSheets = 'dnd-dm-helper.sheets.v1';

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
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	getSheet(id: string): SavedSheetInterface | null {
		return this.listSheets().find((e) => e.id === id) ?? null;
	}

	upsertSheet(sheet: SavedSheetInterface) {
		const all = this.listSheets();
		const idx = all.findIndex((x) => x.id === sheet.id);
		if (idx === -1) all.unshift(sheet);
		else all[idx] = sheet;
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
			category: params.category,
			tags: (params.tags ?? []).map((t) => t.trim()).filter(Boolean),
			source: (params.source || '').trim(),
		};

		this.upsertSheet(item);
		return item;
	}

	updateSheet(id: string, patch: Partial<Omit<SavedSheetInterface, 'id'>>) {
		const curr = this.getSheet(id);
		if (!curr) return;
		this.upsertSheet({
			...curr,
			...patch,
			updatedAt: Date.now(),
		});
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
}
