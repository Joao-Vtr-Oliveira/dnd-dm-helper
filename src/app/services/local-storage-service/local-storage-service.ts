import { Injectable, inject } from '@angular/core';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import type { BattleEncounter } from '../../models/battle-encounter-model';
import {
	normalizeContentLocationRelations,
	normalizeContentOrganizationRelations,
	type ContentLocationRelation,
	type ContentOrganizationRelation,
} from '../../models/content-context-model';
import {
	DND_5E_CHARACTER_CLASSES,
	isDnd5eCharacterClass,
	type Dnd5eCharacterClass,
} from '../../models/dnd-5e-reference-model';
import type { Encounter, EncounterLairAction, EncounterParticipant, EncounterTrap } from '../../models/encounter-model';
import type { CreatureCategory, CreatureSheet } from '../../models/creature-sheet-model';
import { CreatureTemplateService } from '../creature-template-service/creature-template-service';
import { WorkspaceStorageService } from '../workspace-service/workspace-storage-service';

export type SavedEncounter = Encounter;

export type HomebrewCategory = CreatureCategory;

export interface SavedSheetInterface {
	id: string;
	externalId?: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	data: CreatureSheet;

	category: HomebrewCategory;
	tags: string[];
	source: string;
	archived?: boolean;
	generic?: boolean;
	classes?: Dnd5eCharacterClass[];
	locationRefs?: ContentLocationRelation[];
	organizationRefs?: ContentOrganizationRelation[];
}

@Injectable({ providedIn: 'root' })
export class LocalStorageService {
	private readonly creatureTemplate = inject(CreatureTemplateService);
	private readonly storage = inject(WorkspaceStorageService);
	private readonly KEYEncounters = APP_STORAGE_KEYS.encounters;
	private readonly KEYSheets = APP_STORAGE_KEYS.sheets;
	private readonly KEYBattleEncounters = APP_STORAGE_KEYS.battleEncounters;

	// ENCOUNTERS:

