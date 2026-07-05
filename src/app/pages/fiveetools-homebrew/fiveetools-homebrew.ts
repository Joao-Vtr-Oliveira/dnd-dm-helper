import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FiveEToolsHomebrewService } from '../../services/fiveetools-homebrew-service/fiveetools-homebrew-service';
import type {
	FiveEToolsConflictComparisonRow,
	FiveEToolsConflictResolution,
	FiveEToolsEntitySummary,
	FiveEToolsEntityType,
	FiveEToolsEntry,
	FiveEToolsEntryObject,
	FiveEToolsHomebrewFile,
	FiveEToolsHomebrewSummary,
	FiveEToolsImportPreview,
	FiveEToolsMonster,
	FiveEToolsMonsterFeatureBlock,
	FiveEToolsSpellcastingBlock,
	FiveEToolsTrap,
	FiveEToolsValidationIssue,
} from '../../models/fiveetools-homebrew-model';
import { LocalStorageService } from '../../services/local-storage-service/local-storage-service';

type EditorMode = 'monster' | 'trap' | null;
type EditorTab = 'visual' | 'preview' | 'json';
type CollectionTab = 'all' | 'monster' | 'trap' | 'extras';
type MonsterBlockSection = 'trait' | 'action' | 'bonus' | 'reaction' | 'legendary';
type PreviewState =
	| { type: 'monster'; monster: FiveEToolsMonster; summary: FiveEToolsEntitySummary }
	| { type: 'trap'; trap: FiveEToolsTrap; summary: FiveEToolsEntitySummary };
type TagHelperKind = 'spell' | 'damage' | 'condition' | 'dc' | 'hit' | 'dice' | 'save';

@Component({
	selector: 'app-fiveetools-homebrew',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './fiveetools-homebrew.html',
})
export class FiveEToolsHomebrewPage {
	private readonly fiveEToolsService = inject(FiveEToolsHomebrewService);
	private readonly localStorageService = inject(LocalStorageService);
	private readonly router = inject(Router);

	readonly loading = signal(true);
	readonly syncing = signal(false);
	readonly file = signal<FiveEToolsHomebrewFile | null>(null);
	readonly summary = computed<FiveEToolsHomebrewSummary | null>(() => {
		const file = this.file();
		return file ? this.fiveEToolsService.buildSummary(file) : null;
	});
	readonly search = signal('');
	readonly collectionTab = signal<CollectionTab>('all');
	readonly sourceFilter = signal('all');
	readonly groupFilter = signal('all');
	readonly creatureTypeFilter = signal('all');
	readonly crFilter = signal<'all' | '0-1' | '2-4' | '5-10' | '11+'>('all');
	readonly selectedEntityId = signal<string | null>(null);
	readonly editorMode = signal<EditorMode>(null);
	readonly editorTab = signal<EditorTab>('visual');
	readonly selectedMonster = signal<FiveEToolsMonster | null>(null);
	readonly selectedTrap = signal<FiveEToolsTrap | null>(null);
	readonly monsterJsonDraft = signal('');
	readonly trapJsonDraft = signal('');
	readonly previewModal = signal<PreviewState | null>(null);
	readonly toast = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
	readonly importOpen = signal(false);
	readonly importText = signal('');
	readonly importCoerceSource = signal(true);
	readonly importAddSourcesToMeta = signal(false);
	readonly importPreview = signal<FiveEToolsImportPreview | null>(null);
	readonly conflictResolutions = signal<Record<string, FiveEToolsConflictResolution>>({});
	readonly syncPreview = signal<{ file: FiveEToolsHomebrewFile; summary: FiveEToolsHomebrewSummary } | null>(null);
	readonly tagHelperKind = signal<TagHelperKind>('spell');
	readonly tagSpellName = signal('Fire Bolt');
	readonly tagSpellSource = signal('XPHB');
	readonly tagDamage = signal('3d8');
	readonly tagCondition = signal('Prone');
	readonly tagConditionSource = signal('XPHB');
	readonly tagDc = signal('15');
	readonly tagHit = signal('7');
	readonly tagDice = signal('d6');
	readonly tagSaveAbility = signal('dex');

	private toastTimer: number | null = null;

	readonly entitySummaries = computed(() => {
		const file = this.file();
		if (!file) return [];
		const query = this.normalize(this.search());
		const sourceFilter = this.sourceFilter();
		const groupFilter = this.groupFilter();
		const creatureTypeFilter = this.creatureTypeFilter();
		const crFilter = this.crFilter();

		return this.fiveEToolsService.listEntities(file).filter((entity) => {
			if (sourceFilter !== 'all' && entity.source !== sourceFilter) return false;
			if (groupFilter !== 'all' && !entity.groups.includes(groupFilter)) return false;
			if (entity.type === 'monster' && creatureTypeFilter !== 'all' && entity.creatureType !== creatureTypeFilter) return false;
			if (entity.type === 'monster' && crFilter !== 'all' && !this.matchesCrBand(entity.cr, crFilter)) return false;
			if (!query) return true;
			return this.normalize(entity.searchText ?? `${entity.name} ${entity.description}`).includes(query);
		});
	});

