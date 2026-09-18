import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, CanDeactivateFn, Router } from '@angular/router';
import { LucideBookOpen, LucideSearch } from '@lucide/angular';
import { AppSelectComponent } from '../../components/app-select/app-select';
import { AppNativeSelectDirective } from '../../components/app-select/app-native-select';
import { SpellQuickViewComponent } from '../../components/spell-quick-view/spell-quick-view';
import { SpellReferenceTriggerDirective } from '../../components/reference-overlay/reference-trigger';
import { ReferenceOverlayService } from '../../components/reference-overlay/reference-overlay-service';

import type {
	BattleLairActionFrequency,
	BattleTrapFrequency,
	BattleTrapTriggerType,
} from '../../models/battle-encounter-model';
import type {
	CreatureAbilityRecoveryType,
	CreatureCategory,
	CreatureSheet,
	CreatureSpecialAbility,
	CreatureSpell,
} from '../../models/creature-sheet-model';
import { normalizeArmorClass } from '../../models/creature-sheet-model';
import type { ResolvedContextualContent } from '../../models/contextual-content-resolver-model';
import {
	isCampaignOrganizationEligible,
	type CampaignLocationScope,
} from '../../models/campaign-world-model';
import type {
	ContentLocationRelation,
	ContentLocationRelationKind,
	ContentOrganizationRelation,
	ContentOrganizationRelationKind,
} from '../../models/content-context-model';
import { abilityModifier } from '../../models/creature-sheet-rules';
import type {
	Encounter,
	EncounterLairAction,
	EncounterParticipant,
	EncounterTrap,
} from '../../models/encounter-model';
import { DialogFocusDirective } from '../../directives/dialog-focus';
import type { CompendiumBestiaryMonsterIndexEntry } from '../../models/compendium-bestiary-model';
import type { ResolvedSpellReference } from '../../models/spell-reference-model';
import { BattleEncounterStorageService } from '../../services/battle-encounter-storage-service/battle-encounter-storage-service';
import { CampaignContextService } from '../../services/campaign-context-service/campaign-context-service';
import { CompendiumBestiaryRepositoryService } from '../../services/compendium-bestiary-repository-service/compendium-bestiary-repository-service';
import { CompendiumCreatureAdapterService } from '../../services/compendium-creature-adapter-service/compendium-creature-adapter-service';
import { CreatureTemplateService } from '../../services/creature-template-service/creature-template-service';
import { FiveEToolsHomebrewService } from '../../services/fiveetools-homebrew-service/fiveetools-homebrew-service';
import { CampaignWorldService } from '../../services/campaign-world-service/campaign-world-service';
import { ContextualContentResolverService } from '../../services/contextual-content-resolver-service/contextual-content-resolver-service';
import {
	LocalStorageService,
	type SavedEncounter,
	type SavedSheetInterface,
} from '../../services/local-storage-service/local-storage-service';
import { SpellReferenceResolverService } from '../../services/spell-reference-resolver-service/spell-reference-resolver-service';

type ParticipantDraft = {
	name: string;
	initiative: number | null;
	hp: number | null;
	armorClass: string;
	category: CreatureCategory;
	quantity: number;
};

type SpellDraft = { name: string; level: number | null; uses: number | null; source: string };
type AbilityDraft = {
	name: string;
	description: string;
	recoveryType: CreatureAbilityRecoveryType;
	maxUses: number;
	cooldownValue: number;
	rechargeOn: string;
};
type LairActionDraft = {
	name: string;
	description: string;
	initiative: string;
	frequency: BattleLairActionFrequency;
	cooldownRounds: string;
};
type TrapDraft = {
	name: string;
	description: string;
	triggerType: BattleTrapTriggerType;
	initiative: string;
	frequency: BattleTrapFrequency;
	cooldownRounds: string;
};

type ParticipantContextSuggestion = {
	sourceCount: number;
	locationRefs: ContentLocationRelation[];
	organizationRefs: ContentOrganizationRelation[];
	hasSuggestions: boolean;
};

type ContextualSheetSuggestion = Omit<ResolvedContextualContent, 'content'> & {
	content: SavedSheetInterface;
};

