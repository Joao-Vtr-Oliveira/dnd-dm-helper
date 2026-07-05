import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import type { BattleTrap } from '../../models/battle-encounter-model';
import type {
	CreatureFeature,
	CreatureInterface,
	CreatureSpecialAbility,
	SpellLevel,
	SpellSlots,
	SpellsByKey,
} from '../../models/battleTracker-model';
import type {
	FiveEToolsConflictComparisonRow,
	FiveEToolsConflictResolution,
	FiveEToolsEntitySummary,
	FiveEToolsEntityType,
	FiveEToolsHomebrewFile,
	FiveEToolsHomebrewSummary,
	FiveEToolsImportConflict,
	FiveEToolsImportPreview,
	FiveEToolsMeta,
	FiveEToolsMonster,
	FiveEToolsMonsterFeatureBlock,
	FiveEToolsSource,
	FiveEToolsSpellcastingBlock,
	FiveEToolsSpellcastingLevelBlock,
	FiveEToolsStoredBackup,
	FiveEToolsTrap,
	FiveEToolsValidationIssue,
	FiveEToolsValidationResult,
	FiveEToolsEntry,
	FiveEToolsEntryObject,
} from '../../models/fiveetools-homebrew-model';
import { CreatureTemplateService } from '../creature-template-service/creature-template-service';
import type { SavedSheetInterface } from '../local-storage-service/local-storage-service';

const DEFAULT_FILE_NAME = 'Notion_updated_Nagawoods_FULL.json';
const SPELL_LEVEL_KEYS: SpellLevel[] = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

@Injectable({ providedIn: 'root' })
export class FiveEToolsHomebrewService {
	private readonly creatureTemplateService = inject(CreatureTemplateService);
	private readonly storageKey = APP_STORAGE_KEYS.fiveEToolsHomebrew;
	private readonly backupKey = APP_STORAGE_KEYS.fiveEToolsHomebrewBackups;

	async loadLocalHomebrewJson(): Promise<FiveEToolsHomebrewFile> {
		const stored = this.readStoredFile();
		if (stored) return stored;

		const remote = await this.fetchRemoteHomebrewJson();
		this.saveHomebrewFile(remote);
		return remote;
	}

	getStoredHomebrewFile(): FiveEToolsHomebrewFile | null {
		return this.readStoredFile();
	}

	saveHomebrewFile(file: FiveEToolsHomebrewFile): FiveEToolsHomebrewFile {
		const normalized = this.parseHomebrewJson(file);
		localStorage.setItem(this.storageKey, JSON.stringify(normalized));
		return normalized;
	}

	createBackup(file: FiveEToolsHomebrewFile, label: string): FiveEToolsStoredBackup {
		const backups = this.listBackups();
		const backup: FiveEToolsStoredBackup = {
			id: globalThis.crypto?.randomUUID?.() ?? `brew-backup-${Date.now()}`,
			label,
			createdAt: new Date().toISOString(),
			file: structuredClone(file),
		};
		const nextBackups = [backup, ...backups].slice(0, 20);
		localStorage.setItem(this.backupKey, JSON.stringify(nextBackups));
		return backup;
	}