	readonly monsterSummaries = computed(() => this.entitySummaries().filter((entity) => entity.type === 'monster'));
	readonly trapSummaries = computed(() => this.entitySummaries().filter((entity) => entity.type === 'trap'));
	readonly resultCount = computed(() => this.entitySummaries().length);
	readonly currentMonsterWarnings = computed(() => {
		const monster = this.selectedMonster();
		const primarySource = this.summary()?.primarySource;
		return monster ? this.fiveEToolsService.validateMonster(monster, primarySource) : [];
	});
	readonly currentTrapWarnings = computed(() => {
		const trap = this.selectedTrap();
		const primarySource = this.summary()?.primarySource;
		return trap ? this.fiveEToolsService.validateTrap(trap, primarySource) : [];
	});
	readonly exportWarningCount = computed(() => {
		const file = this.file();
		const primarySource = this.summary()?.primarySource;
		if (!file) return 0;
		let count = 0;
		for (const monster of file.monster ?? []) count += this.fiveEToolsService.validateMonster(monster, primarySource).length;
		for (const trap of file.trap ?? []) count += this.fiveEToolsService.validateTrap(trap, primarySource).length;
		return count;
	});
	readonly generatedTag = computed(() => {
		const kind = this.tagHelperKind();
		if (kind === 'spell') return this.fiveEToolsService.toSpellTag(this.tagSpellName(), this.tagSpellSource());
		if (kind === 'damage') return this.fiveEToolsService.toDamageTag(this.tagDamage());
		if (kind === 'condition') return this.fiveEToolsService.toConditionTag(this.tagCondition(), this.tagConditionSource());
		if (kind === 'dc') return this.fiveEToolsService.toDcTag(Number(this.tagDc()) || 0);
		if (kind === 'hit') return this.fiveEToolsService.toHitTag(Number(this.tagHit()) || 0);
		if (kind === 'dice') return this.fiveEToolsService.toDiceTag(this.tagDice());
		return this.fiveEToolsService.toActSaveTag(this.tagSaveAbility());
	});

	readonly monsterSections: Array<{ key: MonsterBlockSection; label: string }> = [
		{ key: 'trait', label: 'Traits' },
		{ key: 'action', label: 'Actions' },
		{ key: 'bonus', label: 'Bonus Actions' },
		{ key: 'reaction', label: 'Reactions' },
		{ key: 'legendary', label: 'Legendary Actions' },
	];

	constructor() {
		void this.loadFile();
	}

	async loadFile() {
		this.loading.set(true);
		try {
			const file = await this.fiveEToolsService.loadLocalHomebrewJson();
			this.file.set(file);
		} catch (error) {
			const fallback = this.fiveEToolsService.createEmptyFile('Notion');
			this.file.set(fallback);
			this.showToast('warn', this.getErrorMessage(error, 'Nao foi possivel carregar o JSON 5etools remoto.'));
		} finally {
			this.loading.set(false);
		}
	}

	clearFilters() {
		this.search.set('');
		this.collectionTab.set('all');
		this.sourceFilter.set('all');
		this.groupFilter.set('all');
		this.creatureTypeFilter.set('all');
		this.crFilter.set('all');
	}

	setCollectionTab(tab: CollectionTab) {
		this.collectionTab.set(tab);
	}

	newMonster() {
		const primarySource = this.summary()?.primarySource || 'Notion';
		this.editorMode.set('monster');
		this.editorTab.set('visual');
		this.selectedEntityId.set(null);
		this.selectedTrap.set(null);
		const monster = this.fiveEToolsService.createEmptyMonster(primarySource);
		this.selectedMonster.set(monster);
		this.monsterJsonDraft.set(this.fiveEToolsService.formatJson(monster));
	}

	newTrap() {
		const primarySource = this.summary()?.primarySource || 'Notion';
		this.editorMode.set('trap');
		this.editorTab.set('visual');
		this.selectedEntityId.set(null);
		this.selectedMonster.set(null);
		const trap = this.fiveEToolsService.createEmptyTrap(primarySource);
		this.selectedTrap.set(trap);
		this.trapJsonDraft.set(this.fiveEToolsService.formatJson(trap));
	}

	editEntity(entity: FiveEToolsEntitySummary) {
		const file = this.file();
		if (!file) return;
		const selected = this.fiveEToolsService.getEntityById(file, entity.id);
		if (!selected) return;
		this.selectedEntityId.set(entity.id);
		this.editorTab.set('visual');
		if (entity.type === 'monster') {
			this.editorMode.set('monster');
			this.selectedTrap.set(null);
			const monster = structuredClone(selected as FiveEToolsMonster);
			this.selectedMonster.set(monster);
			this.monsterJsonDraft.set(this.fiveEToolsService.formatJson(monster));
			return;
		}
		this.editorMode.set('trap');
		this.selectedMonster.set(null);
		const trap = structuredClone(selected as FiveEToolsTrap);
		this.selectedTrap.set(trap);
		this.trapJsonDraft.set(this.fiveEToolsService.formatJson(trap));
	}

	openPreview(entity: FiveEToolsEntitySummary) {
		const file = this.file();
		if (!file) return;
		const selected = this.fiveEToolsService.getEntityById(file, entity.id);
		if (!selected) return;
		if (entity.type === 'monster') {
			this.previewModal.set({ type: 'monster', monster: structuredClone(selected as FiveEToolsMonster), summary: entity });
			return;
		}
		this.previewModal.set({ type: 'trap', trap: structuredClone(selected as FiveEToolsTrap), summary: entity });
	}

	closePreview() {
		this.previewModal.set(null);
	}

	previewEdit() {
		const preview = this.previewModal();
		if (!preview) return;
		this.editEntity(preview.summary);
		this.closePreview();
	}

	cancelEditor() {
		this.editorMode.set(null);
		this.selectedEntityId.set(null);
		this.selectedMonster.set(null);
		this.selectedTrap.set(null);
		this.monsterJsonDraft.set('');
		this.trapJsonDraft.set('');
	}

	setEditorTab(tab: EditorTab) {
		this.editorTab.set(tab);
	}

	saveMonster() {
		const file = this.file();
		const monster = this.selectedMonster();
		if (!file || !monster) return;
		if (!monster.name.trim()) {
			this.showToast('error', 'Informe um nome para o monster.');
			return;
		}
		this.fiveEToolsService.createBackup(file, `Antes de salvar monster: ${monster.name}`);
		const next = this.fiveEToolsService.upsertMonster(file, monster);
		this.file.set(this.fiveEToolsService.saveHomebrewFile(next));
		this.monsterJsonDraft.set(this.fiveEToolsService.formatJson(monster));
		this.showToast('success', 'Monster salvo no arquivo 5etools.');
	}