@Component({
	selector: 'app-encounter-builder',
	standalone: true,
	imports: [
		AppNativeSelectDirective,
		AppSelectComponent,
		SpellQuickViewComponent,
		SpellReferenceTriggerDirective,
		CommonModule,
		DialogFocusDirective,
		FormsModule,
		LucideBookOpen,
		LucideSearch,
	],
	templateUrl: './encounter-builder.html',
})
export class EncounterBuilder {
	readonly normalizeArmorClass = normalizeArmorClass;
	private readonly referenceOverlay = inject(ReferenceOverlayService);
	private readonly contextualResolver = inject(ContextualContentResolverService);
	readonly encounter = signal<Encounter>(this.createDefaultEncounter());
	readonly participants = computed(() => this.encounter().participants);
	readonly savedId = signal<string | null>(null);
	readonly expandedId = signal<string | null>(null);
	readonly homebrewModalOpen = signal(false);
	readonly bestiaryModalOpen = signal(false);
	readonly bestiaryLoading = signal(false);
	readonly bestiaryError = signal<string | null>(null);
	readonly bestiaryMonsters = signal<CompendiumBestiaryMonsterIndexEntry[]>([]);
	readonly bestiaryQ = signal('');
	readonly quickSpell = signal<ResolvedSpellReference | null>(null);
	readonly bestiarySource = signal('');
	readonly bestiaryType = signal('');
	readonly bestiarySize = signal('');
	readonly bestiaryChallengeRating = signal('');
	readonly bestiarySpellcasterOnly = signal(false);
	readonly bestiaryLegendaryOnly = signal(false);
	readonly sheetQ = signal('');
	readonly toast = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
	readonly unsavedChangesModal = signal(false);
	readonly initiativeSetupOpen = signal(false);
	readonly initiativeDrafts = signal<Record<string, string>>({});
	readonly initiativeTieBreakerDrafts = signal<Record<string, string>>({});
	readonly draft = signal<ParticipantDraft>(this.createParticipantDraft());
	readonly spellDrafts = signal<Record<string, SpellDraft>>({});
	readonly abilityDrafts = signal<Record<string, AbilityDraft>>({});
	readonly lairActionDraft = signal<LairActionDraft>(this.createLairActionDraft());
	readonly trapDraft = signal<TrapDraft>(this.createTrapDraft());
	readonly homebrewSheets = signal<SavedSheetInterface[]>([]);
	readonly editingLocationRefIndex = signal<number | null>(null);
	readonly editingOrganizationRefIndex = signal<number | null>(null);
	readonly locationScopeType = signal<CampaignLocationScope>('state');
	readonly locationScopeId = signal('');
	readonly locationRelation = signal<ContentLocationRelationKind>('base');
	readonly organizationId = signal('');
	readonly organizationRelation = signal<ContentOrganizationRelationKind>('member');
	readonly campaignWorld = inject(CampaignWorldService);
	readonly campaignContext = inject(CampaignContextService);
	readonly locationScopeTypeOptions: Array<{ value: CampaignLocationScope; label: string }> = [
		{ value: 'empire', label: 'Império' },
		{ value: 'state', label: 'Estado' },
		{ value: 'settlement', label: 'Localidade' },
	];
	readonly locationRelationOptions: Array<{ value: ContentLocationRelationKind; label: string }> = [
		{ value: 'base', label: 'Base ou residência' },
		{ value: 'occurrence', label: 'Ocorrência' },
		{ value: 'habitat', label: 'Habitat' },
		{ value: 'operation', label: 'Operação' },
	];
	readonly organizationRelationOptions: Array<{
		value: ContentOrganizationRelationKind;
		label: string;
	}> = [
		{ value: 'member', label: 'Membro' },
		{ value: 'leader', label: 'Liderança' },
		{ value: 'affiliated', label: 'Afiliado' },
		{ value: 'institution', label: 'Ficha institucional' },
		{ value: 'trained_by', label: 'Treinado por' },
	];
	readonly locationScopeOptions = computed(() => {
		const scopeType = this.locationScopeType();
		const world = this.campaignWorld.world();
		if (!world) return [];
		const entities =
			scopeType === 'empire'
				? world.empires
				: scopeType === 'state'
					? world.states
					: world.settlements;
		return entities
			.map((entity) => {
				const location = this.campaignWorld.resolveLocation({ scopeType, scopeId: entity.id });
				return { value: entity.id, label: location?.breadcrumb.join(' › ') ?? entity.name };
			})
			.sort((left, right) => left.label.localeCompare(right.label));
	});
	readonly organizationOptions = computed(() =>
		(this.campaignWorld.world()?.organizations ?? [])
			.filter((organization) => isCampaignOrganizationEligible(organization))
			.map((organization) => ({
				value: organization.id,
				label: `${organization.name}${organization.archived ? ' [arquivada]' : ''}`,
			}))
		.sort((left, right) => left.label.localeCompare(right.label)),
	);
	readonly participantContextSuggestion = computed<ParticipantContextSuggestion>(() => {
		const sheetsById = new Map(this.homebrewSheets().map((sheet) => [sheet.id, sheet]));
		const sourceSheets = this.participants()
			.map((participant) => (participant.sourceSheetId ? sheetsById.get(participant.sourceSheetId) : undefined))
			.filter((sheet): sheet is SavedSheetInterface => !!sheet);
		const locationRefs = uniqueLocationRelations(sourceSheets.flatMap((sheet) => sheet.locationRefs ?? []));
		const organizationRefs = uniqueOrganizationRelations(
			sourceSheets.flatMap((sheet) => sheet.organizationRefs ?? []),
		);
		return {
			sourceCount: new Set(sourceSheets.map((sheet) => sheet.id)).size,
			locationRefs,
			organizationRefs,
			hasSuggestions: locationRefs.length > 0 || organizationRefs.length > 0,
		};
	});
	readonly saveAndBattleLabel = computed(() =>
		this.savedId() && this.battleStorage.getActiveBattleByEncounterId(this.savedId()!)
			? 'Salvar e continuar batalha'
			: 'Salvar e iniciar batalha',
	);
	readonly hasUnsavedChanges = computed(() => this.editorSnapshot() !== this.savedSnapshot());
	readonly filteredHomebrewSheets = computed(() => {
		const query = this.sheetQ().trim().toLowerCase();
		if (!query) return this.homebrewSheets();
		return this.homebrewSheets().filter((sheet) =>
			`${sheet.title} ${sheet.data.name} ${sheet.tags.join(' ')} ${sheet.category} ${sheet.source}`
				.toLowerCase()
				.includes(query),
		);
	});
	readonly contextualSheetSuggestions = computed(() => {
		const resolution = this.contextualResolver.resolve({
			currentLocation: this.campaignContext.resolvedCurrentLocation(),
			sheets: this.homebrewSheets(),
			encounters: [],
			organizations: [],
		});
		const seen = new Set<string>();
		const here = this.contextualSheetsFor(resolution.here, seen);
		const stateRegion = this.contextualSheetsFor(resolution.stateRegion, seen);
		const broadContext = this.contextualSheetsFor(resolution.broadContext, seen);
		return { here, stateRegion, broadContext };
	});
	readonly contextualSuggestionGroups = computed(() => {
		const suggestions = this.contextualSheetSuggestions();
		return [
			{ id: 'here', label: 'Aqui', entries: suggestions.here },
			{ id: 'state-region', label: 'Estado/região', entries: suggestions.stateRegion },
			{ id: 'broad-context', label: 'Regional/amplo', entries: suggestions.broadContext },
		].filter((group) => group.entries.length > 0);
	});

	contextualSheetCategoryLabel(entry: ContextualSheetSuggestion): string {
		return entry.content.category === 'npc' ? 'NPC' : 'Monstro';
	}

