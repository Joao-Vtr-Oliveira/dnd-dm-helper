import { Injectable, inject } from '@angular/core';
import type {
	CreatureFeature,
	CreatureInterface,
	CreatureSpecialAbility,
} from '../../models/battleTracker-model';
import {
	LocalStorageService,
	type HomebrewCategory,
	type SavedSheetInterface,
} from '../local-storage-service/local-storage-service';
import { CreatureTemplateService } from '../creature-template-service/creature-template-service';
import { EncounterIoService } from '../encounter-io-service/encounter-io-service';

export type HomebrewSheetConflictResolution = 'replace' | 'keep-existing' | 'duplicate';

export interface HomebrewSheetImportCandidate {
	index: number;
	title: string;
	category: HomebrewCategory;
	tags: string[];
	source: string;
	externalId: string;
	data: CreatureInterface;
	extra: Record<string, unknown>;
	warnings: string[];
}

export interface HomebrewSheetImportInvalid {
	index: number;
	title: string;
	errors: string[];
	warnings: string[];
}

export interface HomebrewSheetImportConflict {
	index: number;
	candidate: HomebrewSheetImportCandidate;
	existing: SavedSheetInterface | null;
	otherCandidateIndex?: number;
	matchedBy: 'externalId' | 'name';
	resolution: HomebrewSheetConflictResolution;
}

export interface HomebrewSheetImportPreview {
	format: 'current' | 'legacy';
	exportedAt: string | null;
	candidates: HomebrewSheetImportCandidate[];
	invalid: HomebrewSheetImportInvalid[];
	conflicts: HomebrewSheetImportConflict[];
	warnings: string[];
}

export interface HomebrewSheetImportResult {
	imported: number;
	replaced: number;
	kept: number;
	duplicated: number;
	rejected: number;
	warnings: string[];
}

const CATEGORIES: HomebrewCategory[] = ['monster', 'npc', 'pc', 'other'];
const NUMERIC_FIELDS = [
	'initiative',
	'healthPoints',
	'maxHealthPoints',
	'temporaryHealthPoints',
] as const;
const SHEET_FIELDS = new Set(['title', 'category', 'tags', 'source', 'externalId', 'data']);

interface RawEnvelope extends Record<string, unknown> {
	app?: unknown;
	type?: unknown;
	version?: unknown;
	schemaVersion?: unknown;
	exportedAt?: unknown;
	sheets?: unknown;
	data?: unknown;
}

interface RawSheet extends Record<string, unknown> {
	title?: unknown;
	source?: unknown;
	category?: unknown;
	tags?: unknown;
	externalId?: unknown;
	data?: unknown;
}

interface RawCreature extends Record<string, unknown> {
	name?: unknown;
	category?: unknown;
	sheetFeatures?: unknown;
	id?: unknown;
	armorClass?: unknown;
	conditions?: unknown;
	notes?: unknown;
	specialAbilities?: unknown;
	totalSpellSlots?: unknown;
	usedSpellSlots?: unknown;
	spells?: unknown;
	rawFiveETools?: unknown;
}

@Injectable({ providedIn: 'root' })
export class HomebrewSheetImportService {
	private readonly storage = inject(LocalStorageService);
	private readonly creatureTemplate = inject(CreatureTemplateService);
	private readonly encounterIo = inject(EncounterIoService);

	parseText(text: string): HomebrewSheetImportPreview {
		let raw: unknown;
		try {
			raw = JSON.parse(text);
		} catch {
			throw new Error('JSON inválido (não deu parse).');
		}
		return this.prepareImport(raw);
	}

	prepareImport(raw: unknown): HomebrewSheetImportPreview {
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
			throw new Error('O arquivo de fichas precisa ser um objeto JSON.');
		}

		const candidate = raw as RawEnvelope;
		this.rejectBackup(candidate);