	saveTrap() {
		const file = this.file();
		const trap = this.selectedTrap();
		if (!file || !trap) return;
		if (!trap.name.trim()) {
			this.showToast('error', 'Informe um nome para a armadilha.');
			return;
		}
		this.fiveEToolsService.createBackup(file, `Antes de salvar trap: ${trap.name}`);
		const next = this.fiveEToolsService.upsertTrap(file, trap);
		this.file.set(this.fiveEToolsService.saveHomebrewFile(next));
		this.trapJsonDraft.set(this.fiveEToolsService.formatJson(trap));
		this.showToast('success', 'Trap salva no arquivo 5etools.');
	}

	applyMonsterJsonDraft() {
		try {
			const parsed = this.fiveEToolsService.parseJsonField(this.monsterJsonDraft(), this.selectedMonster() ?? {});
			const normalized = this.fiveEToolsService.parseHomebrewJson({
				_meta: { sources: [{ json: this.summary()?.primarySource || 'Notion', abbreviation: 'NT', full: this.summary()?.primarySource || 'Notion', version: '1.0.0' }] },
				monster: [parsed],
				trap: [],
			}).monster?.[0];
			if (normalized) this.selectedMonster.set(normalized);
			this.showToast('success', 'JSON avançado do monster aplicado.');
		} catch (error) {
			this.showToast('error', this.getErrorMessage(error, 'JSON avançado inválido para monster.'));
		}
	}

	applyTrapJsonDraft() {
		try {
			const parsed = this.fiveEToolsService.parseJsonField(this.trapJsonDraft(), this.selectedTrap() ?? {});
			const normalized = this.fiveEToolsService.parseHomebrewJson({
				_meta: { sources: [{ json: this.summary()?.primarySource || 'Notion', abbreviation: 'NT', full: this.summary()?.primarySource || 'Notion', version: '1.0.0' }] },
				monster: [],
				trap: [parsed],
			}).trap?.[0];
			if (normalized) this.selectedTrap.set(normalized);
			this.showToast('success', 'JSON avançado do trap aplicado.');
		} catch (error) {
			this.showToast('error', this.getErrorMessage(error, 'JSON avançado inválido para trap.'));
		}
	}

	duplicateEntity(entity: FiveEToolsEntitySummary) {
		const file = this.file();
		if (!file) return;
		this.fiveEToolsService.createBackup(file, `Antes de duplicar: ${entity.name}`);
		const next = this.fiveEToolsService.duplicateEntity(file, entity.id);
		this.file.set(this.fiveEToolsService.saveHomebrewFile(next));
		this.showToast('success', 'Entidade duplicada.');
	}

	removeEntity(entity: FiveEToolsEntitySummary) {
		const file = this.file();
		if (!file) return;
		if (!window.confirm(`Remover ${entity.name} do arquivo 5etools?`)) return;
		this.fiveEToolsService.createBackup(file, `Antes de remover: ${entity.name}`);
		const next = this.fiveEToolsService.deleteEntity(file, entity.type, entity.name, entity.source);
		this.file.set(this.fiveEToolsService.saveHomebrewFile(next));
		if (this.selectedEntityId() === entity.id) this.cancelEditor();
		this.showToast('success', 'Entidade removida.');
	}

	exportFull() {
		const file = this.file();
		if (!file) return;
		const warningCount = this.exportWarningCount();
		if (warningCount > 0 && !window.confirm(`Existem ${warningCount} avisos. Deseja exportar mesmo assim?`)) {
			return;
		}
		this.fiveEToolsService.downloadFullJson(file);
		this.showToast('success', 'JSON 5etools exportado.');
	}

	exportEntity(entity: FiveEToolsEntitySummary) {
		const file = this.file();
		if (!file) return;
		this.fiveEToolsService.downloadEntityJson(file, entity.id);
		this.showToast('success', 'Trecho exportado.');
	}

	async previewSync() {
		this.syncing.set(true);
		try {
			const remote = await this.fiveEToolsService.fetchRemoteHomebrewJson();
			this.syncPreview.set({ file: remote, summary: this.fiveEToolsService.buildSummary(remote) });
		} catch (error) {
			this.showToast('error', this.getErrorMessage(error, 'Erro ao sincronizar o JSON 5etools.'));
		} finally {
			this.syncing.set(false);
		}
	}

	confirmSync() {
		const preview = this.syncPreview();
		if (!preview) return;
		const current = this.file();
		if (current) this.fiveEToolsService.createBackup(current, 'Antes de sincronizar com GitHub');
		this.file.set(this.fiveEToolsService.saveHomebrewFile(preview.file));
		this.syncPreview.set(null);
		this.cancelEditor();
		this.showToast('success', 'JSON 5etools sincronizado.');
	}

	closeSyncPreview() {
		this.syncPreview.set(null);
	}

	openImport() {
		this.importOpen.set(true);
		this.importPreview.set(null);
		this.importText.set('');
		this.conflictResolutions.set({});
	}

	closeImport() {
		this.importOpen.set(false);
		this.importPreview.set(null);
		this.importText.set('');
		this.conflictResolutions.set({});
	}

	prepareImport() {
		const file = this.file();
		if (!file) return;
		let raw: unknown;
		try {
			raw = JSON.parse(this.importText());
		} catch {
			this.showToast('error', 'JSON inválido no trecho importado.');
			return;
		}

		try {
			const preview = this.fiveEToolsService.prepareImportPartialJson(file, raw, {
				coerceSourcesToPrimary: this.importCoerceSource(),
				addMissingSourcesToMeta: this.importAddSourcesToMeta(),
			});
			this.importPreview.set(preview);
			this.conflictResolutions.set(
				Object.fromEntries(preview.conflicts.map((conflict) => [conflict.id, conflict.resolution])),
			);
		} catch (error) {
			this.showToast('error', this.getErrorMessage(error, 'Não foi possível preparar o merge do trecho.'));
		}
	}

	applyImport() {
		const file = this.file();
		const preview = this.importPreview();
		if (!file || !preview) return;
		this.fiveEToolsService.createBackup(file, 'Antes de importar trecho 5etools');
		const next = this.fiveEToolsService.mergePartialJsonIntoFullFile(file, preview, this.conflictResolutions(), {
			addMissingSourcesToMeta: this.importAddSourcesToMeta(),
		});
		this.file.set(this.fiveEToolsService.saveHomebrewFile(next));
		this.closeImport();
		this.showToast('success', 'Trecho importado e mesclado ao arquivo 5etools.');
	}

