import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FiveEToolsEntityCardComponent } from './components/fiveetools-entity-card/fiveetools-entity-card';
import { FiveEToolsEntryReferencePickerComponent } from './components/fiveetools-entry-reference-picker/fiveetools-entry-reference-picker';
import { FiveEToolsFiltersComponent } from './components/fiveetools-filters/fiveetools-filters';
import { FiveEToolsPreviewModalComponent } from './components/fiveetools-preview-modal/fiveetools-preview-modal';
import { FiveEToolsSpellReferencePickerComponent } from './components/fiveetools-spell-reference-picker/fiveetools-spell-reference-picker';
import { FiveEToolsSummaryCardsComponent } from './components/fiveetools-summary-cards/fiveetools-summary-cards';
import { FiveEToolsTagHelperComponent } from './components/fiveetools-tag-helper/fiveetools-tag-helper';
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
	FiveEToolsCompositionPackage,
	FiveEToolsLegendaryGroup,
	FiveEToolsMonster,
	FiveEToolsMonsterFeatureBlock,
	FiveEToolsMonsterTemplate,
	FiveEToolsSpellcastingBlock,
	FiveEToolsTrap,
	FiveEToolsValidationIssue,
} from '../../models/fiveetools-homebrew-model';
import { LocalStorageService } from '../../services/local-storage-service/local-storage-service';
import type {
	FiveEToolsReferenceImportable,
	FiveEToolsReferenceSpell,
} from '../../services/fiveetools-reference-data-service/fiveetools-reference-data-service';

type EditorMode = 'monster' | 'trap' | null;
type EditorTab = 'basic' | 'blocks' | 'spellcasting' | 'preview' | 'json';
type CollectionTab = 'all' | 'monster' | 'trap' | 'extras';
type MonsterBlockSection = 'trait' | 'action' | 'bonus' | 'reaction' | 'legendary';
type ExtraCollectionKey = 'monsterTemplate' | 'legendaryGroup';
type EditingEntityRef = {
	type: 'monster' | 'trap';
	originalName: string;
	originalSource: string;
};
type EditingExtraRef = {
	collection: ExtraCollectionKey;
	originalName: string;
	originalSource: string;
};
type PreviewState =
	| { type: 'monster'; monster: FiveEToolsMonster; summary: FiveEToolsEntitySummary }
	| { type: 'trap'; trap: FiveEToolsTrap; summary: FiveEToolsEntitySummary };
type TagHelperKind = 'spell' | 'damage' | 'condition' | 'dc' | 'hit' | 'dice' | 'save';
type ConfirmModalState =
	| {
			action: 'remove-entity';
			title: string;
			description: string;
			confirmLabel: string;
			tone: 'danger';
			entity: FiveEToolsEntitySummary;
	  }
	| {
			action: 'export-with-warnings';
			title: string;
			description: string;
			confirmLabel: string;
			tone: 'warning';
			warningCount: number;
	  };

type MonsterSkillKey =
	| 'acrobatics'
	| 'animal handling'
	| 'arcana'
	| 'athletics'
	| 'deception'
	| 'history'
	| 'insight'
	| 'intimidation'
	| 'investigation'
	| 'medicine'
	| 'nature'
	| 'perception'
	| 'performance'
	| 'persuasion'
	| 'religion'
	| 'sleight of hand'
	| 'stealth'
	| 'survival';

type ReferencePickerState = {
	kind: 'action' | 'optionalfeature' | 'feat' | 'item' | 'condition' | 'status';
	section: MonsterBlockSection;
};

type LanguagePickerState = {
	targetField: 'languages';
};

type TagInsertionTarget =
	| { kind: 'monster-entry'; section: MonsterBlockSection; blockIndex: number; entryIndex: number }
	| {
			kind: 'monster-nested-entry';
			section: MonsterBlockSection;
			blockIndex: number;
			entryIndex: number;
			childIndex: number;
	  }
	| { kind: 'trap-entry'; entryIndex: number }
	| { kind: 'trap-nested-entry'; entryIndex: number; childIndex: number }
	| { kind: 'spell-header'; blockIndex: number; entryIndex: number }
	| { kind: 'spell-footer'; blockIndex: number; entryIndex: number };