	contextualSheetReasonLabel(entry: ContextualSheetSuggestion): string {
		if (entry.reason === 'generic') return 'Arquétipo reutilizável';
		return entry.matchedLocations
			.map((location) => this.locationRelationLabel(location.relation))
			.join(' · ');
	}
	readonly filteredBestiaryMonsters = computed(() => {
		const query = this.bestiaryQ().trim().toLowerCase();
		return this.bestiaryMonsters().filter(
			(monster) =>
				(!query || `${monster.name} ${monster.aliases.join(' ')}`.toLowerCase().includes(query)) &&
				(!this.bestiarySource() || monster.source === this.bestiarySource()) &&
				(!this.bestiaryType() || monster.type === this.bestiaryType()) &&
				(!this.bestiarySize() || monster.size === this.bestiarySize()) &&
				(!this.bestiaryChallengeRating() ||
					monster.challengeRating === this.bestiaryChallengeRating()) &&
				(!this.bestiarySpellcasterOnly() || monster.hasSpellcasting) &&
				(!this.bestiaryLegendaryOnly() || monster.hasLegendaryActions || monster.hasLairActions),
		);
	});
	readonly bestiarySources = computed(() => this.bestiaryFilterValues((monster) => monster.source));
	readonly bestiaryTypes = computed(() => this.bestiaryFilterValues((monster) => monster.type));
	readonly bestiarySizes = computed(() => this.bestiaryFilterValues((monster) => monster.size));
	readonly bestiaryChallengeRatings = computed(() =>
		this.bestiaryFilterValues((monster) => monster.challengeRating),
	);