	setConflictResolution(conflictId: string, resolution: FiveEToolsConflictResolution) {
		this.conflictResolutions.update((current) => ({ ...current, [conflictId]: resolution }));
	}

	createInternalSheet(entity: FiveEToolsEntitySummary) {
		const file = this.file();
		if (!file || entity.type !== 'monster') return;
		const monster = this.fiveEToolsService.getMonster(file, entity.name, entity.source);
		if (!monster) return;
		const sheet = this.fiveEToolsService.convertMonsterToSheet(monster);
		this.localStorageService.createSheet(sheet);
		this.showToast('success', 'Ficha interna criada a partir do monster 5etools.');
	}

	addEntityToEncounter(entity: FiveEToolsEntitySummary) {
		this.router.navigate(['/home/encounter-builder'], {
			state: {
				fiveEToolsImport: {
					entityId: entity.id,
				},
			},
		});
	}

	copyGeneratedTag() {
		const tag = this.generatedTag();
		if (!navigator.clipboard?.writeText) {
			window.prompt('Copie a tag:', tag);
			return;
		}
		void navigator.clipboard.writeText(tag);
		this.showToast('success', 'Tag copiada.');
	}

	appendGeneratedTagToMonsterEntry(section: MonsterBlockSection, blockIndex: number, entryIndex: number) {
		this.updateMonsterBlockEntry(section, blockIndex, entryIndex, `${this.getMonsterBlockEntry(section, blockIndex, entryIndex)} ${this.generatedTag()}`.trim());
	}

	appendGeneratedTagToTrapEntry(entryIndex: number) {
		const current = this.getTrapStringEntry(entryIndex);
		this.updateTrapEntryText(entryIndex, `${current} ${this.generatedTag()}`.trim());
	}

	appendGeneratedTagToTrapNestedEntry(entryIndex: number, childIndex: number) {
		const current = this.getTrapNestedEntryText(entryIndex, childIndex);
		this.updateTrapNestedEntry(entryIndex, childIndex, `${current} ${this.generatedTag()}`.trim());
	}

	appendGeneratedTagToSpellHeader(blockIndex: number, entryIndex: number) {
		const current = this.getSpellHeaderEntry(blockIndex, entryIndex);
		this.updateSpellHeaderEntry(blockIndex, entryIndex, `${current} ${this.generatedTag()}`.trim());
	}

	appendGeneratedTagToSpellFooter(blockIndex: number, entryIndex: number) {
		const current = this.getSpellFooterEntry(blockIndex, entryIndex);
		this.updateSpellFooterEntry(blockIndex, entryIndex, `${current} ${this.generatedTag()}`.trim());
	}

	appendGeneratedTagToSpellLevel(blockIndex: number, levelKey: string, spellIndex: number) {
		const current = this.getSpellLevelSpell(blockIndex, levelKey, spellIndex);
		this.updateSpellLevelSpell(blockIndex, levelKey, spellIndex, `${current} ${this.generatedTag()}`.trim());
	}

	setMonsterField(field: keyof FiveEToolsMonster, value: string) {
		this.updateMonster((monster) => ({ ...monster, [field]: value }));
	}

	setMonsterNumberField(field: keyof FiveEToolsMonster, value: unknown) {
		const numeric = Number(value);
		this.updateMonster((monster) => ({
			...monster,
			[field]: Number.isFinite(numeric) ? Math.floor(numeric) : undefined,
		}));
	}

	setMonsterStringArrayField(
		field: 'alias' | 'group' | 'size' | 'alignment' | 'senses' | 'languages',
		value: string,
	) {
		const items = value
			.split(/\n|,/) 
			.map((item) => item.trim())
			.filter(Boolean);
		this.updateMonster((monster) => ({ ...monster, [field]: items }));
	}

	setMonsterTypeField(value: string) {
		const text = value.trim();
		if (!text) {
			this.updateMonster((monster) => ({ ...monster, type: '' }));
			return;
		}
		try {
			const parsed = text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : text;
			this.updateMonster((monster) => ({ ...monster, type: parsed }));
		} catch {
			this.showToast('error', 'Campo type inválido. Use texto simples ou JSON válido.');
		}
	}

	setMonsterHpField(field: 'average' | 'formula', value: string) {
		this.updateMonster((monster) => {
			const hp = { ...(monster.hp ?? {}) };
			if (field === 'average') hp.average = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : undefined;
			else hp.formula = value.trim() || undefined;
			return { ...monster, hp };
		});
	}

	setMonsterJsonField(field: keyof FiveEToolsMonster, value: string, fallback: unknown) {
		try {
			const parsed = this.fiveEToolsService.parseJsonField(value, fallback);
			this.updateMonster((monster) => ({ ...monster, [field]: parsed }));
		} catch {
			this.showToast('error', `JSON inválido no campo ${String(field)}.`);
		}
	}

	setTrapField(field: keyof FiveEToolsTrap, value: string) {
		this.updateTrap((trap) => ({ ...trap, [field]: value }));
	}

	setTrapJsonField(field: keyof FiveEToolsTrap, value: string, fallback: unknown) {
		try {
			const parsed = this.fiveEToolsService.parseJsonField(value, fallback);
			this.updateTrap((trap) => ({ ...trap, [field]: parsed }));
		} catch {
			this.showToast('error', `JSON inválido no campo ${String(field)}.`);
		}
	}

	getMonsterBlocks(section: MonsterBlockSection): FiveEToolsMonsterFeatureBlock[] {
		return (this.selectedMonster()?.[section] as FiveEToolsMonsterFeatureBlock[] | undefined) ?? [];
	}

	addMonsterBlock(section: MonsterBlockSection) {
		this.updateMonster((monster) => ({
			...monster,
			[section]: [...this.getMonsterBlocks(section), { name: 'Novo bloco', entries: [''] }],
		}));
	}