@Component({
	selector: 'app-fiveetools-homebrew',
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		FiveEToolsEntityCardComponent,
		FiveEToolsEntryReferencePickerComponent,
		FiveEToolsFiltersComponent,
		FiveEToolsPreviewModalComponent,
		FiveEToolsSpellReferencePickerComponent,
		FiveEToolsSummaryCardsComponent,
		FiveEToolsTagHelperComponent,
	],
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
	readonly advancedFiltersOpen = signal(false);
	readonly newItemMenuOpen = signal(false);
	readonly selectedEntityId = signal<string | null>(null);
	readonly editingEntityRef = signal<EditingEntityRef | null>(null);
	readonly editorMode = signal<EditorMode>(null);
	readonly editorTab = signal<EditorTab>('basic');
	readonly editorTagHelperOpen = signal(false);
	readonly selectedMonster = signal<FiveEToolsMonster | null>(null);
	readonly selectedTrap = signal<FiveEToolsTrap | null>(null);
	readonly extraEditorCollection = signal<ExtraCollectionKey | null>(null);
	readonly editingExtraRef = signal<EditingExtraRef | null>(null);
	readonly extraJsonDraft = signal('');
	readonly monsterJsonDraft = signal('');
	readonly trapJsonDraft = signal('');
	readonly compositionPackages = signal<FiveEToolsCompositionPackage[]>([]);
	readonly previewModal = signal<PreviewState | null>(null);
	readonly spellPickerState = signal<{ blockIndex: number; levelKey: string } | null>(null);
	readonly referencePickerState = signal<ReferencePickerState | null>(null);
	readonly languagePickerState = signal<LanguagePickerState | null>(null);
	readonly tagInsertionTarget = signal<TagInsertionTarget | null>(null);
	readonly confirmModal = signal<ConfirmModalState | null>(null);
	readonly copyTagFallback = signal<string | null>(null);
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
	readonly monsterTemplates = computed(() => {
		const file = this.file();
		return file ? this.fiveEToolsService.listMonsterTemplates(file) : [];
	});
	readonly legendaryGroups = computed(() => {
		const file = this.file();
		return file ? this.fiveEToolsService.listLegendaryGroups(file) : [];
	});
	readonly extrasCount = computed(() => {
		const summary = this.summary();
		return (summary?.otherCollections.reduce((count, collection) => count + collection.count, 0) ?? 0) + this.compositionPackages().length;
	});
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

	readonly monsterEditorTabs: EditorTab[] = ['basic', 'blocks', 'spellcasting', 'preview', 'json'];
	readonly trapEditorTabs: EditorTab[] = ['basic', 'blocks', 'preview', 'json'];
	readonly abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
	readonly monsterSkillOptions: Array<{ key: MonsterSkillKey; label: string }> = [
		{ key: 'acrobatics', label: 'Acrobatics' },
		{ key: 'animal handling', label: 'Animal Handling' },
		{ key: 'arcana', label: 'Arcana' },
		{ key: 'athletics', label: 'Athletics' },
		{ key: 'deception', label: 'Deception' },
		{ key: 'history', label: 'History' },
		{ key: 'insight', label: 'Insight' },
		{ key: 'intimidation', label: 'Intimidation' },
		{ key: 'investigation', label: 'Investigation' },
		{ key: 'medicine', label: 'Medicine' },
		{ key: 'nature', label: 'Nature' },
		{ key: 'perception', label: 'Perception' },
		{ key: 'performance', label: 'Performance' },
		{ key: 'persuasion', label: 'Persuasion' },
		{ key: 'religion', label: 'Religion' },
		{ key: 'sleight of hand', label: 'Sleight of Hand' },
		{ key: 'stealth', label: 'Stealth' },
		{ key: 'survival', label: 'Survival' },
	];

	constructor() {
		this.refreshCompositionPackages();
		void this.loadFile();
	}

	@HostListener('window:keydown.escape')
	onEscape() {
		if (this.previewModal()) return this.closePreview();
		if (this.spellPickerState()) return this.closeSpellPicker();
		if (this.referencePickerState()) return this.closeReferencePicker();
		if (this.languagePickerState()) return this.closeLanguagePicker();
		if (this.copyTagFallback()) return this.closeCopyTagFallback();
		if (this.confirmModal()) return this.closeConfirmModal();
		if (this.syncPreview()) return this.closeSyncPreview();
		if (this.importOpen()) return this.closeImport();
		if (this.editorTagHelperOpen()) return this.closeTagHelper();
		if (this.newItemMenuOpen()) return this.closeNewItemMenu();
		if (this.editorMode()) this.cancelEditor();
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
		this.advancedFiltersOpen.set(false);
	}

	setCollectionTab(tab: CollectionTab) {
		this.collectionTab.set(tab);
	}

	toggleAdvancedFilters() {
		this.advancedFiltersOpen.update((open) => !open);
	}

	toggleNewItemMenu() {
		this.newItemMenuOpen.update((open) => !open);
	}

	closeNewItemMenu() {
		this.newItemMenuOpen.set(false);
	}

	toggleEditorTagHelper() {
		this.editorTagHelperOpen.update((open) => !open);
	}

	newMonster() {
		const primarySource = this.summary()?.primarySource || 'Notion';
		this.closeNewItemMenu();
		this.cancelExtraEditor();
		this.editorMode.set('monster');
		this.editorTab.set('basic');
		this.editorTagHelperOpen.set(false);
		this.selectedEntityId.set(null);
		this.editingEntityRef.set(null);
		this.selectedTrap.set(null);
		const monster = this.fiveEToolsService.createEmptyMonster(primarySource);
		this.selectedMonster.set(monster);
		this.monsterJsonDraft.set(this.fiveEToolsService.formatJson(monster));
	}

	newTrap() {
		const primarySource = this.summary()?.primarySource || 'Notion';
		this.closeNewItemMenu();
		this.cancelExtraEditor();
		this.editorMode.set('trap');
		this.editorTab.set('basic');
		this.editorTagHelperOpen.set(false);
		this.selectedEntityId.set(null);
		this.editingEntityRef.set(null);
		this.selectedMonster.set(null);
		const trap = this.fiveEToolsService.createEmptyTrap(primarySource);
		this.selectedTrap.set(trap);
		this.trapJsonDraft.set(this.fiveEToolsService.formatJson(trap));
	}

	newMonsterTemplate() {
		const primarySource = this.summary()?.primarySource || 'Notion';
		this.closeNewItemMenu();
		this.collectionTab.set('extras');
		this.extraEditorCollection.set('monsterTemplate');
		this.editingExtraRef.set(null);
		this.extraJsonDraft.set(this.fiveEToolsService.formatJson(this.fiveEToolsService.createEmptyMonsterTemplate(primarySource)));
	}

	newLegendaryGroup() {
		const primarySource = this.summary()?.primarySource || 'Notion';
		this.closeNewItemMenu();
		this.collectionTab.set('extras');
		this.extraEditorCollection.set('legendaryGroup');
		this.editingExtraRef.set(null);
		this.extraJsonDraft.set(this.fiveEToolsService.formatJson(this.fiveEToolsService.createEmptyLegendaryGroup(primarySource)));
	}

	editEntity(entity: FiveEToolsEntitySummary) {
		const file = this.file();
		if (!file) return;
		this.closeNewItemMenu();
		this.cancelExtraEditor();
		this.editorTagHelperOpen.set(false);
		const selected = this.fiveEToolsService.getEntityById(file, entity.id);
		if (!selected) return;
		this.selectedEntityId.set(entity.id);
		this.editingEntityRef.set({
			type: entity.type,
			originalName: entity.name,
			originalSource: entity.source,
		});
		this.editorTab.set('basic');
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
		this.editorTagHelperOpen.set(false);
		this.tagInsertionTarget.set(null);
		this.referencePickerState.set(null);
		this.languagePickerState.set(null);
		this.spellPickerState.set(null);
		this.selectedEntityId.set(null);
		this.editingEntityRef.set(null);
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

		try {
			this.fiveEToolsService.createBackup(file, `Antes de salvar monster: ${monster.name}`);
			const next = this.fiveEToolsService.upsertMonster(file, monster, {
				matchBy:
					this.editingEntityRef()?.type === 'monster'
						? {
							name: this.editingEntityRef()!.originalName,
							source: this.editingEntityRef()!.originalSource,
						}
						: undefined,
			});
			this.file.set(this.fiveEToolsService.saveHomebrewFile(next));
			this.monsterJsonDraft.set(this.fiveEToolsService.formatJson(monster));
			this.selectedEntityId.set(this.buildEntityId('monster', monster.name, monster.source));
			this.editingEntityRef.set({
				type: 'monster',
				originalName: monster.name,
				originalSource: monster.source,
			});
			this.showToast('success', 'Monster salvo no arquivo 5etools.');
		} catch (error) {
			this.showToast('error', this.getErrorMessage(error, 'Nao foi possivel salvar o monster.'));
		}
	}

	saveTrap() {
		const file = this.file();
		const trap = this.selectedTrap();
		if (!file || !trap) return;
		if (!trap.name.trim()) {
			this.showToast('error', 'Informe um nome para a armadilha.');
			return;
		}

		try {
			this.fiveEToolsService.createBackup(file, `Antes de salvar trap: ${trap.name}`);
			const next = this.fiveEToolsService.upsertTrap(file, trap, {
				matchBy:
					this.editingEntityRef()?.type === 'trap'
						? {
							name: this.editingEntityRef()!.originalName,
							source: this.editingEntityRef()!.originalSource,
						}
						: undefined,
			});
			this.file.set(this.fiveEToolsService.saveHomebrewFile(next));
			this.trapJsonDraft.set(this.fiveEToolsService.formatJson(trap));
			this.selectedEntityId.set(this.buildEntityId('trap', trap.name, trap.source));
			this.editingEntityRef.set({
				type: 'trap',
				originalName: trap.name,
				originalSource: trap.source,
			});
			this.showToast('success', 'Trap salva no arquivo 5etools.');
		} catch (error) {
			this.showToast('error', this.getErrorMessage(error, 'Nao foi possivel salvar a trap.'));
		}
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

	editMonsterTemplate(template: FiveEToolsMonsterTemplate) {
		this.collectionTab.set('extras');
		this.extraEditorCollection.set('monsterTemplate');
		this.editingExtraRef.set({
			collection: 'monsterTemplate',
			originalName: template.name,
			originalSource: template.source,
		});
		this.extraJsonDraft.set(this.fiveEToolsService.formatJson(template));
	}

	editLegendaryGroup(group: FiveEToolsLegendaryGroup) {
		this.collectionTab.set('extras');
		this.extraEditorCollection.set('legendaryGroup');
		this.editingExtraRef.set({
			collection: 'legendaryGroup',
			originalName: group.name,
			originalSource: group.source,
		});
		this.extraJsonDraft.set(this.fiveEToolsService.formatJson(group));
	}

	cancelExtraEditor() {
		this.extraEditorCollection.set(null);
		this.editingExtraRef.set(null);
		this.extraJsonDraft.set('');
	}

	saveExtraCollection() {
		const file = this.file();
		const collection = this.extraEditorCollection();
		if (!file || !collection) return;
		const primarySource = this.summary()?.primarySource || 'Notion';

		try {
			const parsed = JSON.parse(this.extraJsonDraft());
			if (collection === 'monsterTemplate') {
				const template = this.fiveEToolsService.parseMonsterTemplate(parsed, primarySource);
				this.fiveEToolsService.createBackup(file, `Antes de salvar template: ${template.name}`);
				const next = this.fiveEToolsService.upsertMonsterTemplate(file, template, {
					matchBy:
						this.editingExtraRef()?.collection === 'monsterTemplate'
							? {
								name: this.editingExtraRef()!.originalName,
								source: this.editingExtraRef()!.originalSource,
							}
							: undefined,
				});
				this.file.set(this.fiveEToolsService.saveHomebrewFile(next));
				this.editingExtraRef.set({
					collection: 'monsterTemplate',
					originalName: template.name,
					originalSource: template.source,
				});
				this.extraJsonDraft.set(this.fiveEToolsService.formatJson(template));
				this.showToast('success', 'Template salvo no arquivo 5etools.');
				return;
			}

			const group = this.fiveEToolsService.parseLegendaryGroup(parsed, primarySource);
			this.fiveEToolsService.createBackup(file, `Antes de salvar legendary group: ${group.name}`);
			const next = this.fiveEToolsService.upsertLegendaryGroup(file, group, {
				matchBy:
					this.editingExtraRef()?.collection === 'legendaryGroup'
						? {
							name: this.editingExtraRef()!.originalName,
							source: this.editingExtraRef()!.originalSource,
						}
						: undefined,
			});
			this.file.set(this.fiveEToolsService.saveHomebrewFile(next));
			this.editingExtraRef.set({
				collection: 'legendaryGroup',
				originalName: group.name,
				originalSource: group.source,
			});
			this.extraJsonDraft.set(this.fiveEToolsService.formatJson(group));
			this.showToast('success', 'Legendary group salvo no arquivo 5etools.');
		} catch (error) {
			this.showToast('error', this.getErrorMessage(error, 'Nao foi possivel salvar a colecao extra.'));
		}
	}

	removeMonsterTemplate(template: FiveEToolsMonsterTemplate) {
		const file = this.file();
		if (!file) return;
		if (!window.confirm(`Remover o template ${template.name}?`)) return;
		this.fiveEToolsService.createBackup(file, `Antes de remover template: ${template.name}`);
		const next = this.fiveEToolsService.deleteNamedCollectionItem(file, 'monsterTemplate', template.name, template.source);
		this.file.set(this.fiveEToolsService.saveHomebrewFile(next));
		if (
			this.editingExtraRef()?.collection === 'monsterTemplate' &&
			this.editingExtraRef()?.originalName === template.name &&
			this.editingExtraRef()?.originalSource === template.source
		) {
			this.cancelExtraEditor();
		}
		this.showToast('success', 'Template removido.');
	}

	removeLegendaryGroup(group: FiveEToolsLegendaryGroup) {
		const file = this.file();
		if (!file) return;
		if (!window.confirm(`Remover o legendary group ${group.name}?`)) return;
		this.fiveEToolsService.createBackup(file, `Antes de remover legendary group: ${group.name}`);
		const next = this.fiveEToolsService.deleteNamedCollectionItem(file, 'legendaryGroup', group.name, group.source);
		this.file.set(this.fiveEToolsService.saveHomebrewFile(next));
		if (
			this.editingExtraRef()?.collection === 'legendaryGroup' &&
			this.editingExtraRef()?.originalName === group.name &&
			this.editingExtraRef()?.originalSource === group.source
		) {
			this.cancelExtraEditor();
		}
		this.showToast('success', 'Legendary group removido.');
	}

	saveCurrentMonsterAsCompositionPackage() {
		const monster = this.selectedMonster();
		if (!monster) return;
		const suggestedName = `${monster.name.trim() || 'Monster'} Composition`;
		const name = window.prompt('Nome do pacote de composicao', suggestedName);
		if (name == null) return;
		if (!name.trim()) {
			this.showToast('warn', 'Informe um nome para o pacote.');
			return;
		}
		const pkg = this.fiveEToolsService.createCompositionPackageFromMonster(monster, { name });
		this.fiveEToolsService.saveCompositionPackage(pkg);
		this.refreshCompositionPackages();
		this.showToast('success', 'Pacote de composicao salvo.');
	}

	applyCompositionPackage(pkg: FiveEToolsCompositionPackage) {
		this.updateMonster((monster) => this.fiveEToolsService.applyCompositionPackage(monster, pkg));
		this.showToast('success', `${pkg.name} aplicado ao monster atual.`);
	}

	removeCompositionPackage(pkg: FiveEToolsCompositionPackage) {
		if (!window.confirm(`Remover o pacote ${pkg.name}?`)) return;
		this.fiveEToolsService.deleteCompositionPackage(pkg.id);
		this.refreshCompositionPackages();
		this.showToast('success', 'Pacote removido.');
	}

	duplicateEntity(entity: FiveEToolsEntitySummary) {
		const file = this.file();
		if (!file) return;
		this.fiveEToolsService.createBackup(file, `Antes de duplicar: ${entity.name}`);
		const next = this.fiveEToolsService.duplicateEntity(file, entity.id);
		this.file.set(this.fiveEToolsService.saveHomebrewFile(next));
		this.showToast('success', 'Entidade duplicada.');
	}

	requestRemoveEntity(entity: FiveEToolsEntitySummary) {
		this.confirmModal.set({
			action: 'remove-entity',
			title: 'Remover item?',
			description: `O item ${entity.name} sera removido do arquivo 5etools.`,
			confirmLabel: 'Remover',
			tone: 'danger',
			entity,
		});
	}

	requestExportFull() {
		const file = this.file();
		if (!file) return;
		const warningCount = this.exportWarningCount();
		if (warningCount > 0) {
			this.confirmModal.set({
				action: 'export-with-warnings',
				title: 'Exportar com avisos?',
				description: `Existem ${warningCount} avisos de validacao no arquivo atual.`,
				confirmLabel: 'Exportar mesmo assim',
				tone: 'warning',
				warningCount,
			});
			return;
		}
		this.exportFull();
	}

	exportFull() {
		const file = this.file();
		if (!file) return;
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
		this.closeNewItemMenu();
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
		this.closeNewItemMenu();
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
			this.copyTagFallback.set(tag);
			return;
		}
		void navigator.clipboard
			.writeText(tag)
			.then(() => this.showToast('success', 'Tag copiada.'))
			.catch(() => {
				this.copyTagFallback.set(tag);
			});
	}

	closeConfirmModal() {
		this.confirmModal.set(null);
	}

	confirmModalAction() {
		const modal = this.confirmModal();
		if (!modal) return;

		if (modal.action === 'remove-entity') {
			this.executeRemoveEntity(modal.entity);
		}

		if (modal.action === 'export-with-warnings') {
			this.exportFull();
		}

		this.closeConfirmModal();
	}

	closeCopyTagFallback() {
		this.copyTagFallback.set(null);
	}

	openTagHelper() {
		this.editorTagHelperOpen.set(true);
	}

	openContextualTagHelper(target: TagInsertionTarget) {
		this.tagInsertionTarget.set(target);
		this.editorTagHelperOpen.set(true);
	}

	closeTagHelper() {
		this.editorTagHelperOpen.set(false);
		this.tagInsertionTarget.set(null);
	}

	insertGeneratedTagToTarget() {
		const target = this.tagInsertionTarget();
		if (!target) return;

		if (target.kind === 'monster-entry') {
			this.appendGeneratedTagToMonsterEntry(target.section, target.blockIndex, target.entryIndex);
		}

		if (target.kind === 'monster-nested-entry') {
			this.appendGeneratedTagToMonsterNestedEntry(
				target.section,
				target.blockIndex,
				target.entryIndex,
				target.childIndex,
			);
		}

		if (target.kind === 'trap-entry') {
			this.appendGeneratedTagToTrapEntry(target.entryIndex);
		}

		if (target.kind === 'trap-nested-entry') {
			this.appendGeneratedTagToTrapNestedEntry(target.entryIndex, target.childIndex);
		}

		if (target.kind === 'spell-header') {
			this.appendGeneratedTagToSpellHeader(target.blockIndex, target.entryIndex);
		}

		if (target.kind === 'spell-footer') {
			this.appendGeneratedTagToSpellFooter(target.blockIndex, target.entryIndex);
		}

		this.showToast('success', 'Tag inserida.');
		this.closeTagHelper();
	}

	tagInsertionTargetLabel(): string {
		const target = this.tagInsertionTarget();
		if (!target) return 'Use o helper para gerar e copiar tags 5etools.';
		if (target.kind === 'monster-entry') return 'Inserir na entry do bloco do monster';
		if (target.kind === 'monster-nested-entry') return 'Inserir na entry interna do sub-bloco';
		if (target.kind === 'trap-entry') return 'Inserir na entry da trap';
		if (target.kind === 'trap-nested-entry') return 'Inserir na entry interna da trap';
		if (target.kind === 'spell-header') return 'Inserir na header entry do spellcasting';
		return 'Inserir na footer entry do spellcasting';
	}

	openSpellPicker(blockIndex: number, levelKey: string) {
		this.spellPickerState.set({ blockIndex, levelKey });
	}

	closeSpellPicker() {
		this.spellPickerState.set(null);
	}

	importSpellReference(spell: FiveEToolsReferenceSpell) {
		const picker = this.spellPickerState();
		if (!picker) return;

		this.updateSpellcastingLevel(picker.blockIndex, picker.levelKey, (level) => {
			const currentSpells = [...(level.spells ?? [])];
			const spellTag = this.buildSpellTag(spell.name, spell.source);
			if (currentSpells.includes(spellTag)) return level;
			return { ...level, spells: [...currentSpells, spellTag] };
		});
		this.closeSpellPicker();
		this.showToast('success', `${spell.name} importada para o spellcasting.`);
	}

	spellLevelDisplayLabel(levelKey: string): string {
		if (levelKey === '0') return 'cantrips';
		if (levelKey === '1') return '1º nível';
		return `${levelKey}º nível`;
	}

	getSpellLevelSpellName(blockIndex: number, levelKey: string, spellIndex: number): string {
		const value = this.getSpellLevelSpell(blockIndex, levelKey, spellIndex);
		const parsed = this.parseSpellTag(value);
		return parsed?.name ?? value;
	}

	getSpellLevelSpellSource(blockIndex: number, levelKey: string, spellIndex: number): string {
		const value = this.getSpellLevelSpell(blockIndex, levelKey, spellIndex);
		const parsed = this.parseSpellTag(value);
		return parsed?.source ?? this.defaultSpellSource();
	}

	updateSpellLevelSpellName(
		blockIndex: number,
		levelKey: string,
		spellIndex: number,
		value: string,
	) {
		const source = this.getSpellLevelSpellSource(blockIndex, levelKey, spellIndex);
		this.updateSpellLevelSpellReference(blockIndex, levelKey, spellIndex, value, source);
	}

	updateSpellLevelSpellSource(
		blockIndex: number,
		levelKey: string,
		spellIndex: number,
		value: string,
	) {
		const name = this.getSpellLevelSpellName(blockIndex, levelKey, spellIndex);
		this.updateSpellLevelSpellReference(blockIndex, levelKey, spellIndex, name, value);
	}

	spellInputPreview(value: string | FiveEToolsEntry): string {
		if (typeof value === 'string') return this.fiveEToolsService.renderText(value || '');
		return this.fiveEToolsService.renderEntries([value]).join(' ');
	}

	openReferencePicker(
		kind: 'action' | 'optionalfeature' | 'feat' | 'item' | 'condition' | 'status',
		section: MonsterBlockSection,
	) {
		this.referencePickerState.set({ kind, section });
	}

	closeReferencePicker() {
		this.referencePickerState.set(null);
	}

	openLanguagePicker() {
		this.languagePickerState.set({ targetField: 'languages' });
	}

	closeLanguagePicker() {
		this.languagePickerState.set(null);
	}

	importReferenceToMonsterSection(reference: FiveEToolsReferenceImportable) {
		const picker = this.referencePickerState();
		if (!picker) return;

		const nextBlock: FiveEToolsMonsterFeatureBlock = {
			name: reference.name,
			entries: structuredClone(reference.entries),
		};

		this.updateMonster((monster) => ({
			...monster,
			[picker.section]: [...this.getMonsterBlocks(picker.section), nextBlock],
		}));

		this.closeReferencePicker();

		if (reference.kind === 'item' && reference.hasAttachedSpells) {
			this.showToast(
				'warn',
				`${reference.name} importado. Esse item também possui spells anexadas, que poderão ser integradas em uma próxima etapa.`,
				4200,
			);
			return;
		}

		if ((reference.kind === 'optionalfeature' || reference.kind === 'feat') && reference.hasAdditionalSpells) {
			this.showToast(
				'warn',
				`${reference.name} importada. Essa referência também inclui spells associadas, que poderão ser integradas em uma próxima etapa.`,
				4200,
			);
			return;
		}

		this.showToast('success', `${reference.name} importada para ${this.monsterSectionLabel(picker.section)}.`);
	}

	importLanguageReference(reference: FiveEToolsReferenceImportable) {
		const picker = this.languagePickerState();
		if (!picker || reference.kind !== 'language') return;

		const current = this.selectedMonster()?.[picker.targetField] ?? [];
		const currentNames = Array.isArray(current)
			? current.filter((entry): entry is string => typeof entry === 'string')
			: [];
		if (currentNames.includes(reference.name)) {
			this.closeLanguagePicker();
			this.showToast('warn', `${reference.name} já está presente na lista de idiomas.`);
			return;
		}

		this.updateMonster((monster) => ({
			...monster,
			[picker.targetField]: [...currentNames, reference.name],
		}));
		this.closeLanguagePicker();
		this.showToast('success', `${reference.name} adicionado aos idiomas.`);
	}

	monsterSectionLabel(section: MonsterBlockSection): string {
		return this.monsterSections.find((item) => item.key === section)?.label ?? section;
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

	getMonsterTypeBase(): string {
		const type = this.selectedMonster()?.type;
		if (typeof type === 'string') return type;
		if (type && typeof type === 'object' && !Array.isArray(type)) {
			const value = (type as Record<string, unknown>)['type'];
			return typeof value === 'string' ? value : '';
		}
		return '';
	}

	getMonsterTypeTagsText(): string {
		const type = this.selectedMonster()?.type;
		if (!type || typeof type !== 'object' || Array.isArray(type)) return '';
		const tags = (type as Record<string, unknown>)['tags'];
		return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string').join(', ') : '';
	}

	setMonsterTypeBase(value: string) {
		const nextType = value.trim();
		this.updateMonster((monster) => {
			const current = monster.type;
			const currentTags =
				current && typeof current === 'object' && !Array.isArray(current)
					? Array.isArray((current as Record<string, unknown>)['tags'])
						? ((current as Record<string, unknown>)['tags'] as unknown[])
						: []
					: [];

			if (!nextType) {
				return {
					...monster,
					type: currentTags.length
						? { ...(typeof current === 'object' && current && !Array.isArray(current) ? current : {}), type: '', tags: currentTags }
						: '',
				};
			}

			if (currentTags.length || (current && typeof current === 'object' && !Array.isArray(current))) {
				return {
					...monster,
					type: {
						...(typeof current === 'object' && current && !Array.isArray(current) ? current : {}),
						type: nextType,
						tags: currentTags,
					},
				};
			}

			return { ...monster, type: nextType };
		});
	}

	setMonsterTypeTagsText(value: string) {
		const tags = this.parseCommaSeparated(value);
		this.updateMonster((monster) => {
			const baseType = this.getMonsterTypeBase().trim() || 'humanoid';
			const current = monster.type;
			if (!tags.length) {
				return {
					...monster,
					type: baseType,
				};
			}

			return {
				...monster,
				type: {
					...(typeof current === 'object' && current && !Array.isArray(current) ? current : {}),
					type: baseType,
					tags,
				},
			};
		});
	}

	monsterTypeHasAdvancedStructure(): boolean {
		const type = this.selectedMonster()?.type;
		if (!type || typeof type !== 'object' || Array.isArray(type)) return false;
		return Object.keys(type).some((key) => !['type', 'tags'].includes(key));
	}

	getMonsterAcBase(): number | '' {
		const first = this.selectedMonster()?.ac?.[0];
		if (typeof first === 'number') return first;
		if (first && typeof first === 'object' && !Array.isArray(first)) {
			const ac = (first as Record<string, unknown>)['ac'];
			return typeof ac === 'number' ? ac : '';
		}
		return '';
	}

	getMonsterAcFromText(): string {
		const first = this.selectedMonster()?.ac?.[0];
		if (!first || typeof first !== 'object' || Array.isArray(first)) return '';
		const from = (first as Record<string, unknown>)['from'];
		return Array.isArray(from)
			? from.filter((entry): entry is string => typeof entry === 'string').join(', ')
			: '';
	}

	setMonsterAcBase(value: unknown) {
		const numeric = Number(value);
		this.updateMonster((monster) => {
			const nextAc = Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
			const first = monster.ac?.[0];
			if (first && typeof first === 'object' && !Array.isArray(first)) {
				return {
					...monster,
					ac: [{ ...(first as Record<string, unknown>), ac: nextAc }],
				};
			}
			return { ...monster, ac: [nextAc] };
		});
	}

	setMonsterAcFromText(value: string) {
		const from = this.parseCommaSeparated(value);
		this.updateMonster((monster) => {
			const acBase = this.getMonsterAcBase();
			const current = monster.ac?.[0];
			const nextAc = typeof acBase === 'number' ? acBase : 10;
			if (!from.length) {
				return { ...monster, ac: [nextAc] };
			}
			return {
				...monster,
				ac: [
					{
						...(current && typeof current === 'object' && !Array.isArray(current)
							? (current as Record<string, unknown>)
							: {}),
						ac: nextAc,
						from,
					},
				],
			};
		});
	}

	monsterAcHasAdvancedStructure(): boolean {
		const ac = this.selectedMonster()?.ac ?? [];
		if (ac.length > 1) return true;
		const first = ac[0];
		if (!first || typeof first !== 'object' || Array.isArray(first)) return false;
		return Object.keys(first).some((key) => !['ac', 'from'].includes(key));
	}

	getMonsterSpeedValue(kind: 'walk' | 'fly' | 'swim' | 'climb' | 'burrow'): number | '' {
		const value = this.selectedMonster()?.speed?.[kind];
		return typeof value === 'number' && Number.isFinite(value) ? value : '';
	}

	setMonsterSpeedValue(kind: 'walk' | 'fly' | 'swim' | 'climb' | 'burrow', value: unknown) {
		const numeric = Number(value);
		this.updateMonster((monster) => {
			const speed = { ...(monster.speed ?? {}) };
			if (Number.isFinite(numeric) && numeric > 0) speed[kind] = Math.floor(numeric);
			else delete speed[kind];
			return { ...monster, speed };
		});
	}

	monsterSpeedHasAdvancedStructure(): boolean {
		const speed = this.selectedMonster()?.speed ?? {};
		return Object.keys(speed).some(
			(key) => !['walk', 'fly', 'swim', 'climb', 'burrow'].includes(key) || typeof speed[key] !== 'number',
		);
	}

	getMonsterSaveValue(ability: (typeof this.abilityKeys)[number]): string {
		const value = this.selectedMonster()?.save?.[ability];
		return typeof value === 'string' ? value : '';
	}

	setMonsterSaveValue(ability: (typeof this.abilityKeys)[number], value: string) {
		this.updateMonster((monster) => {
			const save = { ...(monster.save ?? {}) };
			const nextValue = value.trim();
			if (nextValue) save[ability] = nextValue;
			else delete save[ability];
			return { ...monster, save };
		});
	}

	getMonsterSkillValue(skill: MonsterSkillKey): string {
		const value = this.selectedMonster()?.skill?.[skill];
		return typeof value === 'string' ? value : '';
	}

	setMonsterSkillValue(skill: MonsterSkillKey, value: string) {
		this.updateMonster((monster) => {
			const nextSkill = { ...(monster.skill ?? {}) };
			const nextValue = value.trim();
			if (nextValue) nextSkill[skill] = nextValue;
			else delete nextSkill[skill];
			return { ...monster, skill: nextSkill };
		});
	}

	getMonsterListText(
		field: 'senses' | 'languages' | 'resist' | 'immune' | 'vulnerable' | 'conditionImmune',
	): string {
		const value = this.selectedMonster()?.[field];
		return Array.isArray(value)
			? value
					.map((entry) => (typeof entry === 'string' ? entry : ''))
					.filter(Boolean)
					.join(', ')
			: '';
	}

	setMonsterSimpleArrayField(
		field: 'senses' | 'languages' | 'resist' | 'immune' | 'vulnerable' | 'conditionImmune',
		value: string,
	) {
		const items = this.parseCommaSeparated(value);
		this.updateMonster((monster) => ({ ...monster, [field]: items }));
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
		const items = this.parseCommaSeparated(value);
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
		return keys.some((key) => !['name', 'entries'].includes(key));
	}

	getMonsterBlockEntries(section: MonsterBlockSection, blockIndex: number): FiveEToolsEntry[] {
		return this.getMonsterBlocks(section)[blockIndex]?.entries ?? [];
	}

	isMonsterTextEntry(entry: FiveEToolsEntry): boolean {
		return typeof entry === 'string';
	}

	isMonsterEntriesBlock(entry: FiveEToolsEntry): entry is FiveEToolsEntryObject {
		return !!entry && typeof entry === 'object' && !Array.isArray(entry) && entry.type === 'entries' && Array.isArray(entry.entries);
	}

	monsterEntryHasAdvancedStructure(entry: FiveEToolsEntry): boolean {
		if (typeof entry === 'string') return false;
		if (!this.isMonsterEntriesBlock(entry)) return true;
		const keys = Object.keys(entry);
		const hasExtraKeys = keys.some((key) => !['type', 'name', 'entries'].includes(key));
		const hasComplexEntries = (entry.entries ?? []).some((child) => typeof child !== 'string');
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

	addMonsterTextEntry(section: MonsterBlockSection, blockIndex: number) {
		this.addMonsterBlockEntry(section, blockIndex);
	}

	addMonsterEntriesBlockEntry(section: MonsterBlockSection, blockIndex: number) {
		this.updateMonsterBlock(section, blockIndex, (block) => ({
			...block,
			entries: [...(block.entries ?? []), { type: 'entries', name: 'Novo sub-bloco', entries: [''] }],
		}));
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

	getMonsterEntriesBlockName(section: MonsterBlockSection, blockIndex: number, entryIndex: number): string {
		const entry = this.getMonsterBlockEntries(section, blockIndex)[entryIndex];
		return this.isMonsterEntriesBlock(entry) ? entry.name?.trim() || '' : '';
	}

	updateMonsterEntriesBlockName(
		section: MonsterBlockSection,
		blockIndex: number,
		entryIndex: number,
		value: string,
	) {
		const entry = this.getMonsterBlockEntries(section, blockIndex)[entryIndex];
		if (!this.isMonsterEntriesBlock(entry)) return;
		this.updateMonsterEntryObject(section, blockIndex, entryIndex, { ...entry, name: value });
	}

	getMonsterEntriesBlockText(section: MonsterBlockSection, blockIndex: number, entryIndex: number): string {
		const entry = this.getMonsterBlockEntries(section, blockIndex)[entryIndex];
		if (!this.isMonsterEntriesBlock(entry)) return '';
		return (entry.entries ?? []).filter((child): child is string => typeof child === 'string').join('\n');
	}

	setMonsterEntriesBlockText(
		section: MonsterBlockSection,
		blockIndex: number,
		entryIndex: number,
		value: string,
	) {
		const entry = this.getMonsterBlockEntries(section, blockIndex)[entryIndex];
		if (!this.isMonsterEntriesBlock(entry)) return;
		this.updateMonsterEntryObject(section, blockIndex, entryIndex, {
			...entry,
			entries: value
				.split('\n')
				.map((line) => line.trim())
				.filter(Boolean),
		});
	}

	addMonsterNestedEntry(section: MonsterBlockSection, blockIndex: number, entryIndex: number) {
		const entry = this.getMonsterBlockEntries(section, blockIndex)[entryIndex];
		if (!this.isMonsterEntriesBlock(entry)) return;
		this.updateMonsterEntryObject(section, blockIndex, entryIndex, {
			...entry,
			entries: [...(entry.entries ?? []), ''],
		});
	}

	getMonsterNestedEntryText(
		section: MonsterBlockSection,
		blockIndex: number,
		entryIndex: number,
		childIndex: number,
	): string {
		const entry = this.getMonsterBlockEntries(section, blockIndex)[entryIndex];
		if (!this.isMonsterEntriesBlock(entry)) return '';
		const child = entry.entries?.[childIndex];
		return typeof child === 'string' ? child : '';
	}

	updateMonsterNestedEntry(
		section: MonsterBlockSection,
		blockIndex: number,
		entryIndex: number,
		childIndex: number,
		value: string,
	) {
		const entry = this.getMonsterBlockEntries(section, blockIndex)[entryIndex];
		if (!this.isMonsterEntriesBlock(entry)) return;
		const entries = [...(entry.entries ?? [])];
		entries[childIndex] = value;
		this.updateMonsterEntryObject(section, blockIndex, entryIndex, { ...entry, entries });
	}

	removeMonsterNestedEntry(
		section: MonsterBlockSection,
		blockIndex: number,
		entryIndex: number,
		childIndex: number,
	) {
		const entry = this.getMonsterBlockEntries(section, blockIndex)[entryIndex];
		if (!this.isMonsterEntriesBlock(entry)) return;
		this.updateMonsterEntryObject(section, blockIndex, entryIndex, {
			...entry,
			entries: (entry.entries ?? []).filter((_, index) => index !== childIndex),
		});
	}

	moveMonsterNestedEntry(
		section: MonsterBlockSection,
		blockIndex: number,
		entryIndex: number,
		childIndex: number,
		direction: -1 | 1,
	) {
		const entry = this.getMonsterBlockEntries(section, blockIndex)[entryIndex];
		if (!this.isMonsterEntriesBlock(entry)) return;
		const entries = [...(entry.entries ?? [])];
		const targetIndex = childIndex + direction;
		if (targetIndex < 0 || targetIndex >= entries.length) return;
		const [child] = entries.splice(childIndex, 1);
		entries.splice(targetIndex, 0, child);
		this.updateMonsterEntryObject(section, blockIndex, entryIndex, { ...entry, entries });
	}

	appendGeneratedTagToMonsterNestedEntry(
		section: MonsterBlockSection,
		blockIndex: number,
		entryIndex: number,
		childIndex: number,
	) {
		const current = this.getMonsterNestedEntryText(section, blockIndex, entryIndex, childIndex);
		this.updateMonsterNestedEntry(
			section,
			blockIndex,
			entryIndex,
			childIndex,
			`${current} ${this.generatedTag()}`.trim(),
		);
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

	monsterSectionPreview(
		monster: FiveEToolsMonster,
		section: MonsterBlockSection,
	): Array<{ title: string; lines: string[] }> {
		const blocks = (monster[section] as FiveEToolsMonsterFeatureBlock[] | undefined) ?? [];
		return blocks.map((block) => ({
			title: block.name?.trim() || 'Bloco sem nome',
			lines: this.fiveEToolsService.renderEntries(block.entries),
		}));
	}

	monsterSpellPreview(monster: FiveEToolsMonster): Array<{ title: string; lines: string[] }> {
		return (monster.spellcasting ?? []).map((block) => ({
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

	extraEditorTitle(): string {
		return this.extraEditorCollection() === 'monsterTemplate' ? 'Editor de Template' : 'Editor de Legendary Group';
	}

	extraEditorHint(): string {
		if (this.extraEditorCollection() === 'monsterTemplate') {
			return 'Templates costumam usar estruturas de apply/_mod complexas. O fluxo aqui e JSON-first para preservar compatibilidade com o 5etools.';
		}
		return 'Legendary groups carregam lair actions, regional effects e campos especiais. O editor usa JSON direto para nao perder estrutura.';
	}

	unknownExtraCollections() {
		return (this.summary()?.otherCollections ?? []).filter(
			(collection) => !['monsterTemplate', 'legendaryGroup'].includes(collection.key),
		);
	}

	monsterTemplateSummary(template: FiveEToolsMonsterTemplate): string {
		const parts = [template.ref ? `ref ${template.ref}` : null, template.apply ? 'apply configurado' : 'sem apply'];
		return parts.filter(Boolean).join(' • ');
	}

	legendaryGroupSummary(group: FiveEToolsLegendaryGroup): string {
		const counts = [
			group.lairActions?.length ? `${group.lairActions.length} lair action(ns)` : null,
			group.regionalEffects?.length ? `${group.regionalEffects.length} efeito(s) regional(is)` : null,
			group.mythicEncounter?.length ? `${group.mythicEncounter.length} bloco(s) mythic` : null,
		];
		return counts.filter(Boolean).join(' • ') || 'Sem entries configuradas';
	}

	compositionPackageSummary(pkg: FiveEToolsCompositionPackage): string {
		const totalBlocks =
			(pkg.trait?.length ?? 0) +
			(pkg.action?.length ?? 0) +
			(pkg.bonus?.length ?? 0) +
			(pkg.reaction?.length ?? 0) +
			(pkg.legendary?.length ?? 0) +
			(pkg.spellcasting?.length ?? 0);
		return totalBlocks ? `${totalBlocks} bloco(s) reaproveitaveis` : 'Pacote vazio';
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
		if (value === 'basic') return 'Basico';
		if (value === 'blocks') return 'Blocos';
		if (value === 'spellcasting') return 'Spellcasting';
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

	private updateMonsterEntryObject(
		section: MonsterBlockSection,
		blockIndex: number,
		entryIndex: number,
		nextEntry: FiveEToolsEntryObject,
	) {
		this.updateMonsterBlock(section, blockIndex, (block) => {
			const entries = [...(block.entries ?? [])];
			entries[entryIndex] = nextEntry;
			return { ...block, entries };
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

	private refreshCompositionPackages() {
		this.compositionPackages.set(this.fiveEToolsService.listCompositionPackages());
	}

	private executeRemoveEntity(entity: FiveEToolsEntitySummary) {
		const file = this.file();
		if (!file) return;
		this.fiveEToolsService.createBackup(file, `Antes de remover: ${entity.name}`);
		const next = this.fiveEToolsService.deleteEntity(file, entity.type, entity.name, entity.source);
		this.file.set(this.fiveEToolsService.saveHomebrewFile(next));
		if (this.selectedEntityId() === entity.id) this.cancelEditor();
		this.showToast('success', 'Entidade removida.');
	}

	private buildEntityId(type: 'monster' | 'trap', name: string, source: string): string {
		return `${type}::${source}::${name}`;
	}

	private buildSpellTag(name: string, source: string): string {
		const cleanName = (name || '').trim();
		const cleanSource = (source || '').trim() || this.defaultSpellSource();
		return cleanName ? `{@spell ${cleanName}|${cleanSource}}` : '';
	}

	private parseSpellTag(value: string): { name: string; source: string } | null {
		const text = (value || '').trim();
		const match = text.match(/^\{@spell\s+([^|}]+?)(?:\|([^}]+))?\}$/i);
		if (!match) return null;
		return {
			name: (match[1] || '').trim(),
			source: (match[2] || '').trim() || this.defaultSpellSource(),
		};
	}

	private defaultSpellSource(): string {
		return 'XPHB';
	}

	private updateSpellLevelSpellReference(
		blockIndex: number,
		levelKey: string,
		spellIndex: number,
		name: string,
		source: string,
	) {
		const cleanName = (name || '').trim();
		const nextValue = cleanName ? this.buildSpellTag(cleanName, source) : '';
		this.updateSpellLevelSpell(blockIndex, levelKey, spellIndex, nextValue);
	}

	private parseCommaSeparated(value: string): string[] {
		return (value || '')
			.split(/\n|,/) 
			.map((item) => item.trim())
			.filter(Boolean);
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