		const isCurrent = candidate.app === 'dnd-dm-helper' && candidate.type === 'homebrew-sheets';
		const isLegacy = candidate.version === 1;
		if (!isCurrent && !isLegacy) {
			throw new Error('JSON incompatível: use uma exportação de fichas do dnd-dm-helper.');
		}
		if (isCurrent && candidate.schemaVersion !== 1) {
			throw new Error('Versão de schema de fichas não suportada.');
		}
		if (!Array.isArray(candidate.sheets)) {
			throw new Error('JSON inválido: "sheets" precisa ser um array.');
		}
		if (this.normalizeExportedAt(candidate.exportedAt) === null) {
			throw new Error('JSON inválido: "exportedAt" precisa ser uma data válida.');
		}

		const warnings: string[] = [];
		const candidates: HomebrewSheetImportCandidate[] = [];
		const invalid: HomebrewSheetImportInvalid[] = [];

		candidate.sheets.forEach((rawSheet, index) => {
			const result = this.normalizeCandidate(rawSheet, index);
			if (result.candidate) candidates.push(result.candidate);
			else invalid.push(result.invalid!);
			warnings.push(...result.warnings);
		});

		const conflicts = this.findConflicts(candidates);
		return {
			format: isCurrent ? 'current' : 'legacy',
			exportedAt: this.normalizeExportedAt(candidate.exportedAt),
			candidates,
			invalid,
			conflicts,
			warnings,
		};
	}

	apply(
		preview: HomebrewSheetImportPreview,
		resolutions: Record<number, HomebrewSheetConflictResolution> = {},
	): HomebrewSheetImportResult {
		if (!preview.candidates.length) {
			return {
				imported: 0,
				replaced: 0,
				kept: 0,
				duplicated: 0,
				rejected: preview.invalid.length,
				warnings: [...preview.warnings],
			};
		}

		const existing = this.storage.listSheets();
		const working = structuredClone(existing);
		const replacements: Array<{ previous: SavedSheetInterface; next: SavedSheetInterface }> = [];
		const warnings = [...preview.warnings];
		let imported = 0;
		let replaced = 0;
		let kept = 0;
		let duplicated = 0;
		let changed = false;

		for (const candidate of preview.candidates) {
			const match = this.findMatch(candidate, working);
			const resolution = match
				? resolutions[candidate.index] ?? this.findConflict(preview.conflicts, candidate.index)?.resolution ?? 'replace'
				: undefined;

			if (match && resolution === 'keep-existing') {
				kept += 1;
				continue;
			}

			if (match && resolution === 'replace') {
				const next = this.buildReplacement(match, candidate);
				const matchIndex = working.findIndex((sheet) => sheet.id === match.id);
				if (matchIndex >= 0) {
					working[matchIndex] = next;
					replacements.push({ previous: match, next });
					replaced += 1;
					changed = true;
				}
				continue;
			}

			const isDuplicate = match != null && resolution === 'duplicate';
			const next = this.buildNewSheet(candidate, isDuplicate ? this.duplicateExternalId(candidate.externalId) : undefined);
			working.unshift(next);
			if (isDuplicate) duplicated += 1;
			else imported += 1;
			changed = true;
		}

		if (changed) this.storage.applySheetBatch(working, replacements);
		if (preview.invalid.length) warnings.push(`${preview.invalid.length} ficha(s) rejeitada(s) por validação.`);

		return { imported, replaced, kept, duplicated, rejected: preview.invalid.length, warnings };
	}

	private normalizeCandidate(
		raw: unknown,
		index: number,
	): { candidate?: HomebrewSheetImportCandidate; invalid?: HomebrewSheetImportInvalid; warnings: string[] } {
		const warnings: string[] = [];
		const errors: string[] = [];
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
			return { invalid: { index, title: `Ficha ${index + 1}`, errors: ['A ficha precisa ser um objeto.'], warnings }, warnings };
		}

		const sheet = raw as RawSheet;
		const title = this.requiredText(sheet.title, 'title', errors);
		const source = this.requiredText(sheet.source, 'source', errors);
		const category = this.category(sheet.category, errors);
		const data = sheet.data;
		if (!data || typeof data !== 'object' || Array.isArray(data)) errors.push('O campo data precisa ser um objeto.');

		const candidateData = data && typeof data === 'object' && !Array.isArray(data) ? (data as RawCreature) : null;
		const name = candidateData ? this.requiredText(candidateData.name, 'data.name', errors) : '';
		if (category && candidateData?.category !== undefined && candidateData.category !== category) {
			errors.push('category do envelope é diferente de data.category.');
		}
		if (candidateData?.category !== undefined && !CATEGORIES.includes(candidateData.category as HomebrewCategory)) {
			errors.push('data.category precisa ser monster, npc, pc ou other.');
		}
		this.validateCreature(candidateData, errors);

		const externalId = this.externalId(sheet.externalId, source, title, name, warnings, errors, index);
		const tags = this.tags(sheet.tags, errors);
		const extra = this.unknownFields(sheet);
		const dataUnknown = candidateData ? this.unknownDataFields(candidateData) : [];
		if ('id' in sheet || 'createdAt' in sheet || 'updatedAt' in sheet) {
			warnings.push(`Ficha ${index + 1}: identidade local e timestamps fornecidos foram ignorados.`);
		}
		if (candidateData && 'sourceSheetId' in candidateData) {
			warnings.push(`Ficha ${index + 1}: sourceSheetId fornecido foi ignorado.`);
		}
		if (Object.keys(extra).length || dataUnknown.length) {
			warnings.push(
				`Ficha ${index + 1}: campos desconhecidos preservados (${[...Object.keys(extra), ...dataUnknown.map((field) => `data.${field}`)].join(', ')}).`,
			);
		}

		if (errors.length || !category || !candidateData) {
			return {
				invalid: { index, title: title || `Ficha ${index + 1}`, errors, warnings },
				warnings,
			};
		}

		const normalizedData = this.normalizeCreature(candidateData, category);
		return {
			candidate: {
				index,
				title,
				category,
				tags,
				source,
				externalId,
				data: normalizedData,
				extra,
				warnings,
			},
			warnings,
		};
	}

	private normalizeCreature(raw: RawCreature, category: HomebrewCategory): CreatureInterface {
		const imported = this.encounterIo.fromObject({ creatures: [raw], creatureIdCount: 1 }).encounter.creatures[0];
		const normalized = this.creatureTemplate.normalizeCreature({
			...raw,
			...imported,
			category,
			sheetFeatures: raw.sheetFeatures as CreatureFeature[] | undefined,
			rawFiveETools: raw.rawFiveETools as CreatureInterface['rawFiveETools'],
			id: 0,
		});
		const preserved = {
			...structuredClone(raw),
			...normalized,
			id: 0,
			category,
		} as CreatureInterface & Record<string, unknown>;
		delete preserved.sourceSheetId;
		return preserved;
	}

	private validateCreature(data: RawCreature | null, errors: string[]): void {
		if (!data) return;
		for (const field of NUMERIC_FIELDS) {
			if (data[field] !== undefined && data[field] !== null && !this.isFiniteNumeric(data[field])) {
				errors.push(`data.${field} precisa ser um número finito ou null.`);
			}
		}
		if (data.id !== undefined && (!this.isFiniteNumber(data.id) || !Number.isInteger(data.id))) {
			errors.push('data.id precisa ser um número inteiro finito.');
		}
		if (data.armorClass !== undefined && data.armorClass !== null && data.armorClass !== '' && !this.isFiniteNumeric(data.armorClass) && typeof data.armorClass !== 'string') {
			errors.push('data.armorClass tem tipo inválido.');
		}
		for (const field of ['conditions', 'notes', 'specialAbilities', 'sheetFeatures'] as const) {
			if (data[field] !== undefined && !Array.isArray(data[field])) errors.push(`data.${field} precisa ser um array.`);
		}
		this.validateNotes(data['notes'], errors);
		this.validateConditions(data['conditions'], errors);
		this.validateSlots(data.totalSpellSlots, 'totalSpellSlots', errors);
		this.validateSlots(data.usedSpellSlots, 'usedSpellSlots', errors);
		this.validateSpells(data.spells, errors);
		this.validateAbilities(data.specialAbilities, errors);
		this.validateFeatures(data.sheetFeatures, errors);
		if (data.rawFiveETools !== undefined && (!data.rawFiveETools || typeof data.rawFiveETools !== 'object' || Array.isArray(data.rawFiveETools))) {
			errors.push('data.rawFiveETools precisa ser um objeto.');
		}
	}

	private validateSlots(value: unknown, field: string, errors: string[]): void {
		if (value === null || value === undefined) return;
		if (typeof value !== 'object' || Array.isArray(value)) {
			errors.push(`data.${field} precisa ser um objeto ou null.`);
			return;
		}
		for (const [level, slot] of Object.entries(value as Record<string, unknown>)) {
			if (!this.isFiniteNumeric(slot)) errors.push(`data.${field}.${level} precisa ser um número finito.`);
		}
	}

	private validateSpells(value: unknown, errors: string[]): void {
		if (value === undefined || value === null) return;
		if (Array.isArray(value)) {
			for (const [index, spell] of value.entries()) this.validateSpell(spell, `data.spells[${index}]`, errors);
			return;
		}
		if (typeof value !== 'object') {
			errors.push('data.spells precisa ser um objeto ou array.');
			return;
		}
		for (const [key, spell] of Object.entries(value as Record<string, unknown>)) this.validateSpell(spell, `data.spells.${key}`, errors);
	}

	private validateSpell(value: unknown, field: string, errors: string[]): void {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			errors.push(`${field} precisa ser um objeto.`);
			return;
		}
		const spell = value as Record<string, unknown>;
		if (spell['total'] !== undefined && !this.isFiniteNumeric(spell['total'])) errors.push(`${field}.total precisa ser um número finito.`);
		if (spell['label'] !== undefined && typeof spell['label'] !== 'string') errors.push(`${field}.label tem tipo inválido.`);
	}

	private validateAbilities(value: unknown, errors: string[]): void {
		if (!Array.isArray(value)) return;
		for (const [index, item] of value.entries()) {
			const field = `data.specialAbilities[${index}]`;
			if (!item || typeof item !== 'object' || Array.isArray(item)) {
				errors.push(`${field} precisa ser um objeto com nome.`);
				continue;
			}
			const ability = item as Partial<CreatureSpecialAbility>;
			if (typeof ability.name !== 'string' || !ability.name.trim()) errors.push(`${field}.name é obrigatório.`);
			if (ability.id !== undefined && typeof ability.id !== 'string') errors.push(`${field}.id tem tipo inválido.`);
			for (const numeric of ['maxUses', 'cooldownTurns', 'cooldownRounds'] as const) {
				if (ability[numeric] !== undefined && !this.isFiniteNumeric(ability[numeric])) errors.push(`${field}.${numeric} tem tipo inválido.`);
			}
			if (ability.rechargeOn !== undefined && (!Array.isArray(ability.rechargeOn) || ability.rechargeOn.some((entry) => !this.isFiniteNumeric(entry)))) {
				errors.push(`${field}.rechargeOn tem tipo inválido.`);
			}
		}
	}

	private validateNotes(value: unknown, errors: string[]): void {
		if (!Array.isArray(value)) return;
		for (const [index, item] of value.entries()) {
			if (!item || typeof item !== 'object' || Array.isArray(item)) {
				errors.push(`data.notes[${index}] precisa ser um objeto.`);
				continue;
			}
			const id = (item as Record<string, unknown>)['id'];
			if (id !== undefined && (!this.isFiniteNumber(id) || !Number.isInteger(id))) {
				errors.push(`data.notes[${index}].id tem tipo inválido.`);
			}
		}
	}

	private validateConditions(value: unknown, errors: string[]): void {
		if (!Array.isArray(value)) return;
		for (const [index, item] of value.entries()) {
			if (!item || typeof item !== 'object' || Array.isArray(item)) {
				errors.push(`data.conditions[${index}] precisa ser um objeto.`);
				continue;
			}
			const id = (item as Record<string, unknown>)['id'];
			if (id !== undefined && typeof id !== 'string') errors.push(`data.conditions[${index}].id tem tipo inválido.`);
		}
	}

	private validateFeatures(value: unknown, errors: string[]): void {
		if (!Array.isArray(value)) return;
		for (const [index, item] of value.entries()) {
			const field = `data.sheetFeatures[${index}]`;
			if (!item || typeof item !== 'object' || Array.isArray(item)) {
				errors.push(`${field} precisa ser um objeto com nome.`);
				continue;
			}
			const feature = item as Partial<CreatureFeature>;
			if (typeof feature.name !== 'string' || !feature.name.trim()) errors.push(`${field}.name é obrigatório.`);
			if (feature.id !== undefined && typeof feature.id !== 'string') errors.push(`${field}.id tem tipo inválido.`);
		}
	}

	private findConflicts(candidates: HomebrewSheetImportCandidate[]): HomebrewSheetImportConflict[] {
		const existing = this.storage.listSheets();
		const conflicts: HomebrewSheetImportConflict[] = [];
		for (const candidate of candidates) {
			const existingMatch = this.findMatch(candidate, existing);
			const previous = candidates.find((other) => other.index < candidate.index && this.sameIdentity(other, candidate));
			if (!existingMatch && !previous) continue;
			conflicts.push({
				index: candidate.index,
				candidate,
				existing: existingMatch,
				otherCandidateIndex: previous?.index,
				matchedBy: existingMatch && candidate.externalId === existingMatch.externalId ? 'externalId' : 'name',
				resolution: 'replace',
			});
		}
		return conflicts;
	}

	private findMatch(candidate: HomebrewSheetImportCandidate, sheets: SavedSheetInterface[]): SavedSheetInterface | null {
		if (candidate.externalId) {
			const byExternalId = sheets.find((sheet) => sheet.externalId === candidate.externalId);
			if (byExternalId) return byExternalId;
		}
		return sheets.find((sheet) => this.sameIdentity(candidate, sheet)) ?? null;
	}

	private sameIdentity(left: HomebrewSheetImportCandidate | SavedSheetInterface, right: HomebrewSheetImportCandidate | SavedSheetInterface): boolean {
		return this.identityKey(left.source, left.title, left.data?.name) === this.identityKey(right.source, right.title, right.data?.name);
	}

	private identityKey(source: unknown, title: unknown, name: unknown): string {
		return [source, title, name].map((value) => this.normalizeText(value)).join('|');
	}

	private buildNewSheet(candidate: HomebrewSheetImportCandidate, externalId?: string): SavedSheetInterface {
		return this.storage.buildSheet({
			...candidate,
			externalId: externalId ?? candidate.externalId,
			extra: candidate.extra,
		});
	}

	private buildReplacement(existing: SavedSheetInterface, candidate: HomebrewSheetImportCandidate): SavedSheetInterface {
		const next = this.buildNewSheet(candidate);
		return {
			...next,
			...this.knownFields(existing),
			...candidate.extra,
			id: existing.id,
			createdAt: existing.createdAt,
			updatedAt: Date.now(),
			externalId: candidate.externalId || existing.externalId,
		};
	}

	private knownFields(sheet: SavedSheetInterface): Record<string, unknown> {
		const known = new Set(['id', 'externalId', 'title', 'createdAt', 'updatedAt', 'data', 'category', 'tags', 'source']);
		return Object.fromEntries(Object.entries(sheet).filter(([key]) => !known.has(key)));
	}

	private findConflict(conflicts: HomebrewSheetImportConflict[], index: number): HomebrewSheetImportConflict | undefined {
		return conflicts.find((conflict) => conflict.index === index);
	}

	private rejectBackup(candidate: RawEnvelope): void {
		const data = candidate.data;
		const dataObject = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
		const backupKeys = ['homebrewSheets', 'encounters', 'battleEncounters', 'rawLocalStorage'];
		if (candidate.type === 'campaign-backup' || backupKeys.some((key) => dataObject && key in dataObject)) {
			throw new Error('Este arquivo pertence ao importador de backup completo, não ao importador de fichas.');
		}
	}

	private requiredText(value: unknown, field: string, errors: string[]): string {
		if (typeof value !== 'string' || !value.trim()) {
			errors.push(`${field} é obrigatório.`);
			return '';
		}
		return value.trim();
	}

	private category(value: unknown, errors: string[]): HomebrewCategory | null {
		if (typeof value !== 'string' || !CATEGORIES.includes(value as HomebrewCategory)) {
			errors.push('category precisa ser monster, npc, pc ou other.');
			return null;
		}
		return value as HomebrewCategory;
	}

	private tags(value: unknown, errors: string[]): string[] {
		if (value === undefined) return [];
		if (!Array.isArray(value) || value.some((tag) => typeof tag !== 'string')) {
			errors.push('tags precisa ser um array de textos.');
			return [];
		}
		return value.map((tag) => tag.trim()).filter(Boolean);
	}

	private externalId(
		value: unknown,
		source: string,
		title: string,
		name: string,
		warnings: string[],
		errors: string[],
		index: number,
	): string {
		if (value !== undefined && typeof value !== 'string') {
			errors.push('externalId tem tipo inválido.');
			return '';
		}
		if (typeof value === 'string' && value.trim()) return value.trim();
		const generated = `imported-${this.slugify(`${source}-${title}-${name}`)}`;
		warnings.push(`Ficha ${index + 1}: externalId ausente; valor estável gerado para esta ficha.`);
		return generated;
	}

	private unknownFields(sheet: Record<string, unknown>): Record<string, unknown> {
		return Object.fromEntries(Object.entries(sheet).filter(([key]) => !SHEET_FIELDS.has(key) && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt'));
	}

	private unknownDataFields(data: Record<string, unknown>): string[] {
		const known = new Set([
			'name', 'initiative', 'healthPoints', 'maxHealthPoints', 'armorClass', 'temporaryHealthPoints', 'id', 'alive',
			'conditions', 'notes', 'shared', 'hitPointsShared', 'totalSpellSlots', 'usedSpellSlots', 'spells',
			'specialAbilities', 'sheetFeatures', 'category', 'rawFiveETools', 'sourceSheetId',
		]);
		return Object.keys(data).filter((key) => !known.has(key));
	}

	private isFiniteNumber(value: unknown): value is number {
		return typeof value === 'number' && Number.isFinite(value);
	}

	private isFiniteNumeric(value: unknown): boolean {
		if (typeof value === 'number') return Number.isFinite(value);
		if (typeof value !== 'string' || !value.trim()) return false;
		return Number.isFinite(Number(value));
	}

	private normalizeExportedAt(value: unknown): string | null {
		if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
		if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
		return null;
	}

	private duplicateExternalId(externalId: string): string {
		return `${externalId}-copy-${globalThis.crypto?.randomUUID?.()?.slice(0, 8) ?? Date.now().toString(36)}`;
	}

	private normalizeText(value: unknown): string {
		return String(value ?? '')
			.trim()
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '');
	}

	private slugify(value: string): string {
		return this.normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 32);
	}
}