	duplicateMonsterBlock(section: MonsterBlockSection, blockIndex: number) {
		const blocks = this.getMonsterBlocks(section);
		const duplicate = structuredClone(blocks[blockIndex]);
		if (!duplicate) return;
		const next = [...blocks];
		next.splice(blockIndex + 1, 0, duplicate);
		this.updateMonster((monster) => ({ ...monster, [section]: next }));
	}

	removeMonsterBlock(section: MonsterBlockSection, blockIndex: number) {
		const next = this.getMonsterBlocks(section).filter((_, index) => index !== blockIndex);
		this.updateMonster((monster) => ({ ...monster, [section]: next }));
	}

	moveMonsterBlock(section: MonsterBlockSection, blockIndex: number, direction: -1 | 1) {
		const next = [...this.getMonsterBlocks(section)];
		const targetIndex = blockIndex + direction;
		if (targetIndex < 0 || targetIndex >= next.length) return;
		const [block] = next.splice(blockIndex, 1);
		next.splice(targetIndex, 0, block);
		this.updateMonster((monster) => ({ ...monster, [section]: next }));
	}

	updateMonsterBlockName(section: MonsterBlockSection, blockIndex: number, value: string) {
		this.updateMonsterBlock(section, blockIndex, (block) => ({ ...block, name: value }));
	}

	monsterBlockHasAdvancedStructure(block: FiveEToolsMonsterFeatureBlock): boolean {
		const keys = Object.keys(block);
		const hasExtraKeys = keys.some((key) => !['name', 'entries'].includes(key));
		const hasComplexEntries = (block.entries ?? []).some((entry) => typeof entry !== 'string');
		return hasExtraKeys || hasComplexEntries;
	}

	getMonsterBlockEntry(section: MonsterBlockSection, blockIndex: number, entryIndex: number): string {
		const entry = this.getMonsterBlocks(section)[blockIndex]?.entries?.[entryIndex];
		return typeof entry === 'string' ? entry : '';
	}

	monsterBlockEntries(block: FiveEToolsMonsterFeatureBlock): string[] {
		return (block.entries ?? []).filter((entry): entry is string => typeof entry === 'string');
	}

	addMonsterBlockEntry(section: MonsterBlockSection, blockIndex: number) {
		this.updateMonsterBlock(section, blockIndex, (block) => ({ ...block, entries: [...(block.entries ?? []), ''] }));
	}

	setMonsterBlockEntriesText(section: MonsterBlockSection, blockIndex: number, value: string) {
		this.updateMonsterBlock(section, blockIndex, (block) => ({
			...block,
			entries: value
				.split('\n')
				.map((line) => line.trim())
				.filter(Boolean),
		}));
	}

	updateMonsterBlockEntry(section: MonsterBlockSection, blockIndex: number, entryIndex: number, value: string) {
		this.updateMonsterBlock(section, blockIndex, (block) => {
			const entries = [...(block.entries ?? [])];
			entries[entryIndex] = value;
			return { ...block, entries };
		});
	}

	removeMonsterBlockEntry(section: MonsterBlockSection, blockIndex: number, entryIndex: number) {
		this.updateMonsterBlock(section, blockIndex, (block) => ({
			...block,
			entries: (block.entries ?? []).filter((_, index) => index !== entryIndex),
		}));
	}

	moveMonsterBlockEntry(section: MonsterBlockSection, blockIndex: number, entryIndex: number, direction: -1 | 1) {
		this.updateMonsterBlock(section, blockIndex, (block) => {
			const entries = [...(block.entries ?? [])];
			const targetIndex = entryIndex + direction;
			if (targetIndex < 0 || targetIndex >= entries.length) return block;
			const [entry] = entries.splice(entryIndex, 1);
			entries.splice(targetIndex, 0, entry);
			return { ...block, entries };
		});
	}

	getSpellcastingBlocks(): FiveEToolsSpellcastingBlock[] {
		return this.selectedMonster()?.spellcasting ?? [];
	}

	addSpellcastingBlock() {
		this.updateMonster((monster) => ({
			...monster,
			spellcasting: [...(monster.spellcasting ?? []), { name: 'Spellcasting', type: 'spellcasting', headerEntries: [], spells: {} }],
		}));
	}

	duplicateSpellcastingBlock(blockIndex: number) {
		const blocks = this.getSpellcastingBlocks();
		const duplicate = structuredClone(blocks[blockIndex]);
		if (!duplicate) return;
		const next = [...blocks];
		next.splice(blockIndex + 1, 0, duplicate);
		this.updateMonster((monster) => ({ ...monster, spellcasting: next }));
	}

	removeSpellcastingBlock(blockIndex: number) {
		this.updateMonster((monster) => ({ ...monster, spellcasting: (monster.spellcasting ?? []).filter((_, index) => index !== blockIndex) }));
	}

	moveSpellcastingBlock(blockIndex: number, direction: -1 | 1) {
		const blocks = [...this.getSpellcastingBlocks()];
		const targetIndex = blockIndex + direction;
		if (targetIndex < 0 || targetIndex >= blocks.length) return;
		const [block] = blocks.splice(blockIndex, 1);
		blocks.splice(targetIndex, 0, block);
		this.updateMonster((monster) => ({ ...monster, spellcasting: blocks }));
	}

	spellcastingHasAdvancedStructure(block: FiveEToolsSpellcastingBlock): boolean {
		const keys = Object.keys(block);
		const hasExtraKeys = keys.some((key) => !['name', 'type', 'headerEntries', 'footerEntries', 'spells', 'displayAs'].includes(key));
		const hasComplexHeader = (block.headerEntries ?? []).some((entry) => typeof entry !== 'string');
		const hasComplexFooter = (block.footerEntries ?? []).some((entry) => typeof entry !== 'string');
		return hasExtraKeys || hasComplexHeader || hasComplexFooter;
	}

	updateSpellcastingName(blockIndex: number, value: string) {
		this.updateSpellcastingBlock(blockIndex, (block) => ({ ...block, name: value }));
	}