	listBackups(): FiveEToolsStoredBackup[] {
		const raw = localStorage.getItem(this.backupKey);
		if (!raw) return [];
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed
				.filter((item) => item && typeof item === 'object')
				.map((item, index) => {
					const candidate = item as Partial<FiveEToolsStoredBackup>;
					return {
						id: typeof candidate.id === 'string' ? candidate.id : `backup-${index + 1}`,
						label: typeof candidate.label === 'string' ? candidate.label : 'Backup local',
						createdAt:
							typeof candidate.createdAt === 'string' && !Number.isNaN(Date.parse(candidate.createdAt))
								? candidate.createdAt
								: new Date().toISOString(),
						file: this.parseHomebrewJson(candidate.file ?? this.createEmptyFile()),
					};
				});
		} catch {
			return [];
		}
	}

	async fetchRemoteHomebrewJson(): Promise<FiveEToolsHomebrewFile> {
		let response: Response;
		try {
			response = await fetch(environment.defaultFiveEToolsHomebrewUrl, {
				headers: { Accept: 'application/json' },
			});
		} catch {
			throw new Error('Nao foi possivel acessar o JSON 5etools remoto.');
		}

		if (!response.ok) {
			throw new Error(`Erro ao sincronizar JSON 5etools: ${response.status}.`);
		}

		let raw: unknown;
		try {
			raw = await response.json();
		} catch {
			throw new Error('JSON 5etools remoto invalido.');
		}

		return this.parseHomebrewJson(raw);
	}

	parseHomebrewJson(raw: unknown): FiveEToolsHomebrewFile {
		const validation = this.validateHomebrewJson(raw);
		if (!validation.valid || !validation.file) {
			throw new Error(validation.error ?? 'JSON 5etools invalido.');
		}
		return validation.file;
	}

	validateHomebrewJson(raw: unknown): FiveEToolsValidationResult {
		const warnings: string[] = [];
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
			return { valid: false, warnings, error: 'O arquivo 5etools precisa ser um objeto JSON.' };
		}

		const candidate = structuredClone(raw as Record<string, unknown>) as any;
		const meta = this.normalizeMeta(candidate._meta, warnings);
		if (!meta.sources.length) {
			return { valid: false, warnings, error: 'O arquivo 5etools precisa ter _meta.sources.' };
		}

		const hasKnownCollection =
			Array.isArray(candidate.monster) || Array.isArray(candidate.trap) || this.findOtherCollections(candidate).length > 0;
		if (!hasKnownCollection) {
			warnings.push('O arquivo nao possui arrays conhecidos de homebrew ainda.');
		}

		const normalized: FiveEToolsHomebrewFile = {
			...candidate,
			_meta: meta,
			monster: Array.isArray(candidate.monster)
				? candidate.monster.map((monster: unknown, index: number) => this.normalizeMonster(monster, index, meta.sources[0]?.json, warnings))
				: [],
			trap: Array.isArray(candidate.trap)
				? candidate.trap.map((trap: unknown, index: number) => this.normalizeTrap(trap, index, meta.sources[0]?.json, warnings))
				: [],
		};

		return {
			valid: true,
			file: normalized,
			warnings,
		};
	}

	buildSummary(file: FiveEToolsHomebrewFile): FiveEToolsHomebrewSummary {
		const primarySource = this.getPrimarySource(file);
		return {
			primarySource,
			siteVersion: typeof file.siteVersion === 'string' ? file.siteVersion : null,
			dateLastModified:
				typeof file._meta.dateLastModified === 'number' ? file._meta.dateLastModified : null,
			monsterCount: file.monster?.length ?? 0,
			trapCount: file.trap?.length ?? 0,
			otherCollections: this.findOtherCollections(file),
			availableSources: Array.from(
				new Set(this.listEntities(file).map((entity) => entity.source).filter(Boolean)),
			).sort((left, right) => left.localeCompare(right)),
			availableGroups: Array.from(
				new Set(this.listEntities(file).flatMap((entity) => entity.groups).filter(Boolean)),
			).sort((left, right) => left.localeCompare(right)),
			availableCreatureTypes: Array.from(
				new Set(
					(file.monster ?? [])
						.map((monster) => this.getMonsterTypeLabel(monster))
						.filter((type): type is string => !!type),
				),
			).sort((left, right) => left.localeCompare(right)),
		};
	}

	listEntities(file: FiveEToolsHomebrewFile): FiveEToolsEntitySummary[] {
		const monsters = (file.monster ?? []).map<FiveEToolsEntitySummary>((monster) => ({
			id: this.createEntityId('monster', monster.name, monster.source),
			type: 'monster',
			name: monster.name,
			source: monster.source,
			groups: Array.isArray(monster.group) ? monster.group.filter(Boolean) : [],
			labels: this.collectMonsterLabels(monster),
			description: this.describeMonster(monster),
			creatureType: this.getMonsterTypeLabel(monster) ?? undefined,
			cr: monster.cr,
			level: monster.level,
			acLabel: this.describeMonsterAc(monster),
			hpAverage: monster.hp?.average,
			firstDetailTitle: this.getFirstBlock(monster)?.name,
			firstDetailText: this.getFirstBlock(monster) ? this.flattenEntries(this.getFirstBlock(monster)?.entries) : undefined,
			searchText: this.buildMonsterSearchText(monster),
		}));
		const traps = (file.trap ?? []).map<FiveEToolsEntitySummary>((trap) => ({
			id: this.createEntityId('trap', trap.name, trap.source),
			type: 'trap',
			name: trap.name,
			source: trap.source,
			groups: [],
			labels: trap.trapHazType ? [trap.trapHazType] : [],
			description: this.flattenEntries(trap.entries).slice(0, 220),
			trapHazType: trap.trapHazType,
			firstDetailText: this.flattenEntries(trap.entries).split('\n')[0] || undefined,
			initiativeHint: this.detectInitiativeHint(trap),
			searchText: this.buildTrapSearchText(trap),
		}));

		return [...monsters, ...traps].sort((left, right) => {
			if (left.type !== right.type) return left.type.localeCompare(right.type);
			return left.name.localeCompare(right.name);
		});
	}

	getMonster(file: FiveEToolsHomebrewFile, name: string, source: string): FiveEToolsMonster | null {
		return file.monster?.find((monster) => monster.name === name && monster.source === source) ?? null;
	}

	getTrap(file: FiveEToolsHomebrewFile, name: string, source: string): FiveEToolsTrap | null {
		return file.trap?.find((trap) => trap.name === name && trap.source === source) ?? null;
	}

	getEntityById(file: FiveEToolsHomebrewFile, entityId: string): FiveEToolsMonster | FiveEToolsTrap | null {
		const [type, source, ...nameParts] = entityId.split('::');
		const name = nameParts.join('::');
		if (type === 'monster') return this.getMonster(file, name, source);
		if (type === 'trap') return this.getTrap(file, name, source);
		return null;
	}

	upsertMonster(file: FiveEToolsHomebrewFile, monster: FiveEToolsMonster): FiveEToolsHomebrewFile {
		return this.upsertEntity(file, 'monster', this.normalizeMonster(monster, 0, this.getPrimarySource(file), []));
	}

	upsertTrap(file: FiveEToolsHomebrewFile, trap: FiveEToolsTrap): FiveEToolsHomebrewFile {
		return this.upsertEntity(file, 'trap', this.normalizeTrap(trap, 0, this.getPrimarySource(file), []));
	}

	duplicateEntity(file: FiveEToolsHomebrewFile, entityId: string): FiveEToolsHomebrewFile {
		const entity = this.getEntityById(file, entityId);
		if (!entity) return file;
		if (this.isMonster(entity)) {
			return this.upsertMonster(file, {
				...structuredClone(entity),
				name: this.createUniqueEntityName(file.monster ?? [], entity.name, entity.source),
			});
		}
		return this.upsertTrap(file, {
			...structuredClone(entity),
			name: this.createUniqueEntityName(file.trap ?? [], entity.name, entity.source),
		});
	}

	deleteEntity(
		file: FiveEToolsHomebrewFile,
		type: FiveEToolsEntityType,
		name: string,
		source: string,
	): FiveEToolsHomebrewFile {
		if (type === 'monster') {
			return this.touchFile({
				...structuredClone(file),
				monster: (file.monster ?? []).filter((monster) => !(monster.name === name && monster.source === source)),
			});
		}

		return this.touchFile({
			...structuredClone(file),
			trap: (file.trap ?? []).filter((trap) => !(trap.name === name && trap.source === source)),
		});
	}

	prepareImportPartialJson(
		file: FiveEToolsHomebrewFile,
		raw: unknown,
		options?: { coerceSourcesToPrimary?: boolean; addMissingSourcesToMeta?: boolean },
	): FiveEToolsImportPreview {
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
			throw new Error('O trecho importado precisa ser um objeto JSON.');
		}

		const candidate = structuredClone(raw as Record<string, unknown>) as any;
		const warnings: string[] = [];
		const primarySource = this.getPrimarySource(file);
		const coerceSourcesToPrimary = options?.coerceSourcesToPrimary !== false;
		const partial: Partial<FiveEToolsHomebrewFile> = { ...candidate };

		partial.monster = Array.isArray(candidate.monster)
			? candidate.monster.map((monster: unknown, index: number) => {
				const normalized = this.normalizeMonster(monster, index, primarySource, warnings);
				if (coerceSourcesToPrimary && normalized.source !== primarySource) {
					warnings.push(`Source de ${normalized.name} convertido para ${primarySource}.`);
					normalized.source = primarySource;
				}
				return normalized;
			})
			: [];
		partial.trap = Array.isArray(candidate.trap)
			? candidate.trap.map((trap: unknown, index: number) => {
				const normalized = this.normalizeTrap(trap, index, primarySource, warnings);
				if (coerceSourcesToPrimary && normalized.source !== primarySource) {
					warnings.push(`Source de ${normalized.name} convertido para ${primarySource}.`);
					normalized.source = primarySource;
				}
				return normalized;
			})
			: [];

		const importedSources =
			candidate._meta && typeof candidate._meta === 'object' && !Array.isArray(candidate._meta)
				? this.extractMetaSources((candidate._meta as any).sources)
				: [];
		const conflicts: FiveEToolsImportConflict[] = [];
		for (const monster of partial.monster ?? []) {
			if (this.getMonster(file, monster.name, monster.source)) {
				conflicts.push({
					id: this.createEntityId('monster', monster.name, monster.source),
					type: 'monster',
					name: monster.name,
					source: monster.source,
					resolution: 'replace',
				});
			}
		}
		for (const trap of partial.trap ?? []) {
			if (this.getTrap(file, trap.name, trap.source)) {
				conflicts.push({
					id: this.createEntityId('trap', trap.name, trap.source),
					type: 'trap',
					name: trap.name,
					source: trap.source,
					resolution: 'replace',
				});
			}
		}

		if (!(partial.monster?.length || partial.trap?.length)) {
			throw new Error('O trecho nao contem arrays monster ou trap para importar.');
		}

		if (!coerceSourcesToPrimary && importedSources.length && options?.addMissingSourcesToMeta !== true) {
			warnings.push('O trecho possui sources proprios. Eles serao preservados, mas exigem inclusao no _meta ao mesclar.');
		}

		return {
			partial,
			conflicts,
			warnings,
			primarySource,
			summary: {
				monsters: partial.monster?.length ?? 0,
				traps: partial.trap?.length ?? 0,
				sources: Array.from(
					new Set([
						...(partial.monster ?? []).map((monster) => monster.source),
						...(partial.trap ?? []).map((trap) => trap.source),
					]),
				).sort((left, right) => left.localeCompare(right)),
			},
		};
	}

	mergePartialJsonIntoFullFile(
		file: FiveEToolsHomebrewFile,
		preview: FiveEToolsImportPreview,
		resolutions?: Record<string, FiveEToolsConflictResolution>,
		options?: { addMissingSourcesToMeta?: boolean },
	): FiveEToolsHomebrewFile {
		let nextFile = structuredClone(file);

		for (const monster of preview.partial.monster ?? []) {
			const conflictId = this.createEntityId('monster', monster.name, monster.source);
			const resolution = resolutions?.[conflictId] ?? preview.conflicts.find((conflict) => conflict.id === conflictId)?.resolution ?? 'replace';
			nextFile = this.applyImportEntity(nextFile, 'monster', monster, resolution);
		}

		for (const trap of preview.partial.trap ?? []) {
			const conflictId = this.createEntityId('trap', trap.name, trap.source);
			const resolution = resolutions?.[conflictId] ?? preview.conflicts.find((conflict) => conflict.id === conflictId)?.resolution ?? 'replace';
			nextFile = this.applyImportEntity(nextFile, 'trap', trap, resolution);
		}

		nextFile = this.mergeOtherCollections(nextFile, preview.partial);
		if (options?.addMissingSourcesToMeta) {
			nextFile = this.mergeMetaSources(nextFile, preview.partial._meta);
		}

		return this.touchFile(nextFile);
	}

	exportFullJson(file: FiveEToolsHomebrewFile): string {
		return JSON.stringify(this.touchFile(file), null, 2);
	}

	downloadFullJson(file: FiveEToolsHomebrewFile, filename = DEFAULT_FILE_NAME): void {
		this.downloadJson(this.exportFullJson(file), filename);
	}

	downloadEntityJson(
		file: FiveEToolsHomebrewFile,
		entityId: string,
		filename?: string,
	): void {
		const entity = this.getEntityById(file, entityId);
		if (!entity) throw new Error('Entidade 5etools nao encontrada.');
		const payload: Partial<FiveEToolsHomebrewFile> = {
			_meta: {
				sources: file._meta.sources.filter((source) => source.json === entity.source),
			},
		};
		if (this.isMonster(entity)) payload.monster = [entity];
		else payload.trap = [entity];
		const safeName = this.slugify(entity.name) || '5etools-item';
		this.downloadJson(JSON.stringify(payload, null, 2), filename ?? `${safeName}.json`);
	}

	toSpellTag(name: string, source = 'XPHB'): string {
		return `{@spell ${name.trim()}|${source.trim() || 'XPHB'}}`;
	}

	toDamageTag(dice: string): string {
		return `{@damage ${dice.trim()}}`;
	}

	toConditionTag(name: string, source = 'XPHB'): string {
		return `{@condition ${name.trim()}|${source.trim() || 'XPHB'}}`;
	}

	toDcTag(value: number): string {
		return `{@dc ${Math.max(0, Math.floor(value))}}`;
	}

	toHitTag(value: number): string {
		const normalized = Math.floor(value);
		return `{@hit ${normalized >= 0 ? normalized : normalized}}`;
	}

	toDiceTag(value: string): string {
		return `{@dice ${value.trim()}}`;
	}

	toSaveTag(ability: string): string {
		return `{@actSave ${ability.trim().toLowerCase()}}`;
	}

	toActSaveTag(ability: string): string {
		return this.toSaveTag(ability);
	}

	renderText(text: string): string {
		return text
			.replace(/\{@spell\s+([^|}]+)(?:\|[^}]+)?\}/gi, '$1')
			.replace(/\{@damage\s+([^}]+)\}/gi, '$1')
			.replace(/\{@condition\s+([^|}]+)(?:\|[^}]+)?\}/gi, '$1')
			.replace(/\{@dc\s+(\d+)\}/gi, 'DC $1')
			.replace(/\{@hit\s+([-+]?\d+)\}/gi, (_all, value: string) => {
				const numeric = Number(value);
				if (!Number.isFinite(numeric)) return value;
				return numeric >= 0 ? `+${numeric}` : String(numeric);
			})
			.replace(/\{@dice\s+([^}]+)\}/gi, '$1')
			.replace(/\{@actSave\s+([^}]+)\}/gi, (_all, ability: string) => `${this.prettyAbility(ability)} Save`)
			.replace(/\{@actTrigger\}/gi, 'Gatilho:')
			.replace(/\{@actResponse\}/gi, 'Resposta:')
			.replace(/\{@actSaveFail\}/gi, 'Falha:')
			.replace(/\{@actSaveSuccess\}/gi, 'Sucesso:')
			.replace(/\{@h\}/gi, 'Acerto: ')
			.replace(/\{@atkr\s+([^}]+)\}/gi, (_all, mode: string) => this.renderAttackMode(mode))
			.replace(/\{@[^}]+\}/g, (tag) => tag.replace(/[{}@]/g, ''));
	}

	renderEntry(entry: FiveEToolsEntry): string[] {
		if (typeof entry === 'string') return [this.renderText(entry)];
		const lines: string[] = [];
		if (entry.name && entry.type === 'entries') {
			lines.push(entry.name.trim());
		}
		for (const child of entry.entries ?? []) {
			lines.push(...this.renderEntry(child));
		}
		return lines;
	}

	renderEntries(entries: FiveEToolsEntry[] | undefined): string[] {
		return (entries ?? []).flatMap((entry) => this.renderEntry(entry)).filter(Boolean);
	}

	validateMonster(monster: FiveEToolsMonster, primarySource?: string): FiveEToolsValidationIssue[] {
		const issues: FiveEToolsValidationIssue[] = [];
		if (!monster.name.trim()) issues.push({ level: 'error', field: 'name', message: 'Monster sem nome.' });
		if (!monster.source.trim()) issues.push({ level: 'error', field: 'source', message: 'Monster sem source.' });
		if (primarySource && monster.source.trim() && monster.source !== primarySource) {
			issues.push({ level: 'warning', field: 'source', message: `Source diferente do principal: ${monster.source}.` });
		}
		if (!(monster.ac?.length ?? 0)) issues.push({ level: 'warning', field: 'ac', message: 'Monster sem AC definida.' });
		if (!monster.hp?.average && !monster.hp?.formula) issues.push({ level: 'warning', field: 'hp', message: 'Monster sem HP definido.' });
		for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
			if (monster[ability] == null) issues.push({ level: 'warning', field: ability, message: `Atributo ${ability.toUpperCase()} ausente.` });
		}
		for (const section of [
			{ key: 'trait', blocks: monster.trait },
			{ key: 'action', blocks: monster.action },
			{ key: 'bonus', blocks: monster.bonus },
			{ key: 'reaction', blocks: monster.reaction },
			{ key: 'legendary', blocks: monster.legendary },
		]) {
			for (const [index, block] of (section.blocks ?? []).entries()) {
				if (!block.entries?.length) {
					issues.push({ level: 'warning', field: `${section.key}[${index}]`, message: `${section.key} sem entries.` });
				}
				for (const line of this.flattenEntries(block.entries).split('\n')) {
					if (line.includes('{@spell') && !/^.*\{@spell\s+[^|}]+(?:\|[^}]+)?\}.*$/i.test(line)) {
						issues.push({ level: 'warning', field: `${section.key}[${index}]`, message: 'Tag de spell potencialmente malformada.' });
					}
				}
			}
		}
		return issues;
	}

	validateTrap(trap: FiveEToolsTrap, primarySource?: string): FiveEToolsValidationIssue[] {
		const issues: FiveEToolsValidationIssue[] = [];
		if (!trap.name.trim()) issues.push({ level: 'error', field: 'name', message: 'Trap sem nome.' });
		if (!trap.source.trim()) issues.push({ level: 'error', field: 'source', message: 'Trap sem source.' });
		if (primarySource && trap.source.trim() && trap.source !== primarySource) {
			issues.push({ level: 'warning', field: 'source', message: `Source diferente do principal: ${trap.source}.` });
		}
		if (!trap.trapHazType?.trim()) issues.push({ level: 'warning', field: 'trapHazType', message: 'trapHazType vazio.' });
		if (!trap.entries.length) issues.push({ level: 'warning', field: 'entries', message: 'Trap sem entries.' });
		for (const [index, line] of this.renderEntries(trap.entries).entries()) {
			if (line.includes('{@spell') && !/^.*\{@spell\s+[^|}]+(?:\|[^}]+)?\}.*$/i.test(line)) {
				issues.push({ level: 'warning', field: `entries[${index}]`, message: 'Tag de spell potencialmente malformada.' });
			}
		}
		return issues;
	}

	buildConflictComparison(
		file: FiveEToolsHomebrewFile,
		incoming: FiveEToolsMonster | FiveEToolsTrap,
		type: FiveEToolsEntityType,
	): FiveEToolsConflictComparisonRow[] {
		const existing = type === 'monster'
			? this.getMonster(file, incoming.name, incoming.source)
			: this.getTrap(file, incoming.name, incoming.source);
		if (!existing) return [];

		if (type === 'monster') {
			const current = existing as FiveEToolsMonster;
			const next = incoming as FiveEToolsMonster;
			return this.compRows([
				['Nome', current.name, next.name],
				['Source', current.source, next.source],
				['Tipo', this.getMonsterTypeLabel(current) ?? '-', this.getMonsterTypeLabel(next) ?? '-'],
				['CR', current.cr ?? '-', next.cr ?? '-'],
				['AC', this.describeMonsterAc(current), this.describeMonsterAc(next)],
				['HP', String(current.hp?.average ?? '-'), String(next.hp?.average ?? '-')],
				['Traits', String(current.trait?.length ?? 0), String(next.trait?.length ?? 0)],
				['Actions', String(current.action?.length ?? 0), String(next.action?.length ?? 0)],
				['Spellcasting', String(current.spellcasting?.length ?? 0), String(next.spellcasting?.length ?? 0)],
			]);
		}

		const current = existing as FiveEToolsTrap;
		const next = incoming as FiveEToolsTrap;
		return this.compRows([
			['Nome', current.name, next.name],
			['Source', current.source, next.source],
			['trapHazType', current.trapHazType ?? '-', next.trapHazType ?? '-'],
			['Entries', String(current.entries.length), String(next.entries.length)],
			['Resumo', this.renderEntries(current.entries)[0] ?? '-', this.renderEntries(next.entries)[0] ?? '-'],
		]);
	}

	convertMonsterToCreature(monster: FiveEToolsMonster, id = 0): CreatureInterface {
		const spellData = this.extractSpellData(monster.spellcasting ?? []);
		const specialAbilities = this.extractSpecialAbilitiesFromMonster(monster);
		const creature = this.creatureTemplateService.normalizeCreature({
			id,
			name: monster.name,
			initiative: this.dexMod(monster.dex),
			healthPoints: this.getMonsterHpAverage(monster),
			maxHealthPoints: this.getMonsterHpAverage(monster),
			armorClass: this.getMonsterAcValue(monster),
			temporaryHealthPoints: null,
			alive: true,
			conditions: [],
			notes: [],
			shared: true,
			hitPointsShared: true,
			totalSpellSlots: spellData.totalSpellSlots,
			usedSpellSlots: spellData.usedSpellSlots,
			spells: spellData.spells,
			specialAbilities,
			sheetFeatures: this.extractCreatureFeatures(monster),
			category: this.inferCreatureCategory(monster),
			rawFiveETools: structuredClone(monster),
		});
		return creature;
	}

	convertMonsterToSheet(monster: FiveEToolsMonster): Omit<SavedSheetInterface, 'id' | 'createdAt' | 'updatedAt'> {
		const creature = this.convertMonsterToCreature(monster);
		const category = creature.category ?? 'monster';
		return {
			title: monster.name,
			data: creature,
			category,
			tags: Array.isArray(monster.group) ? monster.group.filter(Boolean) : [],
			source: monster.source,
		};
	}

	convertSheetToMonster(sheet: SavedSheetInterface, preferredSource?: string): FiveEToolsMonster {
		const existingRaw = this.isMonster(sheet.data.rawFiveETools) ? structuredClone(sheet.data.rawFiveETools) : null;
		const source = preferredSource?.trim() || existingRaw?.source || sheet.source || 'Notion';
		const name = sheet.data.name.trim() || sheet.title.trim() || existingRaw?.name || 'Nova Ficha';
		const base: FiveEToolsMonster = existingRaw ?? {
			name,
			source,
			size: ['M'],
			type: sheet.category === 'other' ? 'object' : 'humanoid',
			alignment: ['U'],
			ac: [12],
			hp: { average: Math.max(0, sheet.data.maxHealthPoints ?? sheet.data.healthPoints ?? 0), formula: String(Math.max(0, sheet.data.maxHealthPoints ?? sheet.data.healthPoints ?? 0)) },
			speed: { walk: 30 },
			str: 10,
			dex: 10,
			con: 10,
			int: 10,
			wis: 10,
			cha: 10,
			passive: 10,
			trait: [],
			action: [],
			reaction: [],
			bonus: [],
			legendary: [],
		};

		const speed = typeof base.speed === 'object' && base.speed != null ? structuredClone(base.speed) : { walk: 30 };
		const nextMonster: FiveEToolsMonster = {
			...base,
			name,
			source,
			alias: this.uniqueStrings(this.mergeArrays(base.alias, sheet.title && sheet.title !== name ? [sheet.title] : [])),
			group: this.uniqueStrings(this.mergeArrays(base.group, sheet.tags ?? [])),
			type: sheet.category === 'other' ? 'object' : base.type ?? 'humanoid',
			ac: [this.toNonNegativeInt(sheet.data.armorClass) || this.getMonsterAcValue(base)],
			hp: {
				...(base.hp ?? {}),
				average: Math.max(0, sheet.data.maxHealthPoints ?? sheet.data.healthPoints ?? 0),
				formula:
					typeof base.hp?.formula === 'string'
						? base.hp.formula
						: String(Math.max(0, sheet.data.maxHealthPoints ?? sheet.data.healthPoints ?? 0)),
			},
			speed,
			spellcasting: this.createSpellcastingFromCreature(sheet.data, base.spellcasting ?? []),
		};

		const groupedFeatures = this.groupCreatureFeatures(sheet.data.sheetFeatures ?? []);
		nextMonster.trait = this.mergeFeatureBlocks(base.trait ?? [], groupedFeatures.trait, sheet.data.specialAbilities ?? []);
		nextMonster.action = groupedFeatures.action.length ? groupedFeatures.action : base.action ?? [];
		nextMonster.bonus = groupedFeatures.bonus.length ? groupedFeatures.bonus : base.bonus ?? [];
		nextMonster.reaction = groupedFeatures.reaction.length ? groupedFeatures.reaction : base.reaction ?? [];
		nextMonster.legendary = groupedFeatures.legendary.length ? groupedFeatures.legendary : base.legendary ?? [];

		return nextMonster;
	}

	convertTrapToEncounterTrap(trap: FiveEToolsTrap): BattleTrap {
		return {
			id: globalThis.crypto?.randomUUID?.() ?? `trap-${Date.now()}`,
			name: trap.name,
			description: this.flattenEntries(trap.entries),
			triggerType: 'initiative',
			initiative: 20,
			active: true,
			frequency: 'every-round',
			currentCooldownRounds: 0,
		};
	}

	flattenEntries(entries: FiveEToolsEntry[] | undefined): string {
		return (entries ?? [])
			.map((entry) => this.flattenEntry(entry))
			.filter(Boolean)
			.join('\n');
	}

	formatJson(value: unknown): string {
		return JSON.stringify(value ?? null, null, 2);
	}

	parseJsonField<T>(value: string, fallback: T): T {
		const text = value.trim();
		if (!text) return fallback;
		return JSON.parse(text) as T;
	}

	createEmptyFile(primarySource = 'Notion'): FiveEToolsHomebrewFile {
		return {
			siteVersion: '2.24.1',
			_meta: {
				sources: [
					{
						json: primarySource,
						abbreviation: primarySource.slice(0, 2).toUpperCase(),
						full: primarySource,
						version: '1.0.0',
						authors: [],
						edition: 'classic',
					},
				],
				dateAdded: this.nowUnix(),
				dateLastModified: this.nowUnix(),
				edition: 'classic',
			},
			monster: [],
			trap: [],
		};
	}

	createEmptyMonster(primarySource = 'Notion'): FiveEToolsMonster {
		return {
			name: 'Novo Monstro',
			source: primarySource,
			size: ['M'],
			type: 'humanoid',
			alignment: ['U'],
			ac: [12],
			hp: { average: 10, formula: '3d8' },
			speed: { walk: 30 },
			str: 10,
			dex: 10,
			con: 10,
			int: 10,
			wis: 10,
			cha: 10,
			passive: 10,
			languages: [],
			trait: [],
			action: [],
			bonus: [],
			reaction: [],
			legendary: [],
			spellcasting: [],
		};
	}

	createEmptyTrap(primarySource = 'Notion'): FiveEToolsTrap {
		return {
			name: 'Nova Armadilha',
			source: primarySource,
			trapHazType: 'MAG',
			entries: [],
		};
	}

	private readStoredFile(): FiveEToolsHomebrewFile | null {
		const raw = localStorage.getItem(this.storageKey);
		if (!raw) return null;
		try {
			return this.parseHomebrewJson(JSON.parse(raw));
		} catch {
			return null;
		}
	}

	private normalizeMeta(raw: unknown, warnings: string[]): FiveEToolsMeta {
		const candidate = raw && typeof raw === 'object' && !Array.isArray(raw) ? (structuredClone(raw) as any) : {};
		const sources = this.extractMetaSources(candidate.sources).map((source, index) => this.normalizeSource(source, index, warnings));
		return {
			...candidate,
			sources,
			dateAdded:
				typeof candidate.dateAdded === 'number' ? candidate.dateAdded : typeof candidate.dateModified === 'number' ? candidate.dateModified : undefined,
			dateLastModified:
				typeof candidate.dateLastModified === 'number' ? candidate.dateLastModified : undefined,
			edition: typeof candidate.edition === 'string' ? candidate.edition : undefined,
		};
	}

	private normalizeSource(raw: unknown, index: number, warnings: string[]): FiveEToolsSource {
		const candidate = raw && typeof raw === 'object' && !Array.isArray(raw) ? (structuredClone(raw) as any) : {};
		const json = typeof candidate.json === 'string' && candidate.json.trim() ? candidate.json.trim() : `Source${index + 1}`;
		if (typeof candidate.json !== 'string') warnings.push(`Source ${index + 1} sem campo json; valor padrao aplicado.`);
		return {
			...candidate,
			json,
			abbreviation:
				typeof candidate.abbreviation === 'string' && candidate.abbreviation.trim()
					? candidate.abbreviation.trim()
					: json.slice(0, 3).toUpperCase(),
			full: typeof candidate.full === 'string' && candidate.full.trim() ? candidate.full.trim() : json,
			version:
				typeof candidate.version === 'string' && candidate.version.trim()
					? candidate.version.trim()
					: '1.0.0',
			authors: Array.isArray(candidate.authors) ? candidate.authors.filter((author: unknown) => typeof author === 'string') : [],
			color: typeof candidate.color === 'string' ? candidate.color : undefined,
			edition: typeof candidate.edition === 'string' ? candidate.edition : undefined,
		};
	}

	private normalizeMonster(raw: unknown, index: number, primarySource: string | undefined, warnings: string[]): FiveEToolsMonster {
		const candidate = raw && typeof raw === 'object' && !Array.isArray(raw) ? (structuredClone(raw) as any) : {};
		const name = typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : `Monster ${index + 1}`;
		if (typeof candidate.name !== 'string') warnings.push(`Monster ${index + 1} sem nome; nome padrao aplicado.`);
		return {
			...candidate,
			name,
			source:
				typeof candidate.source === 'string' && candidate.source.trim()
					? candidate.source.trim()
					: primarySource || 'Notion',
			alias: Array.isArray(candidate.alias) ? candidate.alias.filter((value: unknown) => typeof value === 'string') : undefined,
			group: Array.isArray(candidate.group) ? candidate.group.filter((value: unknown) => typeof value === 'string') : undefined,
			size: Array.isArray(candidate.size) ? candidate.size.filter((value: unknown) => typeof value === 'string') : undefined,
			alignment: Array.isArray(candidate.alignment) ? candidate.alignment.filter((value: unknown) => typeof value === 'string') : undefined,
			ac: Array.isArray(candidate.ac) ? candidate.ac : undefined,
			hp:
				candidate.hp && typeof candidate.hp === 'object' && !Array.isArray(candidate.hp)
					? (candidate.hp as FiveEToolsMonster['hp'])
					: undefined,
			speed:
				candidate.speed && typeof candidate.speed === 'object' && !Array.isArray(candidate.speed)
					? (candidate.speed as Record<string, unknown>)
					: undefined,
			str: this.toOptionalNumber(candidate.str),
			dex: this.toOptionalNumber(candidate.dex),
			con: this.toOptionalNumber(candidate.con),
			int: this.toOptionalNumber(candidate.int),
			wis: this.toOptionalNumber(candidate.wis),
			cha: this.toOptionalNumber(candidate.cha),
			save:
				candidate.save && typeof candidate.save === 'object' && !Array.isArray(candidate.save)
					? (Object.fromEntries(Object.entries(candidate.save as Record<string, unknown>).filter(([, value]) => typeof value === 'string')) as Record<string, string>)
					: undefined,
			skill:
				candidate.skill && typeof candidate.skill === 'object' && !Array.isArray(candidate.skill)
					? (Object.fromEntries(Object.entries(candidate.skill as Record<string, unknown>).filter(([, value]) => typeof value === 'string')) as Record<string, string>)
					: undefined,
			senses: Array.isArray(candidate.senses) ? candidate.senses.filter((value: unknown) => typeof value === 'string') : undefined,
			passive: this.toOptionalNumber(candidate.passive),
			languages: Array.isArray(candidate.languages) ? candidate.languages.filter((value: unknown) => typeof value === 'string') : undefined,
			cr: typeof candidate.cr === 'string' ? candidate.cr : undefined,
			level: this.toOptionalNumber(candidate.level),
			resist: Array.isArray(candidate.resist) ? candidate.resist : undefined,
			immune: Array.isArray(candidate.immune) ? candidate.immune : undefined,
			vulnerable: Array.isArray(candidate.vulnerable) ? candidate.vulnerable : undefined,
			conditionImmune: Array.isArray(candidate.conditionImmune) ? candidate.conditionImmune : undefined,
			trait: this.normalizeFeatureBlocks(candidate.trait),
			action: this.normalizeFeatureBlocks(candidate.action),
			bonus: this.normalizeFeatureBlocks(candidate.bonus),
			reaction: this.normalizeFeatureBlocks(candidate.reaction),
			legendary: this.normalizeFeatureBlocks(candidate.legendary),
			spellcasting: this.normalizeSpellcastingBlocks(candidate.spellcasting),
		};
	}

	private normalizeTrap(raw: unknown, index: number, primarySource: string | undefined, warnings: string[]): FiveEToolsTrap {
		const candidate = raw && typeof raw === 'object' && !Array.isArray(raw) ? (structuredClone(raw) as any) : {};
		const name = typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : `Trap ${index + 1}`;
		if (typeof candidate.name !== 'string') warnings.push(`Trap ${index + 1} sem nome; nome padrao aplicado.`);
		return {
			...candidate,
			name,
			source:
				typeof candidate.source === 'string' && candidate.source.trim()
					? candidate.source.trim()
					: primarySource || 'Notion',
			trapHazType: typeof candidate.trapHazType === 'string' ? candidate.trapHazType : undefined,
			entries: Array.isArray(candidate.entries) ? candidate.entries.map((entry: unknown) => this.normalizeEntry(entry)) : [],
		};
	}

	private normalizeFeatureBlocks(raw: unknown): FiveEToolsMonsterFeatureBlock[] | undefined {
		if (!Array.isArray(raw)) return undefined;
		return raw
			.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
			.map((item) => {
				const candidate = structuredClone(item as any);
				return {
					...candidate,
					name: typeof candidate.name === 'string' ? candidate.name : undefined,
					entries: Array.isArray(candidate.entries) ? candidate.entries.map((entry: unknown) => this.normalizeEntry(entry)) : [],
				};
			});
	}

	private normalizeSpellcastingBlocks(raw: unknown): FiveEToolsSpellcastingBlock[] | undefined {
		if (!Array.isArray(raw)) return undefined;
		return raw
			.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
			.map((item) => {
				const candidate = structuredClone(item as any);
				const spells = candidate.spells && typeof candidate.spells === 'object' && !Array.isArray(candidate.spells)
					? Object.fromEntries(
						Object.entries(candidate.spells as Record<string, unknown>).map(([key, value]) => [
							key,
							this.normalizeSpellcastingLevelBlock(value),
						]),
					)
					: undefined;
				return {
					...candidate,
					name: typeof candidate.name === 'string' ? candidate.name : undefined,
					type: typeof candidate.type === 'string' ? candidate.type : undefined,
					headerEntries: Array.isArray(candidate.headerEntries) ? candidate.headerEntries.map((entry: unknown) => this.normalizeEntry(entry)) : undefined,
					footerEntries: Array.isArray(candidate.footerEntries) ? candidate.footerEntries.map((entry: unknown) => this.normalizeEntry(entry)) : undefined,
					spells,
					displayAs: typeof candidate.displayAs === 'string' ? candidate.displayAs : undefined,
				};
			});
	}

	private normalizeSpellcastingLevelBlock(raw: unknown): FiveEToolsSpellcastingLevelBlock {
		const candidate = raw && typeof raw === 'object' && !Array.isArray(raw) ? (structuredClone(raw) as any) : {};
		return {
			...candidate,
			spells: Array.isArray(candidate.spells) ? candidate.spells.filter((spell: unknown) => typeof spell === 'string') : [],
			slots: this.toOptionalNumber(candidate.slots),
		};
	}

	private normalizeEntry(entry: unknown): FiveEToolsEntry {
		if (typeof entry === 'string') return entry;
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return JSON.stringify(entry);
		const candidate = structuredClone(entry as any);
		return {
			...candidate,
			type: typeof candidate.type === 'string' ? candidate.type : undefined,
			name: typeof candidate.name === 'string' ? candidate.name : undefined,
			entries: Array.isArray(candidate.entries) ? candidate.entries.map((item: unknown) => this.normalizeEntry(item)) : undefined,
		} as FiveEToolsEntryObject;
	}

	private describeMonster(monster: FiveEToolsMonster): string {
		const statBits = [
			monster.cr ? `CR ${monster.cr}` : null,
			monster.level != null ? `Nível ${monster.level}` : null,
			monster.type ? (typeof monster.type === 'string' ? monster.type : 'tipo complexo') : null,
		]
			.filter(Boolean)
			.join(' • ');
		const entries = [
			this.flattenEntries(monster.trait?.flatMap((block) => block.entries ?? []) ?? []),
			this.flattenEntries(monster.action?.flatMap((block) => block.entries ?? []) ?? []),
		]
			.filter(Boolean)
			.join(' ')
			.slice(0, 200);
		return [statBits, entries].filter(Boolean).join(' — ');
	}

	private collectMonsterLabels(monster: FiveEToolsMonster): string[] {
		const labels: string[] = [];
		if (Array.isArray(monster.group)) labels.push(...monster.group.filter(Boolean));
		if (typeof monster.type === 'string' && monster.type.trim()) labels.push(monster.type.trim());
		if (monster.level != null) labels.push(`nível ${monster.level}`);
		return this.uniqueStrings(labels);
	}

	private extractMetaSources(raw: unknown): FiveEToolsSource[] {
		if (!Array.isArray(raw)) return [];
		return raw.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) as FiveEToolsSource[];
	}

	private findOtherCollections(file: Record<string, unknown>): Array<{ key: string; count: number }> {
		return Object.entries(file)
			.filter(([key, value]) => key !== '_meta' && key !== 'monster' && key !== 'trap' && Array.isArray(value))
			.map(([key, value]) => ({ key, count: (value as unknown[]).length }))
			.sort((left, right) => left.key.localeCompare(right.key));
	}

	private getPrimarySource(file: FiveEToolsHomebrewFile): string {
		return file._meta.sources[0]?.json || 'Notion';
	}

	private upsertEntity<T extends FiveEToolsMonster | FiveEToolsTrap>(
		file: FiveEToolsHomebrewFile,
		type: FiveEToolsEntityType,
		entity: T,
	): FiveEToolsHomebrewFile {
		const nextFile = structuredClone(file);
		const collection = type === 'monster' ? (nextFile.monster ?? []) : (nextFile.trap ?? []);
		const index = collection.findIndex((item) => item.name === entity.name && item.source === entity.source);
		if (index >= 0) collection[index] = structuredClone(entity) as never;
		else collection.push(structuredClone(entity) as never);
		if (type === 'monster') nextFile.monster = collection as FiveEToolsMonster[];
		else nextFile.trap = collection as FiveEToolsTrap[];
		return this.touchFile(nextFile);
	}

	private applyImportEntity<T extends FiveEToolsMonster | FiveEToolsTrap>(
		file: FiveEToolsHomebrewFile,
		type: FiveEToolsEntityType,
		entity: T,
		resolution: FiveEToolsConflictResolution,
	): FiveEToolsHomebrewFile {
		if (resolution === 'cancel' || resolution === 'keep-existing') return file;
		if (resolution === 'duplicate') {
			const duplicate = {
				...structuredClone(entity),
				name:
					type === 'monster'
						? this.createUniqueEntityName(file.monster ?? [], entity.name, entity.source)
						: this.createUniqueEntityName(file.trap ?? [], entity.name, entity.source),
			};
			return this.upsertEntity(file, type, duplicate as T);
		}
		return this.upsertEntity(file, type, entity);
	}

	private mergeOtherCollections(file: FiveEToolsHomebrewFile, partial: Partial<FiveEToolsHomebrewFile>): FiveEToolsHomebrewFile {
		const nextFile = structuredClone(file) as Record<string, unknown>;
		for (const [key, value] of Object.entries(partial)) {
			if (key === '_meta' || key === 'monster' || key === 'trap') continue;
			if (!(Array.isArray(value) || !Object.prototype.hasOwnProperty.call(nextFile, key))) continue;
			if (!Object.prototype.hasOwnProperty.call(nextFile, key)) {
				nextFile[key] = structuredClone(value);
				continue;
			}
			if (Array.isArray(nextFile[key]) && Array.isArray(value)) {
				nextFile[key] = [...(nextFile[key] as unknown[]), ...structuredClone(value)];
			}
		}
		return nextFile as FiveEToolsHomebrewFile;
	}

	private mergeMetaSources(file: FiveEToolsHomebrewFile, meta: FiveEToolsMeta | undefined): FiveEToolsHomebrewFile {
		if (!meta?.sources?.length) return file;
		const seen = new Set(file._meta.sources.map((source) => source.json));
		const nextSources = [...file._meta.sources];
		for (const source of meta.sources) {
			if (seen.has(source.json)) continue;
			nextSources.push(source);
			seen.add(source.json);
		}
		return this.touchFile({
			...structuredClone(file),
			_meta: {
				...structuredClone(file._meta),
				sources: nextSources,
			},
		});
	}

	private touchFile(file: FiveEToolsHomebrewFile): FiveEToolsHomebrewFile {
		return {
			...structuredClone(file),
			_meta: {
				...structuredClone(file._meta),
				dateLastModified: this.nowUnix(),
			},
		};
	}

	private createEntityId(type: FiveEToolsEntityType, name: string, source: string): string {
		return `${type}::${source}::${name}`;
	}

	private createUniqueEntityName<T extends { name: string; source: string }>(collection: T[], baseName: string, source: string): string {
		const plainBaseName = baseName.replace(/\s+\(\d+\)$/, '').trim() || 'Novo Item';
		if (!collection.some((item) => item.name === plainBaseName && item.source === source)) return plainBaseName;
		let index = 1;
		let candidate = `${plainBaseName} (${index})`;
		while (collection.some((item) => item.name === candidate && item.source === source)) {
			index += 1;
			candidate = `${plainBaseName} (${index})`;
		}
		return candidate;
	}

	private isMonster(value: unknown): value is FiveEToolsMonster {
		return !!value && typeof value === 'object' && !Array.isArray(value) && typeof (value as FiveEToolsMonster).name === 'string' && typeof (value as FiveEToolsMonster).source === 'string' && (Object.prototype.hasOwnProperty.call(value, 'action') || Object.prototype.hasOwnProperty.call(value, 'trait') || Object.prototype.hasOwnProperty.call(value, 'spellcasting') || Object.prototype.hasOwnProperty.call(value, 'hp'));
	}

	private flattenEntry(entry: FiveEToolsEntry | undefined): string {
		if (typeof entry === 'string') return entry;
		if (!entry || typeof entry !== 'object') return '';
		const prefix = entry.name ? `${entry.name}: ` : '';
		const nested = Array.isArray(entry.entries) ? entry.entries.map((item) => this.flattenEntry(item)).filter(Boolean).join(' ') : '';
		return `${prefix}${nested}`.trim();
	}

	private extractSpellData(blocks: FiveEToolsSpellcastingBlock[]): {
		totalSpellSlots: SpellSlots | null;
		usedSpellSlots: SpellSlots | null;
		spells: SpellsByKey;
	} {
		const totalSpellSlots: SpellSlots = {};
		const usedSpellSlots: SpellSlots = {};
		const spells: SpellsByKey = {};
		let spellIndex = 0;

		for (const block of blocks) {
			for (const [levelKey, levelData] of Object.entries(block.spells ?? {})) {
				const slotKey = this.toSpellLevelKey(levelKey);
				if (slotKey && typeof levelData.slots === 'number') {
					totalSpellSlots[slotKey] = Math.max(0, Math.floor(levelData.slots));
					usedSpellSlots[slotKey] = 0;
				}
				for (const spellTag of levelData.spells ?? []) {
					const label = this.extractSpellLabel(spellTag);
					if (!label) continue;
					spellIndex += 1;
					spells[`spell-${spellIndex}`] = { label, total: 1 };
				}
			}
		}

		return {
			totalSpellSlots: Object.keys(totalSpellSlots).length ? totalSpellSlots : null,
			usedSpellSlots: Object.keys(usedSpellSlots).length ? usedSpellSlots : null,
			spells,
		};
	}

	private extractSpecialAbilitiesFromMonster(monster: FiveEToolsMonster): CreatureSpecialAbility[] {
		const features = [
			...(monster.trait ?? []).map((block) => ({ block, kind: 'trait' as const })),
			...(monster.action ?? []).map((block) => ({ block, kind: 'action' as const })),
			...(monster.bonus ?? []).map((block) => ({ block, kind: 'bonus' as const })),
			...(monster.reaction ?? []).map((block) => ({ block, kind: 'reaction' as const })),
			...(monster.legendary ?? []).map((block) => ({ block, kind: 'legendary' as const })),
		];

		return features
			.map(({ block }, index) => this.toSpecialAbility(block, index))
			.filter((ability): ability is CreatureSpecialAbility => ability !== null);
	}

	private toSpecialAbility(block: FiveEToolsMonsterFeatureBlock, index: number): CreatureSpecialAbility | null {
		const name = (block.name || '').trim();
		if (!name) return null;
		const recharge = name.match(/Recharge\s*(\d)\s*[\-\u2013]\s*(\d)/i);
		if (recharge) {
			const min = Math.max(1, Number(recharge[1] || 5));
			return {
				id: `5etools-ability-${index + 1}`,
				name,
				description: this.flattenEntries(block.entries),
				rechargeType: 'dice',
				rechargeDice: 'd6',
				rechargeOn: this.range(min, 6),
			};
		}

		const perDay = name.match(/(\d+)\s*\/\s*Day/i);
		if (perDay) {
			return {
				id: `5etools-ability-${index + 1}`,
				name,
				description: this.flattenEntries(block.entries),
				rechargeType: 'per-day',
				maxUses: Math.max(1, Number(perDay[1] || 1)),
			};
		}

		const perCombat = name.match(/(\d+)\s*\/\s*Combat/i);
		if (perCombat) {
			return {
				id: `5etools-ability-${index + 1}`,
				name,
				description: this.flattenEntries(block.entries),
				rechargeType: 'manual',
			};
		}

		return null;
	}

	private extractCreatureFeatures(monster: FiveEToolsMonster): CreatureFeature[] {
		const features: CreatureFeature[] = [];
		const push = (blocks: FiveEToolsMonsterFeatureBlock[] | undefined, kind: CreatureFeature['kind']) => {
			for (const [index, block] of (blocks ?? []).entries()) {
				if (!block.name?.trim()) continue;
				features.push({
					id: `${kind}-${index + 1}-${this.slugify(block.name)}`,
					name: block.name.trim(),
					description: this.flattenEntries(block.entries),
					kind,
				});
			}
		};
		push(monster.trait, 'trait');
		push(monster.action, 'action');
		push(monster.reaction, 'reaction');
		push(monster.legendary, 'legendary');
		for (const [index, block] of (monster.spellcasting ?? []).entries()) {
			features.push({
				id: `spellcasting-${index + 1}-${this.slugify(block.name || 'spellcasting')}`,
				name: block.name?.trim() || 'Spellcasting',
				description: [
					this.flattenEntries(block.headerEntries),
					this.describeSpellcastingLevels(block.spells),
					this.flattenEntries(block.footerEntries),
				]
					.filter(Boolean)
					.join('\n'),
				kind: 'spellcasting',
			});
		}
		return features;
	}

	private inferCreatureCategory(monster: FiveEToolsMonster): CreatureInterface['category'] {
		if (monster.type === 'object') return 'other';
		if (monster.level != null && monster.type === 'humanoid') return 'npc';
		return 'monster';
	}

	private dexMod(dex: number | undefined): number | null {
		if (dex == null || !Number.isFinite(dex)) return null;
		return Math.floor((dex - 10) / 2);
	}

	private getMonsterHpAverage(monster: FiveEToolsMonster): number {
		const hp = monster.hp?.average ?? 0;
		return Number.isFinite(hp) ? Math.max(0, Math.floor(hp)) : 0;
	}

	private getMonsterAcValue(monster: FiveEToolsMonster): number | string {
		const first = monster.ac?.[0];
		if (typeof first === 'number') return first;
		if (first && typeof first === 'object' && !Array.isArray(first)) {
			const ac = (first as any).ac;
			if (typeof ac === 'number') return ac;
		}
		return '';
	}

	private groupCreatureFeatures(features: CreatureFeature[]): {
		trait: FiveEToolsMonsterFeatureBlock[];
		action: FiveEToolsMonsterFeatureBlock[];
		bonus: FiveEToolsMonsterFeatureBlock[];
		reaction: FiveEToolsMonsterFeatureBlock[];
		legendary: FiveEToolsMonsterFeatureBlock[];
	} {
		const grouped = {
			trait: [] as FiveEToolsMonsterFeatureBlock[],
			action: [] as FiveEToolsMonsterFeatureBlock[],
			bonus: [] as FiveEToolsMonsterFeatureBlock[],
			reaction: [] as FiveEToolsMonsterFeatureBlock[],
			legendary: [] as FiveEToolsMonsterFeatureBlock[],
		};

		for (const feature of features) {
			const block: FiveEToolsMonsterFeatureBlock = {
				name: feature.name,
				entries: feature.description ? feature.description.split('\n').filter(Boolean) : [],
			};
			if (feature.kind === 'action') grouped.action.push(block);
			else if (feature.kind === 'reaction') grouped.reaction.push(block);
			else if (feature.kind === 'legendary') grouped.legendary.push(block);
			else grouped.trait.push(block);
		}

		return grouped;
	}

	private mergeFeatureBlocks(
		existing: FiveEToolsMonsterFeatureBlock[],
		featureBlocks: FiveEToolsMonsterFeatureBlock[],
		specialAbilities: CreatureSpecialAbility[],
	): FiveEToolsMonsterFeatureBlock[] {
		const next = [...featureBlocks];
		for (const ability of specialAbilities) {
			const block: FiveEToolsMonsterFeatureBlock = {
				name: this.toAbilityBlockName(ability),
				entries: ability.description ? ability.description.split('\n').filter(Boolean) : [],
			};
			next.push(block);
		}
		return next.length ? next : existing;
	}

	private toAbilityBlockName(ability: CreatureSpecialAbility): string {
		if (ability.rechargeType === 'dice') {
			const min = ability.rechargeOn?.length ? Math.min(...ability.rechargeOn) : 5;
			return `${ability.name} (Recharge ${min}\u20136)`;
		}
		if (ability.rechargeType === 'per-day' && ability.maxUses) {
			return `${ability.name} (${ability.maxUses}/Day)`;
		}
		return ability.name;
	}

	private createSpellcastingFromCreature(
		creature: CreatureInterface,
		existing: FiveEToolsSpellcastingBlock[],
	): FiveEToolsSpellcastingBlock[] {
		const headerBlocks = existing.filter((block) => !(block.spells && Object.keys(block.spells).length));
		const levels: Record<string, FiveEToolsSpellcastingLevelBlock> = {};
		for (const [key, spell] of Object.entries(creature.spells ?? {})) {
			const match = key.match(/(\d)(?:st|nd|rd|th)?$/i);
			void match;
			const spellTag = spell.label.startsWith('{@spell ') ? spell.label : this.toSpellTag(spell.label, 'XPHB');
			levels['0'] = levels['0'] ?? { spells: [] };
			levels['0'].spells = [...(levels['0'].spells ?? []), spellTag];
		}

		for (const slotKey of SPELL_LEVEL_KEYS) {
			const slots = creature.totalSpellSlots?.[slotKey];
			if (slots == null) continue;
			const level = String(SPELL_LEVEL_KEYS.indexOf(slotKey) + 1);
			levels[level] = levels[level] ?? { spells: [] };
			levels[level].slots = slots;
		}

		const spellBlocks = Object.keys(levels).length
			? [
					{
						name: 'Spellcasting',
						type: 'spellcasting',
						spells: levels,
					},
				]
			: [];
		return [...headerBlocks, ...spellBlocks];
	}

	private describeSpellcastingLevels(spells: Record<string, FiveEToolsSpellcastingLevelBlock> | undefined): string {
		if (!spells) return '';
		return Object.entries(spells)
			.sort((left, right) => Number(left[0]) - Number(right[0]))
			.map(([level, data]) => {
				const label = level === '0' ? 'Truques' : `${level}o nível`;
				const spellNames = (data.spells ?? []).map((spell) => this.extractSpellLabel(spell)).filter(Boolean);
				const slots = data.slots != null ? ` (${data.slots} slots)` : '';
				return `${label}${slots}: ${spellNames.join(', ')}`;
			})
			.filter(Boolean)
			.join('\n');
	}

	private extractSpellLabel(tag: string): string {
		const match = tag.match(/^\{@spell\s+([^|}]+)(?:\|[^}]+)?\}$/i);
		return match?.[1]?.trim() || tag.trim();
	}

	private toSpellLevelKey(level: string): SpellLevel | null {
		const index = Number(level);
		if (!Number.isFinite(index) || index < 1 || index > 9) return null;
		return SPELL_LEVEL_KEYS[index - 1];
	}

	private mergeArrays(base: string[] | undefined, incoming: string[] | undefined): string[] {
		return [...(base ?? []), ...(incoming ?? [])].filter(Boolean);
	}

	private getMonsterTypeLabel(monster: FiveEToolsMonster): string | null {
		if (typeof monster.type === 'string' && monster.type.trim()) return monster.type.trim();
		if (monster.type && typeof monster.type === 'object' && !Array.isArray(monster.type)) {
			const candidate = (monster.type as Record<string, unknown>)['type'];
			if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
		}
		return null;
	}

	private describeMonsterAc(monster: FiveEToolsMonster): string {
		if (!monster.ac?.length) return '-';
		return monster.ac
			.map((entry) => {
				if (typeof entry === 'number') return String(entry);
				if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
					const ac = (entry as Record<string, unknown>)['ac'];
					if (typeof ac === 'number') return String(ac);
				}
				return '?';
			})
			.join(', ');
	}

	private getFirstBlock(monster: FiveEToolsMonster): FiveEToolsMonsterFeatureBlock | null {
		return monster.trait?.[0] ?? monster.action?.[0] ?? monster.bonus?.[0] ?? monster.reaction?.[0] ?? monster.legendary?.[0] ?? null;
	}

	private buildMonsterSearchText(monster: FiveEToolsMonster): string {
		return [
			monster.name,
			monster.source,
			...(monster.alias ?? []),
			...(monster.group ?? []),
			this.getMonsterTypeLabel(monster) ?? '',
			monster.cr ?? '',
			...(monster.trait ?? []).map((block) => block.name ?? ''),
			...(monster.action ?? []).map((block) => block.name ?? ''),
			...(monster.bonus ?? []).map((block) => block.name ?? ''),
			...(monster.reaction ?? []).map((block) => block.name ?? ''),
			...(monster.legendary ?? []).map((block) => block.name ?? ''),
			this.flattenEntries(monster.trait?.flatMap((block) => block.entries ?? []) ?? []).slice(0, 220),
			this.flattenEntries(monster.action?.flatMap((block) => block.entries ?? []) ?? []).slice(0, 220),
		]
			.filter(Boolean)
			.join(' ');
	}

	private buildTrapSearchText(trap: FiveEToolsTrap): string {
		return [trap.name, trap.source, trap.trapHazType ?? '', this.flattenEntries(trap.entries)].filter(Boolean).join(' ');
	}

	private detectInitiativeHint(trap: FiveEToolsTrap): string | undefined {
		const text = this.flattenEntries(trap.entries).toLowerCase();
		if (text.includes('initiative count 20') || text.includes('initiative 20')) return 'Parece agir na iniciativa 20';
		return undefined;
	}

	private prettyAbility(value: string): string {
		const normalized = value.trim().toLowerCase();
		if (normalized === 'str') return 'Str';
		if (normalized === 'dex') return 'Dex';
		if (normalized === 'con') return 'Con';
		if (normalized === 'int') return 'Int';
		if (normalized === 'wis') return 'Wis';
		if (normalized === 'cha') return 'Cha';
		return value;
	}

	private renderAttackMode(value: string): string {
		const normalized = value.trim().toLowerCase();
		if (normalized === 'm') return 'Ataque corpo a corpo.';
		if (normalized === 'r') return 'Ataque a distancia.';
		if (normalized === 'mw') return 'Ataque corpo a corpo com arma.';
		if (normalized === 'rw') return 'Ataque a distancia com arma.';
		return value;
	}

	private compRows(rows: Array<[string, string, string]>): FiveEToolsConflictComparisonRow[] {
		return rows.map(([label, existing, incoming]) => ({
			label,
			existing,
			incoming,
			changed: existing !== incoming,
		}));
	}

	private uniqueStrings(values: string[]): string[] {
		return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
	}

	private range(start: number, end: number): number[] {
		const values: number[] = [];
		for (let current = start; current <= end; current += 1) values.push(current);
		return values;
	}

	private downloadJson(json: string, filename: string): void {
		const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = filename;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	private nowUnix(): number {
		return Math.floor(Date.now() / 1000);
	}

	private slugify(value: string): string {
		return value
			.trim()
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '');
	}

	private toOptionalNumber(value: unknown): number | undefined {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? Math.floor(numeric) : undefined;
	}

	private toNonNegativeInt(value: unknown): number {
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) return 0;
		return Math.max(0, Math.floor(numeric));
	}
	}