	readonly spellLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9];

	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly ls = inject(LocalStorageService);
	private readonly battleStorage = inject(BattleEncounterStorageService);
	private readonly creatureTemplates = inject(CreatureTemplateService);
	private readonly bestiary = inject(CompendiumBestiaryRepositoryService);
	private readonly compendiumAdapter = inject(CompendiumCreatureAdapterService);
	private readonly spellResolver = inject(SpellReferenceResolverService);
	private readonly fiveETools = inject(FiveEToolsHomebrewService);
	private readonly savedSnapshot = signal('');
	private pendingNavigationResolver: ((allowed: boolean) => void) | null = null;
	private toastTimer: number | null = null;

	constructor() {
		const saved = this.route.snapshot.paramMap.get('id');
		if (saved) {
			const encounter = this.ls.getEncounter(saved);
			if (encounter) {
				this.savedId.set(encounter.id);
				this.encounter.set(structuredClone(encounter));
			}
		}
		this.refreshHomebrewSheets();
		void this.handleFiveEToolsNavigationImport();
		this.markSaved();
	}

	@HostListener('window:beforeunload', ['$event'])
	onBeforeUnload(event: BeforeUnloadEvent) {
		if (!this.hasUnsavedChanges()) return;
		event.preventDefault();
		event.returnValue = '';
	}

	@HostListener('window:keydown.escape')
	onEscape() {
		if (this.unsavedChangesModal()) this.stayOnPage();
	}

	canDeactivate(): boolean | Promise<boolean> {
		if (!this.hasUnsavedChanges()) return true;
		this.unsavedChangesModal.set(true);
		return new Promise((resolve) => (this.pendingNavigationResolver = resolve));
	}

	stayOnPage() {
		this.unsavedChangesModal.set(false);
		this.resolvePendingNavigation(false);
	}

	discardChanges() {
		this.unsavedChangesModal.set(false);
		this.resolvePendingNavigation(true);
	}

	backToHub() {
		this.router.navigate(['/home']);
	}

	updateTitle(title: string) {
		this.updateEncounter({ title });
	}

	updateDescription(description: string) {
		this.updateEncounter({ description: description.trim() || undefined });
	}

	updateTags(value: string) {
		const tags = [
			...new Set(
				value
					.split(',')
					.map((tag) => tag.trim())
					.filter(Boolean),
			),
		];
		this.updateEncounter({ tags });
	}

	setArchived(archived: boolean) {
		this.updateEncounter({ archived: archived ? true : undefined });
	}

	applyParticipantContext() {
		const suggestion = this.participantContextSuggestion();
		if (!suggestion.hasSuggestions) {
			this.showToast({ type: 'warn', text: 'Nenhum integrante possui contexto formal para sugerir.' });
			return;
		}

		const locationRefs = uniqueLocationRelations([
			...(this.encounter().locationRefs ?? []),
			...suggestion.locationRefs,
		]);
		const organizationRefs = uniqueOrganizationRelations([
			...(this.encounter().organizationRefs ?? []),
			...suggestion.organizationRefs,
		]);
		this.updateEncounter({
			locationRefs: locationRefs.length ? locationRefs : undefined,
			organizationRefs: organizationRefs.length ? organizationRefs : undefined,
		});
		this.showToast({ type: 'success', text: 'Contexto formal dos integrantes aplicado.' });
	}

	setLocationScopeType(scopeType: CampaignLocationScope) {
		this.locationScopeType.set(scopeType);
		this.locationScopeId.set('');
	}

	setLocationScopeId(scopeId: string) {
		this.locationScopeId.set(scopeId);
	}

	setLocationRelation(relation: ContentLocationRelationKind) {
		this.locationRelation.set(relation);
	}

	editLocationRef(index: number) {
		const ref = this.encounter().locationRefs?.[index];
		if (!ref) return;
		this.editingLocationRefIndex.set(index);
		this.locationScopeType.set(ref.scopeType);
		this.locationScopeId.set(ref.scopeId);
		this.locationRelation.set(ref.relation);
	}

	cancelLocationRefEdit() {
		this.editingLocationRefIndex.set(null);
		this.locationScopeType.set('state');
		this.locationScopeId.set('');
		this.locationRelation.set('base');
	}

	saveLocationRef() {
		const scopeType = this.locationScopeType();
		const scopeId = this.locationScopeId();
		if (!this.campaignWorld.resolveLocation({ scopeType, scopeId })) {
			this.showToast({ type: 'warn', text: 'Escolha uma localização válida.' });
			return;
		}
		const relation: ContentLocationRelation = {
			scopeType,
			scopeId,
			relation: this.locationRelation(),
		};
		const refs = this.encounter().locationRefs ?? [];
		const editingIndex = this.editingLocationRefIndex();
		if (
			refs.some(
				(item, index) =>
					index !== editingIndex &&
					item.scopeType === relation.scopeType &&
					item.scopeId === relation.scopeId &&
					item.relation === relation.relation,
			)
		) {
			this.showToast({ type: 'warn', text: 'Esta relação de localização já foi adicionada.' });
			return;
		}
		this.updateEncounter({
			locationRefs:
				editingIndex === null
					? [...refs, relation]
					: refs.map((item, index) => (index === editingIndex ? relation : item)),
		});
		this.cancelLocationRefEdit();
	}

	removeLocationRef(index: number) {
		const refs = (this.encounter().locationRefs ?? []).filter((_, itemIndex) => itemIndex !== index);
		this.updateEncounter({ locationRefs: refs.length ? refs : undefined });
		const editingIndex = this.editingLocationRefIndex();
		if (editingIndex === index) this.cancelLocationRefEdit();
		else if (editingIndex !== null && index < editingIndex) this.editingLocationRefIndex.set(editingIndex - 1);
	}

	setOrganizationId(organizationId: string) {
		this.organizationId.set(organizationId);
	}

	setOrganizationRelation(relation: ContentOrganizationRelationKind) {
		this.organizationRelation.set(relation);
	}

	editOrganizationRef(index: number) {
		const ref = this.encounter().organizationRefs?.[index];
		if (!ref) return;
		this.editingOrganizationRefIndex.set(index);
		this.organizationId.set(ref.organizationId);
		this.organizationRelation.set(ref.relation);
	}

	cancelOrganizationRefEdit() {
		this.editingOrganizationRefIndex.set(null);
		this.organizationId.set('');
		this.organizationRelation.set('member');
	}

	saveOrganizationRef() {
		const organizationId = this.organizationId();
		const organization = this.campaignWorld.getOrganization(organizationId);
		if (!organization || !isCampaignOrganizationEligible(organization)) {
			this.showToast({ type: 'warn', text: 'Escolha uma guilda ou grupo formal válido.' });
			return;
		}
		const relation: ContentOrganizationRelation = {
			organizationId,
			relation: this.organizationRelation(),
		};
		const refs = this.encounter().organizationRefs ?? [];
		const editingIndex = this.editingOrganizationRefIndex();
		if (
			refs.some(
				(item, index) =>
					index !== editingIndex &&
					item.organizationId === relation.organizationId &&
					item.relation === relation.relation,
			)
		) {
			this.showToast({ type: 'warn', text: 'Esta relação de organização já foi adicionada.' });
			return;
		}
		this.updateEncounter({
			organizationRefs:
				editingIndex === null
					? [...refs, relation]
					: refs.map((item, index) => (index === editingIndex ? relation : item)),
		});
		this.cancelOrganizationRefEdit();
	}

	removeOrganizationRef(index: number) {
		const refs = (this.encounter().organizationRefs ?? []).filter((_, itemIndex) => itemIndex !== index);
		this.updateEncounter({ organizationRefs: refs.length ? refs : undefined });
		const editingIndex = this.editingOrganizationRefIndex();
		if (editingIndex === index) this.cancelOrganizationRefEdit();
		else if (editingIndex !== null && index < editingIndex)
			this.editingOrganizationRefIndex.set(editingIndex - 1);
	}

	locationRefLabel(ref: ContentLocationRelation): string {
		return this.campaignWorld.resolveLocation(ref)?.breadcrumb.join(' › ') ?? `ID removido: ${ref.scopeId}`;
	}

	organizationRefLabel(ref: ContentOrganizationRelation): string {
		const organization = this.campaignWorld.getOrganization(ref.organizationId);
		return organization && isCampaignOrganizationEligible(organization)
			? organization.name
			: `ID não elegível: ${ref.organizationId}`;
	}

	locationRelationLabel(relation: ContentLocationRelationKind): string {
		return this.locationRelationOptions.find((option) => option.value === relation)?.label ?? relation;
	}

	organizationRelationLabel(relation: ContentOrganizationRelationKind): string {
		return this.organizationRelationOptions.find((option) => option.value === relation)?.label ?? relation;
	}

	isBrokenLocationRef(ref: ContentLocationRelation): boolean {
		return !this.campaignWorld.resolveLocation(ref);
	}

	isBrokenOrganizationRef(ref: ContentOrganizationRelation): boolean {
		const organization = this.campaignWorld.getOrganization(ref.organizationId);
		return !organization || !isCampaignOrganizationEligible(organization);
	}

	setDraftName(name: string) {
		this.draft.update((draft) => ({ ...draft, name }));
	}

	setDraftInitiative(value: unknown) {
		this.draft.update((draft) => ({ ...draft, initiative: this.parseNullableNumber(value) }));
	}

	setDraftHp(value: unknown) {
		this.draft.update((draft) => ({ ...draft, hp: this.parseNullableNumber(value) }));
	}

	setDraftArmorClass(armorClass: string) {
		this.draft.update((draft) => ({ ...draft, armorClass }));
	}

	setDraftCategory(category: CreatureCategory) {
		this.draft.update((draft) => ({ ...draft, category }));
	}

	setDraftQuantity(value: unknown) {
		this.draft.update((draft) => ({ ...draft, quantity: this.quantity(value) }));
	}

	addParticipants() {
		const draft = this.draft();
		const quantity = this.quantity(draft.quantity);
		const sheet = this.creatureTemplates.createManualCreature({
			name: draft.name || 'Creature',
			hp: draft.hp,
			armorClass: draft.armorClass,
		});
		this.addCopies(sheet, draft.category, quantity, undefined, draft.initiative);
		this.draft.set(this.createParticipantDraft());
	}

	openHomebrewModal() {
		this.refreshHomebrewSheets();
		this.homebrewModalOpen.set(true);
	}

	closeHomebrewModal() {
		this.homebrewModalOpen.set(false);
	}

	useSheetInDraft(id: string) {
		const saved = this.ls.getSheet(id);
		if (!saved) return this.showToast({ type: 'error', text: 'Ficha não encontrada.' });
		this.draft.update((draft) => ({
			...draft,
			name: saved.data.name || saved.title,
			hp: saved.data.maxHp,
			armorClass: saved.data.armorClass == null ? '' : String(saved.data.armorClass),
			category: saved.category,
		}));
	}

	addFromSheet(id: string) {
		const saved = this.ls.getSheet(id);
		if (!saved) return this.showToast({ type: 'error', text: 'Ficha não encontrada.' });
		this.addCopies(
			this.creatureTemplates.createFromSavedSheet(saved),
			saved.category,
			this.quantity(this.draft().quantity),
			saved.id,
			this.draft().initiative,
		);
		this.showToast({ type: 'success', text: 'Participante(s) adicionado(s).' });
	}

	async openBestiaryModal() {
		this.bestiaryModalOpen.set(true);
		this.bestiaryError.set(null);
		if (this.bestiaryMonsters().length) return;
		this.bestiaryLoading.set(true);
		try {
			this.bestiaryMonsters.set((await this.bestiary.getIndex()).monsters);
		} catch (error) {
			this.bestiaryError.set(
				error instanceof Error ? error.message : 'Erro ao carregar bestiário local.',
			);
		} finally {
			this.bestiaryLoading.set(false);
		}
	}

	closeBestiaryModal() {
		this.bestiaryModalOpen.set(false);
		this.bestiaryQ.set('');
		this.bestiarySource.set('');
		this.bestiaryType.set('');
		this.bestiarySize.set('');
		this.bestiaryChallengeRating.set('');
		this.bestiarySpellcasterOnly.set(false);
		this.bestiaryLegendaryOnly.set(false);
	}

	toggleBestiarySpellcaster() {
		this.bestiarySpellcasterOnly.update((value) => !value);
	}

	toggleBestiaryLegendary() {
		this.bestiaryLegendaryOnly.update((value) => !value);
	}

	async addFromBestiary(resource: CompendiumBestiaryMonsterIndexEntry) {
		try {
			const monster = await this.bestiary.getMonster(resource.source, resource.name);
			if (!monster) throw new Error('Criatura não encontrada no arquivo local.');
			this.addCopies(
				this.compendiumAdapter.toCreatureSheet(monster),
				'monster',
				this.quantity(this.draft().quantity),
				undefined,
				this.draft().initiative,
			);
			this.closeBestiaryModal();
			this.showToast({ type: 'success', text: 'Participante(s) do bestiário adicionado(s).' });
		} catch (error) {
			this.showToast({
				type: 'error',
				text: error instanceof Error ? error.message : 'Erro ao adicionar criatura.',
			});
		}
	}

	toggleExpanded(id: string) {
		this.expandedId.update((expanded) => (expanded === id ? null : id));
	}

	isExpanded(id: string) {
		return this.expandedId() === id;
	}

	updateParticipant(id: string, patch: Partial<Omit<EncounterParticipant, 'id' | 'sheet'>>) {
		this.updateParticipantSheet(id, (participant) => ({ ...participant, ...patch }));
	}

	updateParticipantSheet(
		id: string,
		update: (participant: EncounterParticipant) => EncounterParticipant,
	) {
		this.encounter.update((encounter) => ({
			...encounter,
			participants: encounter.participants.map((participant) =>
				participant.id === id ? update(structuredClone(participant)) : participant,
			),
		}));
	}

	updateSheet(id: string, patch: Partial<CreatureSheet>) {
		this.updateParticipantSheet(id, (participant) => ({
			...participant,
			sheet: { ...participant.sheet, ...patch },
		}));
	}

	removeParticipant(id: string) {
		this.encounter.update((encounter) => ({
			...encounter,
			participants: encounter.participants.filter((participant) => participant.id !== id),
		}));
		this.expandedId.update((expanded) => (expanded === id ? null : expanded));
	}

	setSpellSlot(participantId: string, level: number, value: unknown) {
		const max = this.nonNegativeInt(value);
		this.updateParticipantSheet(participantId, (participant) => {
			const current = participant.sheet.spellSlots.filter((slot) => slot.level !== level);
			return {
				...participant,
				sheet: {
					...participant.sheet,
					spellSlots: [...current, { level, max }].sort((a, b) => a.level - b.level),
				},
			};
		});
	}

	spellSlot(participant: EncounterParticipant, level: number): number | null {
		return participant.sheet.spellSlots.find((slot) => slot.level === level)?.max ?? null;
	}

	openSpellQuickView(spell: CreatureSpell) {
		this.referenceOverlay.openSpell({ name: spell.name, source: spell.source });
	}

	getSpellDraft(id: string): SpellDraft {
		return this.spellDrafts()[id] ?? { name: '', level: null, uses: null, source: '' };
	}

	setSpellDraft(id: string, patch: Partial<SpellDraft>) {
		this.spellDrafts.update((drafts) => ({
			...drafts,
			[id]: { ...this.getSpellDraft(id), ...patch },
		}));
	}

	addSpell(participantId: string) {
		const draft = this.getSpellDraft(participantId);
		const name = draft.name.trim();
		if (!name) return;
		const spell: CreatureSpell = {
			id: crypto.randomUUID(),
			name,
			...(draft.level == null ? {} : { level: this.nonNegativeInt(draft.level) }),
			...(draft.uses == null ? {} : { uses: this.nonNegativeInt(draft.uses) }),
			...(draft.source.trim() ? { source: draft.source.trim() } : {}),
		};
		this.updateParticipantSheet(participantId, (participant) => ({
			...participant,
			sheet: { ...participant.sheet, spells: [...participant.sheet.spells, spell] },
		}));
		this.setSpellDraft(participantId, { name: '', level: null, uses: null, source: '' });
	}

	updateSpell(participantId: string, spellId: string, patch: Partial<CreatureSpell>) {
		this.updateParticipantSheet(participantId, (participant) => ({
			...participant,
			sheet: {
				...participant.sheet,
				spells: participant.sheet.spells.map((spell) =>
					spell.id === spellId ? { ...spell, ...patch } : spell,
				),
			},
		}));
	}

	removeSpell(participantId: string, spellId: string) {
		this.updateParticipantSheet(participantId, (participant) => ({
			...participant,
			sheet: {
				...participant.sheet,
				spells: participant.sheet.spells.filter((spell) => spell.id !== spellId),
			},
		}));
	}

	getAbilityDraft(id: string): AbilityDraft {
		return (
			this.abilityDrafts()[id] ?? {
				name: '',
				description: '',
				recoveryType: 'manual',
				maxUses: 1,
				cooldownValue: 1,
				rechargeOn: '5,6',
			}
		);
	}

	setAbilityDraft(id: string, patch: Partial<AbilityDraft>) {
		this.abilityDrafts.update((drafts) => ({
			...drafts,
			[id]: { ...this.getAbilityDraft(id), ...patch },
		}));
	}

	addSpecialAbility(participantId: string) {
		const draft = this.getAbilityDraft(participantId);
		if (!draft.name.trim())
			return this.showToast({ type: 'warn', text: 'Defina um nome para a habilidade.' });
		const ability = this.abilityFromDraft(draft);
		this.updateParticipantSheet(participantId, (participant) => ({
			...participant,
			sheet: {
				...participant.sheet,
				specialAbilities: [...participant.sheet.specialAbilities, ability],
			},
		}));
		this.setAbilityDraft(participantId, { name: '', description: '', recoveryType: 'manual' });
	}

	updateSpecialAbility(
		participantId: string,
		abilityId: string,
		patch: Partial<CreatureSpecialAbility>,
	) {
		this.updateParticipantSheet(participantId, (participant) => ({
			...participant,
			sheet: {
				...participant.sheet,
				specialAbilities: participant.sheet.specialAbilities.map((ability) =>
					ability.id === abilityId ? { ...ability, ...patch } : ability,
				),
			},
		}));
	}

	removeSpecialAbility(participantId: string, abilityId: string) {
		this.updateParticipantSheet(participantId, (participant) => ({
			...participant,
			sheet: {
				...participant.sheet,
				specialAbilities: participant.sheet.specialAbilities.filter(
					(ability) => ability.id !== abilityId,
				),
			},
		}));
	}

	parseRechargeOnInput(value: string): number[] {
		return [
			...new Set(
				value
					.split(',')
					.map((item) => this.nonNegativeInt(item))
					.filter((item) => item > 0),
			),
		];
	}

	setLairActionDraft(patch: Partial<LairActionDraft>) {
		this.lairActionDraft.update((draft) => ({ ...draft, ...patch }));
	}

	addLairAction() {
		const draft = this.lairActionDraft();
		if (!draft.name.trim())
			return this.showToast({ type: 'warn', text: 'Defina um nome para a lair action.' });
		const action: EncounterLairAction = {
			id: crypto.randomUUID(),
			name: draft.name.trim(),
			description: draft.description.trim() || undefined,
			initiative: this.parseNullableNumber(draft.initiative) ?? 20,
			active: true,
			frequency: draft.frequency,
			...(draft.frequency === 'cooldown-rounds'
				? { cooldownRounds: Math.max(1, this.nonNegativeInt(draft.cooldownRounds)) }
				: {}),
		};
		this.updateEncounter({ lairActions: [...this.encounter().lairActions, action] });
		this.lairActionDraft.set(this.createLairActionDraft());
	}

	updateLairAction(id: string, patch: Partial<EncounterLairAction>) {
		this.updateEncounter({
			lairActions: this.encounter().lairActions.map((action) =>
				action.id === id ? { ...action, ...patch } : action,
			),
		});
	}

	removeLairAction(id: string) {
		this.updateEncounter({
			lairActions: this.encounter().lairActions.filter((action) => action.id !== id),
		});
	}

	setTrapDraft(patch: Partial<TrapDraft>) {
		this.trapDraft.update((draft) => ({ ...draft, ...patch }));
	}

	addTrap() {
		const draft = this.trapDraft();
		if (!draft.name.trim())
			return this.showToast({ type: 'warn', text: 'Defina um nome para a armadilha.' });
		const trap: EncounterTrap = {
			id: crypto.randomUUID(),
			name: draft.name.trim(),
			description: draft.description.trim() || undefined,
			triggerType: draft.triggerType,
			...(draft.triggerType === 'initiative'
				? { initiative: this.parseNullableNumber(draft.initiative) ?? 20 }
				: {}),
			active: true,
			frequency: draft.frequency,
			...(draft.frequency === 'cooldown-rounds'
				? { cooldownRounds: Math.max(1, this.nonNegativeInt(draft.cooldownRounds)) }
				: {}),
		};
		this.updateEncounter({ traps: [...this.encounter().traps, trap] });
		this.trapDraft.set(this.createTrapDraft());
	}

	updateTrap(id: string, patch: Partial<EncounterTrap>) {
		this.updateEncounter({
			traps: this.encounter().traps.map((trap) => (trap.id === id ? { ...trap, ...patch } : trap)),
		});
	}

	removeTrap(id: string) {
		this.updateEncounter({ traps: this.encounter().traps.filter((trap) => trap.id !== id) });
	}

	save() {
		const result = this.persistEncounter();
		if (!result) return;
		if (result.created) {
			this.router.navigate(['/home/encounter-builder', result.encounter.id]);
			return;
		}
		this.showToast({ type: 'success', text: 'Encounter atualizado.' });
	}

	saveAndStartBattle() {
		const initiatives = Object.fromEntries(
			this.participants().map((participant) => [
				participant.id,
				participant.initiative == null ? '' : String(participant.initiative),
			]),
		);
		this.initiativeDrafts.set(initiatives);
		this.initiativeTieBreakerDrafts.set(this.automaticTieBreakers(initiatives, {}));
		this.initiativeSetupOpen.set(true);
	}

	cancelInitiativeSetup() {
		this.initiativeSetupOpen.set(false);
		this.initiativeTieBreakerDrafts.set({});
	}

	setInitiativeDraft(participantId: string, value: string) {
		this.initiativeDrafts.update((drafts) => {
			const next = { ...drafts, [participantId]: value };
			this.initiativeTieBreakerDrafts.update((tieBreakers) =>
				this.automaticTieBreakers(next, tieBreakers),
			);
			return next;
		});
	}

	setInitiativeTieBreakerDraft(participantId: string, value: string) {
		this.initiativeTieBreakerDrafts.update((drafts) => ({ ...drafts, [participantId]: value }));
	}

	isInitiativeTied(participantId: string): boolean {
		const initiative = this.parseNullableNumber(this.initiativeDrafts()[participantId]);
		return (
			initiative != null &&
			this.participants().filter(
				(participant) =>
					this.parseNullableNumber(this.initiativeDrafts()[participant.id]) === initiative,
			).length > 1
		);
	}

	initiativeTieLabel(participantId: string): string | null {
		if (!this.isInitiativeTied(participantId)) return null;
		const tied = this.participants().filter(
			(participant) =>
				this.parseNullableNumber(this.initiativeDrafts()[participant.id]) ===
				this.parseNullableNumber(this.initiativeDrafts()[participantId]),
		);
		const values = tied.map((participant) =>
			this.parseNullableNumber(this.initiativeTieBreakerDrafts()[participant.id]),
		);
		return values.every((value) => value != null) && new Set(values).size === values.length
			? 'Empate resolvido por DES'
			: 'Empate';
	}

	initiativeModifier(participant: EncounterParticipant): string {
		const modifier = abilityModifier(participant.sheet.abilityScores?.dex) ?? 0;
		return `${modifier >= 0 ? '+' : ''}${modifier}`;
	}

	confirmInitiativeSetup() {
		const initiativeOverrides: Record<string, number> = {};
		const initiativeTieBreakerOverrides: Record<string, number> = {};
		const participants = this.participants().map((participant) => {
			const initiative = this.parseNullableNumber(this.initiativeDrafts()[participant.id]);
			if (initiative != null) initiativeOverrides[participant.id] = initiative;
			const tieBreaker = this.parseNullableNumber(this.initiativeTieBreakerDrafts()[participant.id]);
			if (tieBreaker != null) initiativeTieBreakerOverrides[participant.id] = tieBreaker;
			return { ...participant, initiative };
		});
		this.updateEncounter({ participants });
		const result = this.persistEncounter();
		if (!result) return;
		const prepared = this.battleStorage.getOrCreateBattleFromEncounter(result.encounter, {
			initiativeOverrides,
			initiativeTieBreakerOverrides,
		});
		let battle =
			prepared.kind === 'existing' && prepared.battle.status === 'paused'
				? (this.battleStorage.resumeBattleEncounter(prepared.battle.id) ?? prepared.battle)
				: prepared.battle;
		this.initiativeSetupOpen.set(false);
		this.initiativeTieBreakerDrafts.set({});
		this.router.navigate(['/home/battle-tracker', battle.id]);
	}

	private addCopies(
		sheet: CreatureSheet,
		category: CreatureCategory,
		quantity: number,
		sourceSheetId?: string,
		initiative?: number | null,
	) {
		const participants = Array.from(
			{ length: quantity },
			() =>
				({
					id: crypto.randomUUID(),
					sourceSheetId,
					name: sheet.name,
					category,
					initiative: initiative ?? null,
					sheet: structuredClone(sheet),
				}) satisfies EncounterParticipant,
		);
		this.updateEncounter({ participants: [...this.encounter().participants, ...participants] });
	}


	private automaticTieBreakers(
		initiatives: Record<string, string>,
		current: Record<string, string>,
	): Record<string, string> {
		return Object.fromEntries(
			this.participants().flatMap((participant) => {
				const initiative = this.parseNullableNumber(initiatives[participant.id]);
				const tied =
					initiative != null &&
					this.participants().filter(
						(candidate) => this.parseNullableNumber(initiatives[candidate.id]) === initiative,
					).length > 1;
				if (!tied) return [];
				const tieBreaker = current[participant.id] ?? participant.sheet.abilityScores?.dex;
				return Number.isFinite(Number(tieBreaker))
					? [[participant.id, String(tieBreaker)] as const]
					: [];
			}),
		);
	}

	private bestiaryFilterValues(
		value: (monster: CompendiumBestiaryMonsterIndexEntry) => string | undefined,
	): string[] {
		return [
			...new Set(
				this.bestiaryMonsters()
					.map(value)
					.filter((item): item is string => !!item),
			),
		].sort((left, right) => left.localeCompare(right));
	}

	private contextualSheetsFor(
		entries: ResolvedContextualContent[],
		seen: Set<string>,
	): ContextualSheetSuggestion[] {
		return entries.flatMap((entry) => {
			if (entry.kind !== 'sheet') return [];
			const sheet = entry.content as SavedSheetInterface;
			if (sheet.category !== 'monster' && sheet.category !== 'npc') return [];
			if (seen.has(sheet.id)) return [];
			seen.add(sheet.id);
			return [{ ...entry, content: sheet }];
		});
	}

	private persistEncounter(): { encounter: SavedEncounter; created: boolean } | null {
		try {
			const current = structuredClone(this.encounter());
			if (!this.savedId()) {
				const { id: _id, title, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = current;
				const encounter = this.ls.createEncounter(title, draft);
				this.savedId.set(encounter.id);
				this.encounter.set(encounter);
				this.markSaved();
				return { encounter, created: true };
			}
			const encounter = this.ls.updateEncounter(this.savedId()!, current);
			if (!encounter) {
				this.showToast({ type: 'error', text: 'Encounter não encontrado para salvar.' });
				return null;
			}
			this.encounter.set(encounter);
			this.markSaved();
			return { encounter, created: false };
		} catch {
			this.showToast({ type: 'error', text: 'Não foi possível salvar o encounter.' });
			return null;
		}
	}

	private async handleFiveEToolsNavigationImport() {
		const navigationState =
			(this.router.getCurrentNavigation()?.extras.state as
				| {
						fiveEToolsImport?: { entityId?: string };
						compendiumMonster?: { source?: string; name?: string };
				  }
				| undefined) ?? history.state;
		const compendiumMonster = navigationState?.compendiumMonster;
		if (compendiumMonster?.source && compendiumMonster.name) {
			window.history.replaceState({ ...history.state, compendiumMonster: undefined }, '');
			try {
				const monster = await this.bestiary.getMonster(
					compendiumMonster.source,
					compendiumMonster.name,
				);
				if (!monster) throw new Error('Criatura não encontrada no bestiário local.');
				this.addCopies(this.compendiumAdapter.toCreatureSheet(monster), 'monster', 1);
				this.showToast({ type: 'success', text: `${monster.name} adicionado do bestiário.` });
			} catch (error) {
				this.showToast({
					type: 'error',
					text: error instanceof Error ? error.message : 'Erro ao importar criatura.',
				});
			}
			return;
		}
		const state = navigationState?.fiveEToolsImport;
		if (!state?.entityId) return;
		window.history.replaceState({ ...history.state, fiveEToolsImport: undefined }, '');
		try {
			const file = await this.fiveETools.loadLocalHomebrewJson();
			const entity = this.fiveETools.getEntityById(file, state.entityId);
			if (!entity) throw new Error('Item 5etools não encontrado no arquivo carregado.');
			if (state.entityId.startsWith('monster::')) {
				this.addCopies(this.fiveETools.convertMonsterToCreature(entity as any), 'monster', 1);
			} else {
				this.updateEncounter({
					traps: [
						...this.encounter().traps,
						this.fiveETools.convertTrapToEncounterTrap(entity as any),
					],
				});
			}
			this.showToast({ type: 'success', text: `${entity.name} adicionado ao encounter.` });
		} catch (error) {
			this.showToast({
				type: 'error',
				text: error instanceof Error ? error.message : 'Erro ao importar item 5etools.',
			});
		}
	}

	private updateEncounter(patch: Partial<Encounter>) {
		this.encounter.update((encounter) => ({ ...encounter, ...patch }));
	}

	private createDefaultEncounter(): Encounter {
		const now = Date.now();
		return {
			schemaVersion: 1,
			type: 'dnd-dm-helper-encounter',
			id: crypto.randomUUID(),
			title: 'Untitled Encounter',
			createdAt: now,
			updatedAt: now,
			tags: [],
			participants: [],
			lairActions: [],
			traps: [],
		};
	}

	private createParticipantDraft(): ParticipantDraft {
		return {
			name: '',
			initiative: null,
			hp: null,
			armorClass: '',
			category: 'monster',
			quantity: 1,
		};
	}

	private createLairActionDraft(): LairActionDraft {
		return {
			name: '',
			description: '',
			initiative: '20',
			frequency: 'every-round',
			cooldownRounds: '1',
		};
	}

	private createTrapDraft(): TrapDraft {
		return {
			name: '',
			description: '',
			triggerType: 'manual',
			initiative: '',
			frequency: 'manual',
			cooldownRounds: '1',
		};
	}

	private abilityFromDraft(draft: AbilityDraft): CreatureSpecialAbility {
		return {
			id: crypto.randomUUID(),
			name: draft.name.trim(),
			description: draft.description.trim() || undefined,
			recoveryType: draft.recoveryType,
			...(draft.recoveryType === 'uses-per-day' ||
			draft.recoveryType === 'uses-per-combat' ||
			draft.recoveryType === 'short-rest' ||
			draft.recoveryType === 'long-rest'
				? { maxUses: Math.max(1, this.nonNegativeInt(draft.maxUses)) }
				: {}),
			...(draft.recoveryType === 'turn-cooldown'
				? { cooldownTurns: Math.max(1, this.nonNegativeInt(draft.cooldownValue)) }
				: {}),
			...(draft.recoveryType === 'round-cooldown'
				? { cooldownRounds: Math.max(1, this.nonNegativeInt(draft.cooldownValue)) }
				: {}),
			...(draft.recoveryType === 'dice-recharge'
				? { rechargeDice: 'd6' as const, rechargeOn: this.parseRechargeOnInput(draft.rechargeOn) }
				: {}),
		};
	}

	private parseNullableNumber(value: unknown): number | null {
		if (value === '' || value == null) return null;
		const numeric = Number(value);
		return Number.isFinite(numeric) ? numeric : null;
	}

	private nonNegativeInt(value: unknown): number {
		const numeric = Math.floor(Number(value));
		return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
	}

	private quantity(value: unknown): number {
		return Math.max(1, this.nonNegativeInt(value) || 1);
	}

	private editorSnapshot() {
		return JSON.stringify({
			encounter: this.encounter(),
			draft: this.draft(),
			lair: this.lairActionDraft(),
			trap: this.trapDraft(),
		});
	}

	private markSaved() {
		this.savedSnapshot.set(this.editorSnapshot());
	}

	private refreshHomebrewSheets() {
		this.homebrewSheets.set(this.ls.listSheets());
	}

	private resolvePendingNavigation(allowed: boolean) {
		const resolve = this.pendingNavigationResolver;
		this.pendingNavigationResolver = null;
		resolve?.(allowed);
	}

	private showToast(toast: { type: 'success' | 'error' | 'warn'; text: string }, ms = 2200) {
		if (this.toastTimer) window.clearTimeout(this.toastTimer);
		this.toast.set(toast);
		this.toastTimer = window.setTimeout(() => this.toast.set(null), ms);
	}
}

function uniqueLocationRelations(refs: ContentLocationRelation[]): ContentLocationRelation[] {
	const seen = new Set<string>();
	return refs.filter((ref) => {
		const key = `${ref.scopeType}:${ref.scopeId}:${ref.relation}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function uniqueOrganizationRelations(refs: ContentOrganizationRelation[]): ContentOrganizationRelation[] {
	const seen = new Set<string>();
	return refs.filter((ref) => {
		const key = `${ref.organizationId}:${ref.relation}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export const canDeactivateEncounterBuilder: CanDeactivateFn<EncounterBuilder> = (component) =>
	component.canDeactivate();