	updateSpellcastingType(blockIndex: number, value: string) {
		this.updateSpellcastingBlock(blockIndex, (block) => ({ ...block, type: value }));
	}

	setSpellHeaderText(blockIndex: number, value: string) {
		this.updateSpellcastingBlock(blockIndex, (block) => ({
			...block,
			headerEntries: value.split('\n').map((line) => line.trim()).filter(Boolean),
		}));
	}

	setSpellFooterText(blockIndex: number, value: string) {
		this.updateSpellcastingBlock(blockIndex, (block) => ({
			...block,
			footerEntries: value.split('\n').map((line) => line.trim()).filter(Boolean),
		}));
	}

	setSpellLevelsJson(blockIndex: number, value: string) {
		try {
			const parsed = this.fiveEToolsService.parseJsonField(value, {} as Record<string, unknown>);
			this.updateSpellcastingBlock(blockIndex, (block) => ({
				...block,
				spells: parsed as FiveEToolsSpellcastingBlock['spells'],
			}));
		} catch {
			this.showToast('error', 'JSON inválido na estrutura de níveis de spellcasting.');
		}
	}

	addSpellHeaderEntry(blockIndex: number) {
		this.updateSpellcastingBlock(blockIndex, (block) => ({ ...block, headerEntries: [...(block.headerEntries ?? []), ''] }));
	}

	getSpellHeaderEntry(blockIndex: number, entryIndex: number): string {
		const entry = this.getSpellcastingBlocks()[blockIndex]?.headerEntries?.[entryIndex];
		return typeof entry === 'string' ? entry : '';
	}

	updateSpellHeaderEntry(blockIndex: number, entryIndex: number, value: string) {
		this.updateSpellcastingBlock(blockIndex, (block) => ({
			...block,
			headerEntries: this.updateStringEntry(block.headerEntries, entryIndex, value),
		}));
	}

	removeSpellHeaderEntry(blockIndex: number, entryIndex: number) {
		this.updateSpellcastingBlock(blockIndex, (block) => ({
			...block,
			headerEntries: (block.headerEntries ?? []).filter((_, index) => index !== entryIndex),
		}));
	}

	addSpellFooterEntry(blockIndex: number) {
		this.updateSpellcastingBlock(blockIndex, (block) => ({ ...block, footerEntries: [...(block.footerEntries ?? []), ''] }));
	}

	getSpellFooterEntry(blockIndex: number, entryIndex: number): string {
		const entry = this.getSpellcastingBlocks()[blockIndex]?.footerEntries?.[entryIndex];
		return typeof entry === 'string' ? entry : '';
	}

	updateSpellFooterEntry(blockIndex: number, entryIndex: number, value: string) {
		this.updateSpellcastingBlock(blockIndex, (block) => ({
			...block,
			footerEntries: this.updateStringEntry(block.footerEntries, entryIndex, value),
		}));
	}

	removeSpellFooterEntry(blockIndex: number, entryIndex: number) {
		this.updateSpellcastingBlock(blockIndex, (block) => ({
			...block,
			footerEntries: (block.footerEntries ?? []).filter((_, index) => index !== entryIndex),
		}));
	}

	spellLevels(blockIndex: number): string[] {
		return Object.keys(this.getSpellcastingBlocks()[blockIndex]?.spells ?? {}).sort((left, right) => Number(left) - Number(right));
	}

	spellHeaderEntries(block: FiveEToolsSpellcastingBlock): string[] {
		return (block.headerEntries ?? []).filter((entry): entry is string => typeof entry === 'string');
	}

	spellFooterEntries(block: FiveEToolsSpellcastingBlock): string[] {
		return (block.footerEntries ?? []).filter((entry): entry is string => typeof entry === 'string');
	}

	spellLevelEntries(block: FiveEToolsSpellcastingBlock, levelKey: string): string[] {
		return block.spells?.[levelKey]?.spells ?? [];
	}

	addSpellLevel(blockIndex: number) {
		this.updateSpellcastingBlock(blockIndex, (block) => {
			const spells = { ...(block.spells ?? {}) };
			for (const key of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
				if (!spells[key]) {
					spells[key] = { spells: [], slots: key === '0' ? undefined : 1 };
					break;
				}
			}
			return { ...block, spells };
		});
	}

	removeSpellLevel(blockIndex: number, levelKey: string) {
		this.updateSpellcastingBlock(blockIndex, (block) => {
			const spells = { ...(block.spells ?? {}) };
			delete spells[levelKey];
			return { ...block, spells };
		});
	}

	setSpellLevelSlots(blockIndex: number, levelKey: string, value: unknown) {
		this.updateSpellcastingLevel(blockIndex, levelKey, (level) => ({
			...level,
			slots: Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : undefined,
		}));
	}

	addSpellToLevel(blockIndex: number, levelKey: string) {
		this.updateSpellcastingLevel(blockIndex, levelKey, (level) => ({ ...level, spells: [...(level.spells ?? []), ''] }));
	}

	getSpellLevelSpell(blockIndex: number, levelKey: string, spellIndex: number): string {
		return this.getSpellcastingBlocks()[blockIndex]?.spells?.[levelKey]?.spells?.[spellIndex] ?? '';
	}

	updateSpellLevelSpell(blockIndex: number, levelKey: string, spellIndex: number, value: string) {
		this.updateSpellcastingLevel(blockIndex, levelKey, (level) => ({
			...level,
			spells: this.updateStringEntry(level.spells, spellIndex, value),
		}));
	}

	removeSpellFromLevel(blockIndex: number, levelKey: string, spellIndex: number) {
		this.updateSpellcastingLevel(blockIndex, levelKey, (level) => ({
			...level,
			spells: (level.spells ?? []).filter((_, index) => index !== spellIndex),
		}));
	}

	getTrapEntries(): FiveEToolsEntry[] {
		return this.selectedTrap()?.entries ?? [];
	}

	addTrapTextEntry() {
		this.updateTrap((trap) => ({ ...trap, entries: [...trap.entries, ''] }));
	}