	listEncounters(): SavedEncounter[] {
		const raw = this.storage.getItem(this.KEYEncounters);
		if (!raw) return [];
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			const sheetsById = new Map(this.listSheets().map((sheet) => [sheet.id, sheet]));
			const normalized = parsed
				.filter((encounter) => this.isEncounter(encounter))
				.map((encounter) => this.normalizeEncounter(encounter, sheetsById));
			if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
				this.storage.setItem(this.KEYEncounters, JSON.stringify(normalized));
			}
			return normalized;
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
		const normalized = this.normalizeEncounter(enc);
		if (idx === -1) all.unshift(normalized);
		else all[idx] = normalized;
		this.storage.setItem(this.KEYEncounters, JSON.stringify(all));
	}

	createEncounter(title: string, draft: Omit<Encounter, 'id' | 'title' | 'createdAt' | 'updatedAt'>): SavedEncounter {
		const now = Date.now();
		const item: SavedEncounter = {
			...structuredClone(draft),
			schemaVersion: 1,
			type: 'dnd-dm-helper-encounter',
			id: crypto.randomUUID(),
			title: (title || '').trim() || 'Untitled Encounter',
			createdAt: now,
			updatedAt: now,
			tags: Array.isArray(draft.tags) ? draft.tags : [],
			participants: Array.isArray(draft.participants) ? structuredClone(draft.participants) : [],
			lairActions: Array.isArray(draft.lairActions) ? structuredClone(draft.lairActions) : [],
			traps: Array.isArray(draft.traps) ? structuredClone(draft.traps) : [],
		};
		this.upsertEncounter(item);
		return item;
	}

	updateEncounter(id: string, patch: Partial<Omit<SavedEncounter, 'id' | 'createdAt'>>): SavedEncounter | null {
		const curr = this.getEncounter(id);
		if (!curr) return null;
		const updated = {
			...curr,
			...patch,
			updatedAt: Date.now(),
		};
		this.upsertEncounter(updated);
		return updated;
	}

	deleteEncounter(id: string) {
		const all = this.listEncounters().filter((e) => e.id !== id);
		this.storage.setItem(this.KEYEncounters, JSON.stringify(all));
	}

	duplicateEncounter(id: string): SavedEncounter | null {
		const curr = this.getEncounter(id);
		if (!curr) return null;
		return this.createEncounter(`${curr.title} (copy)`, {
			schemaVersion: 1,
			type: 'dnd-dm-helper-encounter',
			tags: curr.tags,
			description: curr.description,
			notes: curr.notes,
			participants: curr.participants.map((participant) => ({
				...structuredClone(participant),
				id: crypto.randomUUID(),
			})),
			lairActions: structuredClone(curr.lairActions),
			traps: structuredClone(curr.traps),
		});
	}

	// HOMEBREW SHEETS:

	listSheets(): SavedSheetInterface[] {
		const raw = this.storage.getItem(this.KEYSheets);
		if (!raw) return [];
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			const normalized = parsed.map((sheet) => this.normalizeSheet(sheet));
			if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
				this.storage.setItem(this.KEYSheets, JSON.stringify(normalized));
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
		this.storage.setItem(this.KEYSheets, JSON.stringify(all));
	}

	createSheet(params: {
		title: string;
		data: CreatureSheet;
		category: HomebrewCategory;
		tags?: string[];
		source?: string;
		externalId?: string;
		archived?: boolean;
		generic?: boolean;
		classes?: Dnd5eCharacterClass[];
		locationRefs?: ContentLocationRelation[];
		organizationRefs?: ContentOrganizationRelation[];
	}): SavedSheetInterface {
		const item = this.buildSheet(params);

		this.upsertSheet(item);
		return item;
	}

	buildSheet(params: {
		title: string;
		data: CreatureSheet;
		category: HomebrewCategory;
		tags?: string[];
		source?: string;
		externalId?: string;
		archived?: boolean;
		generic?: boolean;
		classes?: Dnd5eCharacterClass[];
		locationRefs?: ContentLocationRelation[];
		organizationRefs?: ContentOrganizationRelation[];
		extra?: Record<string, unknown>;
	}): SavedSheetInterface {
		if (params.generic === true && params.locationRefs?.length) {
			throw new Error('Uma ficha genérica não pode possuir localizações físicas.');
		}
		const now = Date.now();
		const category = this.normalizeHomebrewCategory(params.category);
		const classes = this.normalizeClasses(params.classes, category);
		const data = structuredClone(params.data) as CreatureSheet & { classes?: unknown };
		delete data.classes;
		return {
			...(params.extra ?? {}),
			id: globalThis.crypto?.randomUUID?.() ?? `sheet-${now}-${Math.random().toString(36).slice(2)}`,
			externalId: this.normalizeExternalId(params.externalId) ?? this.newExternalId(),
			title: (params.title || '').trim() || 'Untitled Homebrew',
			createdAt: now,
			updatedAt: now,
			data,
			category,
			tags: (params.tags ?? []).map((t) => t.trim()).filter(Boolean),
			source: (params.source || '').trim(),
			...(params.archived ? { archived: true } : {}),
			...(params.generic !== undefined ? { generic: params.generic } : {}),
			...(classes ? { classes } : {}),
			...(params.locationRefs?.length
				? { locationRefs: normalizeContentLocationRelations(params.locationRefs) }
				: {}),
			...(params.organizationRefs?.length
				? { organizationRefs: normalizeContentOrganizationRelations(params.organizationRefs) }
				: {}),
		};
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
		void curr;
	}

	deleteSheet(id: string) {
		const all = this.listSheets().filter((e) => e.id !== id);
		this.storage.setItem(this.KEYSheets, JSON.stringify(all));
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
			externalId: this.deriveDuplicateExternalId(curr.externalId),
			...(curr.archived ? { archived: true } : {}),
			...(curr.generic !== undefined ? { generic: curr.generic } : {}),
			...(curr.classes ? { classes: curr.classes } : {}),
			...(curr.locationRefs?.length ? { locationRefs: curr.locationRefs } : {}),
			...(curr.organizationRefs?.length ? { organizationRefs: curr.organizationRefs } : {}),
		});
	}

	applySheetBatch(
		sheets: SavedSheetInterface[],
		replacements: Array<{ previous: SavedSheetInterface; next: SavedSheetInterface }> = [],
	): SavedSheetInterface[] {
		const normalized = sheets.map((sheet) => this.normalizeSheet(sheet));
		this.storage.setItem(this.KEYSheets, JSON.stringify(normalized));

		void replacements;

		return normalized;
	}

	private normalizeSheet(sheet: Partial<SavedSheetInterface>): SavedSheetInterface {
		const now = Date.now();
		const candidate = structuredClone(sheet) as Record<string, unknown>;
		const locationRefs = Array.isArray(sheet.locationRefs)
			? normalizeContentLocationRelations(sheet.locationRefs)
			: undefined;
		const organizationRefs = Array.isArray(sheet.organizationRefs)
			? normalizeContentOrganizationRelations(sheet.organizationRefs)
			: undefined;
		const category = this.normalizeHomebrewCategory(sheet.category);
		const classes = this.normalizeClasses(sheet.classes, category);
		return {
			...candidate,
			id: typeof sheet.id === 'string' ? sheet.id : crypto.randomUUID(),
			externalId: this.normalizeExternalId(sheet.externalId) ?? this.newExternalId(),
			title: (sheet.title || '').trim() || 'Untitled Homebrew',
			createdAt: typeof sheet.createdAt === 'number' ? sheet.createdAt : now,
			updatedAt: typeof sheet.updatedAt === 'number' ? sheet.updatedAt : now,
			data: this.normalizeCreatureSheet(sheet.data),
			category,
			tags: Array.isArray(sheet.tags) ? sheet.tags.map((tag) => tag.trim()).filter(Boolean) : [],
			source: (sheet.source || '').trim(),
			...(sheet.archived === true ? { archived: true } : {}),
			...(typeof sheet.generic === 'boolean' ? { generic: sheet.generic } : {}),
			...(classes ? { classes } : {}),
			...(locationRefs ? { locationRefs } : {}),
			...(organizationRefs ? { organizationRefs } : {}),
		};
	}

	private normalizeExternalId(value: unknown): string | undefined {
		if (typeof value !== 'string') return undefined;
		const normalized = value.trim();
		return normalized || undefined;
	}

	private newExternalId(): string {
		return `sheet-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
	}

	private deriveDuplicateExternalId(externalId: string | undefined): string {
		const base = this.normalizeExternalId(externalId) ?? this.newExternalId();
		return `${base}-copy-${globalThis.crypto?.randomUUID?.()?.slice(0, 8) ?? Date.now().toString(36)}`;
	}

	private normalizeHomebrewCategory(value: unknown): HomebrewCategory {
		if (value === 'pc') return 'pc';
		if (value === 'npc') return 'npc';
		if (value === 'other') return 'other';
		return 'monster';
	}

	private normalizeClasses(
		value: unknown,
		category: HomebrewCategory,
	): Dnd5eCharacterClass[] | undefined {
		if (value === undefined) return undefined;
		if (category !== 'npc' && category !== 'pc') {
			if (Array.isArray(value) && value.length === 0) return undefined;
			throw new Error('classes só pode existir em fichas NPC ou PC.');
		}
		if (!Array.isArray(value) || value.some((item) => !isDnd5eCharacterClass(item))) {
			throw new Error(
				`classes deve conter somente: ${DND_5E_CHARACTER_CLASSES.map((item) => item.id).join(', ')}.`,
			);
		}
		const classes = [...new Set(value)];
		return classes.length ? classes : undefined;
	}

	private normalizeCreatureSheet(raw: Partial<CreatureSheet> | undefined): CreatureSheet {
		const sheet = this.creatureTemplate.normalizeCreature(raw ?? {});
		const identity = sheet.fiveEToolsIdentity;
		if (
			identity?.name === 'Wen Torger' &&
			identity.source === 'Notion' &&
			!sheet.spellSlots.some((slot) => slot.level === 3)
		) {
			return { ...sheet, spellSlots: [...sheet.spellSlots, { level: 3, max: 2 }] };
		}
		return sheet;
	}

	private normalizeEncounter(
		encounter: Encounter,
		sheetsById = new Map<string, SavedSheetInterface>(),
	): SavedEncounter {
		return {
			...structuredClone(encounter),
			participants: encounter.participants.map((participant, index) =>
				this.normalizeParticipant(participant, index, sheetsById),
			),
			lairActions: encounter.lairActions.map((action, index) => this.normalizeLairAction(action, index)),
			traps: encounter.traps.map((trap, index) => this.normalizeTrap(trap, index)),
		};
	}

	private normalizeParticipant(
		raw: EncounterParticipant,
		index: number,
		sheetsById: Map<string, SavedSheetInterface>,
	): EncounterParticipant {
		const initiative = Number(raw.initiative);
		const sourceSheetId =
			typeof raw.sourceSheetId === 'string' && raw.sourceSheetId.trim()
				? raw.sourceSheetId.trim()
				: undefined;
		const sourceSheet = sourceSheetId ? sheetsById.get(sourceSheetId) : undefined;
		return {
			id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : crypto.randomUUID(),
			...(sourceSheetId
				? { sourceSheetId }
				: {}),
			name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `Creature ${index + 1}`,
			category: this.normalizeHomebrewCategory(raw.category),
			...(raw.side === 'player' || raw.side === 'ally' || raw.side === 'enemy' || raw.side === 'neutral'
				? { side: raw.side }
				: {}),
			initiative: raw.initiative == null || !Number.isFinite(initiative) ? null : initiative,
			sheet: sourceSheet
				? this.creatureTemplate.createFromSavedSheet(sourceSheet)
				: this.normalizeCreatureSheet(raw.sheet),
			...(typeof raw.notes === 'string' && raw.notes.trim() ? { notes: raw.notes.trim() } : {}),
		};
	}

	private normalizeLairAction(raw: EncounterLairAction, index: number): EncounterLairAction {
		const frequency =
			raw.frequency === 'cooldown-rounds' || raw.frequency === 'manual' ? raw.frequency : 'every-round';
		const initiative = Number(raw.initiative);
		return {
			id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : `lair-action-${index + 1}`,
			name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `Lair Action ${index + 1}`,
			...(typeof raw.description === 'string' && raw.description.trim()
				? { description: raw.description.trim() }
				: {}),
			initiative: Number.isFinite(initiative) ? initiative : 20,
			active: raw.active !== false,
			frequency,
			...(frequency === 'cooldown-rounds'
				? { cooldownRounds: Math.max(1, Math.floor(Number(raw.cooldownRounds) || 1)) }
				: {}),
		};
	}

	private normalizeTrap(raw: EncounterTrap, index: number): EncounterTrap {
		const triggerType =
			raw.triggerType === 'initiative' || raw.triggerType === 'round-start' || raw.triggerType === 'round-end'
				? raw.triggerType
				: 'manual';
		const frequency =
			raw.frequency === 'once' || raw.frequency === 'every-round' || raw.frequency === 'cooldown-rounds'
				? raw.frequency
				: 'manual';
		const initiative = Number(raw.initiative);
		return {
			id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : `trap-${index + 1}`,
			name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `Armadilha ${index + 1}`,
			...(typeof raw.description === 'string' && raw.description.trim()
				? { description: raw.description.trim() }
				: {}),
			triggerType,
			...(triggerType === 'initiative'
				? { initiative: Number.isFinite(initiative) ? initiative : 20 }
				: {}),
			active: raw.active !== false,
			frequency,
			...(frequency === 'cooldown-rounds'
				? { cooldownRounds: Math.max(1, Math.floor(Number(raw.cooldownRounds) || 1)) }
				: {}),
		};
	}

	private isEncounter(value: unknown): value is SavedEncounter {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
		const encounter = value as Partial<Encounter>;
		return (
			encounter.schemaVersion === 1 &&
			encounter.type === 'dnd-dm-helper-encounter' &&
			typeof encounter.id === 'string' &&
			typeof encounter.title === 'string' &&
			typeof encounter.createdAt === 'number' &&
			typeof encounter.updatedAt === 'number' &&
			Array.isArray(encounter.tags) &&
			Array.isArray(encounter.participants) &&
			Array.isArray(encounter.lairActions) &&
			Array.isArray(encounter.traps)
		);
	}

}