	addTrapEntriesBlock() {
		this.updateTrap((trap) => ({
			...trap,
			entries: [...trap.entries, { type: 'entries', name: 'Novo bloco', entries: [''] }],
		}));
	}

	moveTrapEntry(entryIndex: number, direction: -1 | 1) {
		const entries = [...this.getTrapEntries()];
		const targetIndex = entryIndex + direction;
		if (targetIndex < 0 || targetIndex >= entries.length) return;
		const [entry] = entries.splice(entryIndex, 1);
		entries.splice(targetIndex, 0, entry);
		this.updateTrap((trap) => ({ ...trap, entries }));
	}

	removeTrapEntry(entryIndex: number) {
		this.updateTrap((trap) => ({ ...trap, entries: trap.entries.filter((_, index) => index !== entryIndex) }));
	}

	isTrapTextEntry(entry: FiveEToolsEntry): boolean {
		return typeof entry === 'string';
	}

	isTrapEntriesBlock(entry: FiveEToolsEntry): entry is FiveEToolsEntryObject {
		return !!entry && typeof entry === 'object' && !Array.isArray(entry) && entry.type === 'entries' && Array.isArray(entry.entries);
	}

	trapEntryHasAdvancedStructure(entry: FiveEToolsEntry): boolean {
		if (typeof entry === 'string') return false;
		if (!this.isTrapEntriesBlock(entry)) return true;
		const keys = Object.keys(entry);
		const hasExtraKeys = keys.some((key) => !['type', 'name', 'entries'].includes(key));
		const hasComplexEntries = (entry.entries ?? []).some((item) => typeof item !== 'string');
		return hasExtraKeys || hasComplexEntries;
	}

	getTrapStringEntry(entryIndex: number): string {
		const entry = this.getTrapEntries()[entryIndex];
		return typeof entry === 'string' ? entry : '';
	}

	updateTrapEntryText(entryIndex: number, value: string) {
		const entries = [...this.getTrapEntries()];
		entries[entryIndex] = value;
		this.updateTrap((trap) => ({ ...trap, entries }));
	}

	updateTrapEntriesBlockName(entryIndex: number, value: string) {
		const entry = this.getTrapEntries()[entryIndex];
		if (!this.isTrapEntriesBlock(entry)) return;
		this.updateTrapEntryObject(entryIndex, { ...entry, name: value });
	}

	addTrapNestedEntry(entryIndex: number) {
		const entry = this.getTrapEntries()[entryIndex];
		if (!this.isTrapEntriesBlock(entry)) return;
		this.updateTrapEntryObject(entryIndex, { ...entry, entries: [...(entry.entries ?? []), ''] });
	}

	setTrapEntriesBlockText(entryIndex: number, value: string) {
		const entry = this.getTrapEntries()[entryIndex];
		if (!this.isTrapEntriesBlock(entry)) return;
		this.updateTrapEntryObject(entryIndex, {
			...entry,
			entries: value
				.split('\n')
				.map((line) => line.trim())
				.filter(Boolean),
		});
	}

	getTrapNestedEntryText(entryIndex: number, childIndex: number): string {
		const entry = this.getTrapEntries()[entryIndex];
		if (!this.isTrapEntriesBlock(entry)) return '';
		const child = entry.entries?.[childIndex];
		return typeof child === 'string' ? child : '';
	}

	updateTrapNestedEntry(entryIndex: number, childIndex: number, value: string) {
		const entry = this.getTrapEntries()[entryIndex];
		if (!this.isTrapEntriesBlock(entry)) return;
		const entries = [...(entry.entries ?? [])];
		entries[childIndex] = value;
		this.updateTrapEntryObject(entryIndex, { ...entry, entries });
	}

	removeTrapNestedEntry(entryIndex: number, childIndex: number) {
		const entry = this.getTrapEntries()[entryIndex];
		if (!this.isTrapEntriesBlock(entry)) return;
		this.updateTrapEntryObject(entryIndex, {
			...entry,
			entries: (entry.entries ?? []).filter((_, index) => index !== childIndex),
		});
	}

	moveTrapNestedEntry(entryIndex: number, childIndex: number, direction: -1 | 1) {
		const entry = this.getTrapEntries()[entryIndex];
		if (!this.isTrapEntriesBlock(entry)) return;
		const entries = [...(entry.entries ?? [])];
		const targetIndex = childIndex + direction;
		if (targetIndex < 0 || targetIndex >= entries.length) return;
		const [child] = entries.splice(childIndex, 1);
		entries.splice(targetIndex, 0, child);
		this.updateTrapEntryObject(entryIndex, { ...entry, entries });
	}

	monsterSectionPreview(section: MonsterBlockSection): Array<{ title: string; lines: string[] }> {
		return this.getMonsterBlocks(section).map((block) => ({
			title: block.name?.trim() || 'Bloco sem nome',
			lines: this.fiveEToolsService.renderEntries(block.entries),
		}));
	}

	monsterSpellPreview(): Array<{ title: string; lines: string[] }> {
		return this.getSpellcastingBlocks().map((block) => ({
			title: block.name?.trim() || 'Spellcasting',
			lines: [
				...this.fiveEToolsService.renderEntries(block.headerEntries),
				...this.renderSpellLevelLines(block),
				...this.fiveEToolsService.renderEntries(block.footerEntries),
			],
		}));
	}

	trapPreviewLines(trap: FiveEToolsTrap): Array<{ title?: string; lines: string[] }> {
		return trap.entries.map((entry) => {
			if (typeof entry === 'string') return { lines: [this.fiveEToolsService.renderText(entry)] };
			return {
				title: entry.name?.trim() || undefined,
				lines: this.fiveEToolsService.renderEntries(entry.entries),
			};
		});
	}

	previewTrapLines(preview: PreviewState): Array<{ title?: string; lines: string[] }> {
		return preview.type === 'trap' ? this.trapPreviewLines(preview.trap) : [];
	}

	previewWarningsForModal(preview: PreviewState): FiveEToolsValidationIssue[] {
		const primarySource = this.summary()?.primarySource;
		return preview.type === 'monster'
			? this.fiveEToolsService.validateMonster(preview.monster, primarySource)
			: this.fiveEToolsService.validateTrap(preview.trap, primarySource);
	}

	conflictComparison(conflictId: string): FiveEToolsConflictComparisonRow[] {
		const file = this.file();
		const preview = this.importPreview();
		if (!file || !preview) return [];
		const conflict = preview.conflicts.find((item) => item.id === conflictId);
		if (!conflict) return [];
		const incoming =
			conflict.type === 'monster'
				? preview.partial.monster?.find((item) => item.name === conflict.name && item.source === conflict.source)
				: preview.partial.trap?.find((item) => item.name === conflict.name && item.source === conflict.source);
		if (!incoming) return [];
		return this.fiveEToolsService.buildConflictComparison(file, incoming, conflict.type);
	}

	formatDate(value: number | null | undefined): string {
		if (typeof value !== 'number') return 'Não informado';
		return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value * 1000));
	}

	formatJson(value: unknown): string {
		return this.fiveEToolsService.formatJson(value);
	}

	renderText(value: string): string {
		return this.fiveEToolsService.renderText(value);
	}

	entityTypeLabel(value: FiveEToolsEntityType): string {
		return value === 'monster' ? 'Monster' : 'Trap';
	}

	collectionTabLabel(value: CollectionTab): string {
		if (value === 'all') return 'Todos';
		if (value === 'monster') return 'Monstros';
		if (value === 'trap') return 'Traps/Hazards';
		return 'Outros';
	}

	editorTabLabel(value: EditorTab): string {
		if (value === 'visual') return 'Editor';
		if (value === 'preview') return 'Preview';
		return 'JSON avançado';
	}

	private updateMonster(updater: (monster: FiveEToolsMonster) => FiveEToolsMonster) {
		this.selectedMonster.update((monster) => {
			if (!monster) return monster;
			const next = updater(monster);
			this.monsterJsonDraft.set(this.fiveEToolsService.formatJson(next));
			return next;
		});
	}

	private updateTrap(updater: (trap: FiveEToolsTrap) => FiveEToolsTrap) {
		this.selectedTrap.update((trap) => {
			if (!trap) return trap;
			const next = updater(trap);
			this.trapJsonDraft.set(this.fiveEToolsService.formatJson(next));
			return next;
		});
	}

	private updateMonsterBlock(section: MonsterBlockSection, blockIndex: number, updater: (block: FiveEToolsMonsterFeatureBlock) => FiveEToolsMonsterFeatureBlock) {
		this.updateMonster((monster) => {
			const blocks = [...this.getMonsterBlocks(section)];
			const current = blocks[blockIndex];
			if (!current) return monster;
			blocks[blockIndex] = updater(current);
			return { ...monster, [section]: blocks };
		});
	}

	private updateSpellcastingBlock(blockIndex: number, updater: (block: FiveEToolsSpellcastingBlock) => FiveEToolsSpellcastingBlock) {
		this.updateMonster((monster) => {
			const blocks = [...(monster.spellcasting ?? [])];
			const current = blocks[blockIndex];
			if (!current) return monster;
			blocks[blockIndex] = updater(current);
			return { ...monster, spellcasting: blocks };
		});
	}

	private updateSpellcastingLevel(blockIndex: number, levelKey: string, updater: (level: NonNullable<FiveEToolsSpellcastingBlock['spells']>[string]) => NonNullable<FiveEToolsSpellcastingBlock['spells']>[string]) {
		this.updateSpellcastingBlock(blockIndex, (block) => {
			const spells = { ...(block.spells ?? {}) };
			const current = spells[levelKey] ?? { spells: [] };
			spells[levelKey] = updater(current);
			return { ...block, spells };
		});
	}

	updateTrapEntryObject(entryIndex: number, nextEntry: FiveEToolsEntryObject) {
		this.updateTrap((trap) => {
			const entries = [...trap.entries];
			entries[entryIndex] = nextEntry;
			return { ...trap, entries };
		});
	}

	private updateStringEntry(entries: Array<string | FiveEToolsEntry> | undefined, index: number, value: string): string[] {
		const next = [...(entries ?? [])];
		next[index] = value;
		return next.map((entry) => (typeof entry === 'string' ? entry : this.fiveEToolsService.renderEntries([entry]).join(' ')));
	}

	private renderSpellLevelLines(block: FiveEToolsSpellcastingBlock): string[] {
		return Object.entries(block.spells ?? {})
			.sort((left, right) => Number(left[0]) - Number(right[0]))
			.flatMap(([level, data]) => {
				const levelLabel = level === '0' ? 'Cantrips' : `${level}º nível${data.slots != null ? ` (${data.slots} slots)` : ''}`;
				return [`${levelLabel}:`, ...(data.spells ?? []).map((spell) => this.fiveEToolsService.renderText(spell))];
			});
	}

	private matchesCrBand(cr: string | undefined, band: '0-1' | '2-4' | '5-10' | '11+'): boolean {
		if (!cr) return band === '0-1';
		const normalized = cr.includes('/') ? this.parseFraction(cr) : Number(cr);
		if (!Number.isFinite(normalized)) return true;
		if (band === '0-1') return normalized <= 1;
		if (band === '2-4') return normalized >= 2 && normalized <= 4;
		if (band === '5-10') return normalized >= 5 && normalized <= 10;
		return normalized >= 11;
	}

	private parseFraction(value: string): number {
		const [left, right] = value.split('/').map((part) => Number(part.trim()));
		if (!Number.isFinite(left) || !Number.isFinite(right) || right === 0) return Number.NaN;
		return left / right;
	}

	private normalize(value: string): string {
		return (value || '').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
	}

	private getErrorMessage(error: unknown, fallback: string): string {
		return error instanceof Error && error.message ? error.message : fallback;
	}

	private showToast(type: 'success' | 'error' | 'warn', text: string, ms = 2800) {
		if (this.toastTimer) window.clearTimeout(this.toastTimer);
		this.toast.set({ type, text });
		this.toastTimer = window.setTimeout(() => this.toast.set(null), ms);
	}
}
