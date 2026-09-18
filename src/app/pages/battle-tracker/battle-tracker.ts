import { CommonModule } from '@angular/common';
import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideBookOpen } from '@lucide/angular';
import { AppNativeSelectDirective } from '../../components/app-select/app-native-select';
import { AppSelectComponent } from '../../components/app-select/app-select';
import { BattleDamageControlComponent } from '../../components/battle-damage-control/battle-damage-control';
import { CreatureStatBlockComponent } from '../../components/creature-stat-block/creature-stat-block';
import { SpellQuickViewComponent } from '../../components/spell-quick-view/spell-quick-view';
import { ConditionReferenceTriggerDirective, DefenseReferenceTriggerDirective, SpellReferenceTriggerDirective } from '../../components/reference-overlay/reference-trigger';
import { ReferenceOverlayService } from '../../components/reference-overlay/reference-overlay-service';
import { DialogFocusDirective } from '../../directives/dialog-focus';
import type {
	BattleCombatant,
	BattleCombatantSide,
	BattleConcentrationCheckPendingAction,
	BattleCondition,
	BattleConditionDurationType,
	BattleEncounter,
	BattleLairAction,
	BattlePendingAction,
	BattleSpecialAbility,
	BattleSpellSlotLevel,
	BattleTrap,
	BattleUpcomingEvent,
} from '../../models/battle-encounter-model';
import type { CreatureCategory, CreatureSheet } from '../../models/creature-sheet-model';
import type { ResolvedSpellReference } from '../../models/spell-reference-model';
import {
	conditionImmunityMatches,
	conditionReferenceFor,
	type ConditionReference,
} from '../../models/condition-reference-model';
import {
	BattleEncounterService,
	type CreateBattleLairActionInput,
	type CreateBattleTrapInput,
	DEFAULT_BATTLE_CONDITIONS,
} from '../../services/battle-encounter-service/battle-encounter-service';
import { BattleUpcomingEventsService } from '../../services/battle-upcoming-events-service/battle-upcoming-events-service';
import { BattleEncounterStorageService } from '../../services/battle-encounter-storage-service/battle-encounter-storage-service';
import {
	LocalStorageService,
	type SavedSheetInterface,
} from '../../services/local-storage-service/local-storage-service';
import { CreatureTemplateService } from '../../services/creature-template-service/creature-template-service';
import type { CompendiumBestiaryMonsterIndexEntry } from '../../models/compendium-bestiary-model';
import { CompendiumBestiaryRepositoryService } from '../../services/compendium-bestiary-repository-service/compendium-bestiary-repository-service';
import { CompendiumCreatureAdapterService } from '../../services/compendium-creature-adapter-service/compendium-creature-adapter-service';
import { SpellReferenceResolverService } from '../../services/spell-reference-resolver-service/spell-reference-resolver-service';

type ConditionDurationMode = 'manual' | 'next-turn-end' | 'turns' | 'rounds';

type ConditionDraft = {
	preset: string;
	customLabel: string;
	durationMode: ConditionDurationMode;
	durationValue: string;
};

type LairActionDraft = {
	name: string;
	description: string;
	initiative: string;
	frequency: CreateBattleLairActionInput['frequency'];
	cooldownRounds: string;
};

type TrapDraft = {
	name: string;
	description: string;
	triggerType: CreateBattleTrapInput['triggerType'];
	initiative: string;
	frequency: CreateBattleTrapInput['frequency'];
	cooldownRounds: string;
};

type AddCombatantDraft = {
	mode: 'manual' | 'homebrew' | 'compendium';
	sheetId: string;
	name: string;
	side: BattleCombatantSide;
	maxHp: string;
	armorClass: string;
	initiative: string;
};

type ConfirmModalState = {
	title: string;
	description: string;
	confirmLabel: string;
	action: 'complete-battle' | 'remove-combatant';
	tone: 'success' | 'danger';
	combatantId?: string;
};

@Component({
	selector: 'app-battle-tracker',
	standalone: true,
	imports: [
		AppNativeSelectDirective,
		AppSelectComponent,
		BattleDamageControlComponent,
		CommonModule,
		CreatureStatBlockComponent,
		DialogFocusDirective,
		FormsModule,
		LucideBookOpen,
		SpellQuickViewComponent,
		ConditionReferenceTriggerDirective,
		DefenseReferenceTriggerDirective,
		SpellReferenceTriggerDirective,
	],
	templateUrl: './battle-tracker.html',
})
export class BattleTrackerPage {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly battleStorage = inject(BattleEncounterStorageService);
	private readonly battleService = inject(BattleEncounterService);
	private readonly battleUpcomingEventsService = inject(BattleUpcomingEventsService);
	private readonly localStorageService = inject(LocalStorageService);
	private readonly bestiary = inject(CompendiumBestiaryRepositoryService);
	private readonly compendiumAdapter = inject(CompendiumCreatureAdapterService);
	private readonly creatureTemplateService = inject(CreatureTemplateService);
	private readonly spellResolver = inject(SpellReferenceResolverService);
	private readonly referenceOverlay = inject(ReferenceOverlayService);

	private readonly battleId = this.route.snapshot.paramMap.get('battleId');

	readonly battle = signal<BattleEncounter | null>(
		this.battleId ? this.battleStorage.getBattleEncounterById(this.battleId) : null,
	);
	readonly now = signal(Date.now());
	readonly damageDrafts = signal<Record<string, string>>({});
	readonly damageTypeDrafts = signal<Record<string, string>>({});
	readonly healingDrafts = signal<Record<string, string>>({});
	readonly conditionDrafts = signal<Record<string, ConditionDraft>>({});
	readonly lairActionDraft = signal<LairActionDraft>(this.createLairActionDraft());
	readonly trapDraft = signal<TrapDraft>(this.createTrapDraft());
	readonly initiativeDrafts = signal<Record<string, string>>({});
	readonly toast = signal<{ type: 'success' | 'error'; text: string } | null>(null);
	readonly confirmModal = signal<ConfirmModalState | null>(null);
	readonly addCombatantModalOpen = signal(false);
	readonly addCombatantDraft = signal<AddCombatantDraft>(this.createAddCombatantDraft());
	readonly selectedImportedCreature = signal<CreatureSheet | null>(null);
	readonly quickSpell = signal<ResolvedSpellReference | null>(null);
	readonly conditionReference = signal<ConditionReference | null>(null);
	readonly referenceSheetViewer = signal<{
		creature: CreatureSheet;
		category?: CreatureCategory;
		combatant: BattleCombatant;
	} | null>(null);
	readonly homebrewSheets = signal<SavedSheetInterface[]>(this.localStorageService.listSheets());
	readonly homebrewSearch = signal('');
	readonly filteredHomebrewSheets = computed(() => {
		const query = this.homebrewSearch().trim().toLocaleLowerCase();
		if (!query) return this.homebrewSheets();
		return this.homebrewSheets().filter((sheet) =>
			`${sheet.title} ${sheet.data.name} ${sheet.category} ${sheet.source} ${sheet.data.origin ?? ''} ${(sheet.data.tags ?? sheet.tags).join(' ')}`
				.toLocaleLowerCase()
				.includes(query),
		);
	});
	readonly bestiaryMonsters = signal<CompendiumBestiaryMonsterIndexEntry[]>([]);
	readonly bestiaryLoading = signal(false);
	readonly bestiarySearch = signal('');
	readonly cockpitAbilitiesExpanded = signal(false);
	readonly cockpitDetailsOpen = signal(true);
	readonly filteredBestiaryMonsters = computed(() => {
		const query = this.bestiarySearch().trim().toLowerCase();
		if (!query) return this.bestiaryMonsters();
		return this.bestiaryMonsters().filter(
			(monster) =>
				monster.name.toLowerCase().includes(query) ||
				monster.aliases.join(' ').toLowerCase().includes(query),
		);
	});

	readonly conditionOptions = DEFAULT_BATTLE_CONDITIONS.filter(
		(option) => option.name !== 'concentrating',
	).map((option) => ({ ...option, value: option.name }));
	readonly cockpitConditionOptions = this.conditionOptions.filter((option) => option.name !== 'custom');
	readonly combatants = computed(() => [
		...(this.battle()?.combatants ?? []),
		...(this.battle()?.pendingCombatants ?? []),
	]);
	readonly combatOrder = computed(() => this.battle()?.combatants ?? []);
	readonly currentCombatant = computed(() => {
		const battle = this.battle();
		return battle ? this.battleService.getCurrentCombatant(battle) : null;
	});
	readonly currentSpecialTurn = computed(() => {
		const battle = this.battle();
		return battle ? this.battleService.getCurrentSpecialTurn(battle) : null;
	});
	readonly selectedCombatantId = signal<string | null>(null);
	readonly currentTurnElapsedSeconds = computed(() => {
		const battle = this.battle();
		if (!battle) return 0;
		return this.battleService.getCurrentTurnElapsedSeconds(battle, new Date(this.now()));
	});
	readonly turnHistory = computed(() => this.battle()?.turnHistory ?? []);
	readonly undoTurnTarget = computed(() => this.battle()?.turnSnapshots?.at(-1) ?? null);
	readonly upcomingEvents = computed<BattleUpcomingEvent[]>(() => {
		const battle = this.battle();
		if (!battle) return [];
		return this.battleUpcomingEventsService.buildUpcomingBattleEvents(battle, 12);
	});
	readonly nextEnvironmentEvent = computed<BattleUpcomingEvent | null>(
		() =>
			this.upcomingEvents().find(
				(event) => event.type === 'lair-action' || event.type === 'trap',
			) ?? null,
	);
	readonly pendingDiceRechargeAbilities = computed<BattleSpecialAbility[]>(() => {
		const battle = this.battle();
		if (!battle || battle.status !== 'active') return [];
		return this.battleService.getPendingDiceRechargeAbilities(battle);
	});
	readonly pendingActions = computed<BattlePendingAction[]>(() => {
		const battle = this.battle();
		return battle ? this.battleService.getPendingActions(battle) : [];
	});
	readonly cockpitAbilities = computed<BattleSpecialAbility[]>(() => {
		const combatant = this.currentCombatant();
		if (!combatant) return [];
		const pendingAbilityIds = new Set(
			this.pendingDiceRechargeAbilities().map((ability) => ability.id),
		);
		return [...combatant.specialAbilities].sort(
				(left, right) =>
					Number(pendingAbilityIds.has(right.id)) - Number(pendingAbilityIds.has(left.id)),
			);
	});
	readonly visibleCockpitAbilities = computed(() =>
		this.cockpitAbilitiesExpanded() ? this.cockpitAbilities() : this.cockpitAbilities().slice(0, 3),
	);
	readonly hiddenCockpitAbilityCount = computed(() =>
		Math.max(0, this.cockpitAbilities().length - this.visibleCockpitAbilities().length),
	);
	readonly rechargeDieResults = [1, 2, 3, 4, 5, 6];
	readonly deathSaveDieResults = Array.from({ length: 20 }, (_, index) => index + 1);
	readonly deathSaveMarkers = [0, 1, 2];
	readonly battleStatusLabel = computed(() => {
		const status = this.battle()?.status;
		if (status === 'paused') return 'Pausada';
		if (status === 'completed') return 'Concluída';
		return 'Ativa';
	});
	private modalTrigger: HTMLElement | null = null;

	constructor() {
		effect((onCleanup) => {
			const battle = this.battle();
			if (!battle || battle.status !== 'active' || !battle.turnStartedAt) return;

			const timer = window.setInterval(() => this.now.set(Date.now()), 1000);
			onCleanup(() => window.clearInterval(timer));
		});

		effect(() => {
			const battle = this.battle();
			if (!battle) return;
			this.battleStorage.saveBattleEncounter(battle);
		});
	}

	@HostListener('document:keydown', ['$event'])
	onDocumentKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (this.addCombatantModalOpen()) {
				this.closeAddCombatantModal();
				return;
			}
			if (this.confirmModal()) this.closeConfirmModal();
			return;
		}

		if (event.key !== 'Tab' || (!this.addCombatantModalOpen() && !this.confirmModal())) return;
		const dialog = document.querySelector<HTMLElement>('[data-battle-modal]');
		if (!dialog) return;
		const focusable = Array.from(
			dialog.querySelectorAll<HTMLElement>(
				'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]',
			),
		);
		if (!focusable.length) return;

		const first = focusable[0];
		const last = focusable.at(-1)!;
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	goBackToHub() {
		this.router.navigate(['/home']);
	}

	pauseBattle() {
		this.updateBattle((battle) => this.battleService.pauseBattle(battle));
		this.showToast('success', 'Batalha pausada.');
	}

	resumeBattle() {
		this.updateBattle((battle) => this.battleService.resumeBattle(battle));
		this.showToast('success', 'Batalha retomada.');
	}

	openCompleteBattleModal() {
		this.captureModalTrigger();
		this.confirmModal.set({
			title: 'Concluir batalha?',
			description: 'O histórico será mantido e essa batalha deixará de aparecer como ativa.',
			confirmLabel: 'Concluir batalha',
			action: 'complete-battle',
			tone: 'success',
		});
		this.focusModal();
	}

	closeConfirmModal() {
		this.confirmModal.set(null);
		this.restoreModalTrigger();
	}

	confirmModalAction() {
		const modal = this.confirmModal();
		if (!modal) return;

		if (modal.action === 'complete-battle') {
			this.updateBattle((battle) => this.battleService.completeBattle(battle));
			this.showToast('success', 'Batalha concluída.');
		}

		if (modal.action === 'remove-combatant' && modal.combatantId) {
			this.updateBattle((battle) => this.battleService.removeCombatant(battle, modal.combatantId!));
			this.showToast('success', 'Combatente removido.');
		}

		this.closeConfirmModal();
	}

	nextTurn() {
		this.updateBattle((battle) => this.battleService.advanceTurn(battle));
	}

	undoTurn() {
		const target = this.undoTurnTarget();
		if (!target) return;
		this.updateBattle((battle) => this.battleService.undoTurn(battle));
		this.showToast(
			'success',
			`Turno desfeito - voltou para ${target.combatantName || 'a iniciativa'}, Round ${target.round}.`,
		);
	}

	setCombatantSide(combatantId: string, side: BattleCombatantSide) {
		this.updateBattle((battle) =>
			this.battleService.updateCombatant(battle, combatantId, { side }),
		);
	}

	setCurrentHp(combatantId: string, value: unknown) {
		this.updateBattle((battle) =>
			this.battleService.updateCombatantHp(battle, combatantId, {
				currentHp: this.parseNonNegativeInt(value),
			}),
		);
	}

	setMaxHp(combatantId: string, value: unknown) {
		this.updateBattle((battle) =>
			this.battleService.updateCombatantHp(battle, combatantId, {
				maxHp: this.parseNonNegativeInt(value),
			}),
		);
	}

	setTemporaryHp(combatantId: string, value: unknown) {
		this.updateBattle((battle) =>
			this.battleService.updateCombatantHp(battle, combatantId, {
				temporaryHp: this.parseNonNegativeInt(value),
			}),
		);
	}

	toggleDefeated(combatantId: string, checked: boolean) {
		this.updateBattle((battle) =>
			this.battleService.setCombatantDefeated(battle, combatantId, checked),
		);
	}

	toggleCombatantInspector(combatantId: string) {
		this.selectedCombatantId.update((selectedId) =>
			selectedId === combatantId ? null : combatantId,
		);
	}

	openReferenceSheetViewer(combatant: BattleCombatant) {
		this.captureModalTrigger();
		const savedSheet = this.sourceSheetForCombatant(combatant);
		this.referenceSheetViewer.set({
			creature: this.referenceSheetForCombatant(combatant),
			category: savedSheet?.category ?? combatant.category,
			combatant,
		});
		this.focusModal();
	}

	goToCurrentCombatantSheet() {
		const combatant = this.currentCombatant();
		if (!combatant) return;
		this.selectedCombatantId.set(combatant.id);
		this.cockpitDetailsOpen.set(false);
		requestAnimationFrame(() => {
			requestAnimationFrame(() =>
				document
					.getElementById(`battle-combatant-${combatant.id}`)
					?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
			);
		});
	}

	setCockpitDetailsOpen(event: Event) {
		this.cockpitDetailsOpen.set((event.target as HTMLDetailsElement).open);
	}

	closeReferenceSheetViewer(restoreFocus = true) {
		this.referenceSheetViewer.set(null);
		if (restoreFocus) this.restoreModalTrigger();
	}

	applyDamage(combatantId: string) {
		const amount = this.parseNonNegativeInt(this.damageDrafts()[combatantId]);
		this.applyDamageAmount(combatantId, amount);
	}

	applyDamageAmount(combatantId: string, amount: number) {
		if (!Number.isFinite(amount) || amount < 0) return;
		if (amount) this.updateBattle((battle) => this.battleService.applyDamage(battle, combatantId, amount));
		this.setDamageDraft(combatantId, '');
	}

	applyHealing(combatantId: string) {
		const amount = this.parseNonNegativeInt(this.healingDrafts()[combatantId]);
		if (!amount) return;

		this.updateBattle((battle) => this.battleService.applyHealing(battle, combatantId, amount));
		this.setHealingDraft(combatantId, '');
	}

	setDamageDraft(combatantId: string, value: string) {
		this.damageDrafts.update((drafts) => ({ ...drafts, [combatantId]: value }));
	}

	setDamageTypeDraft(combatantId: string, value: string) {
		this.damageTypeDrafts.update((drafts) => ({ ...drafts, [combatantId]: value }));
	}

	setHealingDraft(combatantId: string, value: string) {
		this.healingDrafts.update((drafts) => ({ ...drafts, [combatantId]: value }));
	}

	getConditionDraft(combatantId: string): ConditionDraft {
		return (
			this.conditionDrafts()[combatantId] ?? {
				preset: this.conditionOptions[0]?.name ?? 'prone',
				customLabel: '',
				durationMode: 'manual',
				durationValue: '1',
			}
		);
	}

	setConditionDraft(combatantId: string, patch: Partial<ConditionDraft>) {
		this.conditionDrafts.update((drafts) => ({
			...drafts,
			[combatantId]: {
				...this.getConditionDraft(combatantId),
				...patch,
			},
		}));
	}

	conditionImmunityWarning(combatantId: string): string | null {
		const combatant = this.combatants().find((item) => item.id === combatantId);
		if (!combatant) return null;
		const draft = this.getConditionDraft(combatantId);
		const preset = this.conditionOptions.find((option) => option.name === draft.preset);
		if (!preset || !conditionImmunityMatches(combatant.conditionImmunities, preset.name, preset.label)) {
			return null;
		}
		return `Imune a ${preset.label}`;
	}

	addCondition(combatantId: string) {
		const battle = this.battle();
		if (!battle) return;

		const draft = this.getConditionDraft(combatantId);
		const preset = this.conditionOptions.find((option) => option.name === draft.preset);
		const customLabel = draft.customLabel.trim();
		const label = (customLabel || preset?.label || '').trim();

		if (!label) {
			this.showToast('error', 'Informe o nome da condição.');
			return;
		}

		const durationValue = Math.max(1, this.parseNonNegativeInt(draft.durationValue) || 1);
		const conditionInput = (() => {
			if (draft.durationMode === 'next-turn-end') {
				const target = this.battleService.getPositionAfterTurns(battle, 1);
				return {
					name:
						preset?.name === 'custom'
							? this.slugify(label) || 'custom'
							: (preset?.name ?? 'custom'),
					label,
					description: preset?.description,
					durationType: 'until-end-of-turn' as BattleConditionDurationType,
					expiresAtRound: target.round,
					expiresAtTurnIndex: target.turnIndex,
					expiresAtTiming: 'end' as const,
				};
			}

			if (draft.durationMode === 'turns') {
				return {
					name:
						preset?.name === 'custom'
							? this.slugify(label) || 'custom'
							: (preset?.name ?? 'custom'),
					label,
					description: preset?.description,
					durationType: 'turns' as BattleConditionDurationType,
					durationTurns: durationValue,
				};
			}

			if (draft.durationMode === 'rounds') {
				return {
					name:
						preset?.name === 'custom'
							? this.slugify(label) || 'custom'
							: (preset?.name ?? 'custom'),
					label,
					description: preset?.description,
					durationType: 'rounds' as BattleConditionDurationType,
					durationRounds: durationValue,
				};
			}

			return {
				name:
					preset?.name === 'custom' ? this.slugify(label) || 'custom' : (preset?.name ?? 'custom'),
				label,
				description: preset?.description,
				durationType: 'manual' as BattleConditionDurationType,
			};
		})();

		this.updateBattle((current) =>
			this.battleService.addCondition(current, combatantId, conditionInput),
		);

		this.conditionDrafts.update((drafts) => ({
			...drafts,
			[combatantId]: {
				preset: this.conditionOptions[0]?.name ?? 'prone',
				customLabel: '',
				durationMode: 'manual',
				durationValue: '1',
			},
		}));
	}

	removeCondition(combatantId: string, conditionId: string) {
		this.updateBattle((battle) =>
			this.battleService.removeCondition(battle, combatantId, conditionId),
		);
	}

	openConditionReference(condition: BattleCondition) {
		this.referenceOverlay.openCondition(condition.name);
	}

	openFeatureConditionReference(name: string) {
		this.closeReferenceSheetViewer(false);
		this.referenceOverlay.openCondition(name);
	}

	startConcentration(combatantId: string) {
		this.updateBattle((battle) => this.battleService.startConcentration(battle, combatantId));
		this.showToast('success', 'Concentração iniciada.');
	}

	stopConcentration(combatantId: string) {
		this.updateBattle((battle) => this.battleService.stopConcentration(battle, combatantId));
		this.showToast('success', 'Concentração encerrada.');
	}

	setConcentration(combatantId: string, concentrating: boolean) {
		if (concentrating) this.startConcentration(combatantId);
		else this.stopConcentration(combatantId);
	}

	resolveConcentrationCheck(actionId: string, succeeded: boolean) {
		const battle = this.battle();
		if (!battle) return;
		const result = this.battleService.resolveConcentrationCheck(battle, actionId, succeeded);
		if (!result) return;

		this.battle.set(result.battle);
		this.showToast('success', result.succeeded ? 'Concentração mantida.' : 'Concentração perdida.');
	}

	startDeathSaves(combatantId: string) {
		this.updateBattle((battle) => this.battleService.startDeathSaves(battle, combatantId));
		this.showToast(
			'success',
			'Testes de morte iniciados. A primeira rolagem acontece no próximo turno.',
		);
	}

	recordDeathSaveResult(actionId: string, roll: number) {
		const battle = this.battle();
		if (!battle) return;
		const result = this.battleService.recordDeathSaveResult(battle, actionId, roll);
		if (!result) return;

		this.battle.set(result.battle);
		const labels: Record<string, string> = {
			success: 'sucesso',
			failure: 'falha',
			stable: 'estável',
			dead: 'morreu',
			'natural-20': 'recuperou-se com um 20 natural',
		};
		this.showToast(
			result.outcome === 'failure' || result.outcome === 'dead' ? 'error' : 'success',
			`${result.roll}: ${labels[result.outcome]}.`,
		);
	}

	addDeathSaveFailure(combatantId: string) {
		this.updateBattle((battle) => this.battleService.addDeathSaveFailures(battle, combatantId, 1));
		this.showToast('error', 'Falha em teste de morte adicionada.');
	}

	addDeathSaveSuccess(combatantId: string) {
		this.updateBattle((battle) => this.battleService.addDeathSaveSuccess(battle, combatantId));
		this.showToast('success', 'Sucesso em teste de morte adicionado.');
	}

	recoverFromDeathSaves(combatantId: string) {
		this.updateBattle((battle) => this.battleService.recoverFromDeathSaves(battle, combatantId));
		this.showToast('success', 'Estado de testes de morte corrigido.');
	}

	canUseDeathSaves(combatant: BattleCombatant): boolean {
		return this.battleService.canUseDeathSaves(combatant);
	}

	deathSaveStatusLabel(combatant: BattleCombatant): string | null {
		const deathSaves = combatant.deathSaves;
		if (!deathSaves) return null;
		if (deathSaves.status === 'stable') return 'Estável';
		if (deathSaves.status === 'dead') return 'Morto';
		return null;
	}

	isConcentrating(combatant: BattleCombatant): boolean {
		return combatant.conditions.some((condition) => condition.name === 'concentrating');
	}

	visibleConditions(combatant: BattleCombatant): BattleCondition[] {
		return combatant.conditions.filter((condition) => condition.name !== 'concentrating');
	}

	pendingConcentrationChecks(combatant: BattleCombatant): BattleConcentrationCheckPendingAction[] {
		return (this.battle()?.pendingActions ?? []).filter(
			(action): action is BattleConcentrationCheckPendingAction =>
				action.type === 'concentration-check' && action.combatantId === combatant.id,
		);
	}

	pendingActionCombatant(action: BattlePendingAction): BattleCombatant | null {
		return this.combatants().find((combatant) => combatant.id === action.combatantId) ?? null;
	}

	pendingActionCombatantName(action: BattlePendingAction): string {
		const combatant = this.pendingActionCombatant(action);
		return combatant?.displayName || combatant?.name || 'Combatente removido';
	}

	conditionDurationLabel(condition: BattleCondition): string {
		const battle = this.battle();
		if (!battle) return 'Sem duração';
		return this.battleService.describeConditionDuration(condition, battle);
	}

	setDmNotes(value: string) {
		this.updateBattle((battle) => this.battleService.updateBattleNotes(battle, value));
	}

	setPrivateNotes(combatantId: string, value: string) {
		this.updateBattle((battle) =>
			this.battleService.updateCombatantNotes(battle, combatantId, value),
		);
	}

	useAbility(combatantId: string, abilityId: string) {
		this.updateBattle((battle) =>
			this.battleService.useSpecialAbility(battle, combatantId, abilityId),
		);
	}

	resetAbility(combatantId: string, abilityId: string) {
		this.updateBattle((battle) =>
			this.battleService.resetSpecialAbility(battle, combatantId, abilityId),
		);
	}

	recordAbilityRecharge(combatantId: string, abilityId: string, roll: number) {
		const battle = this.battle();
		if (!battle) return;

		const ability = this.combatants()
			.find((combatant) => combatant.id === combatantId)
			?.specialAbilities.find((item) => item.id === abilityId);
		const result = this.battleService.recordSpecialAbilityRecharge(
			battle,
			combatantId,
			abilityId,
			roll,
		);
		if (!result) return;

		this.battle.set(result.battle);
		this.showToast(
			result.success ? 'success' : 'error',
			result.success
				? `${result.roll} - ${ability?.name ?? 'Habilidade'} recarregou.`
				: `${result.roll} - ${ability?.name ?? 'Habilidade'} continua em recarga.`,
		);
	}

	diceRechargeAttemptLabel(ability: BattleSpecialAbility): string | null {
		const battle = this.battle();
		return battle ? this.battleService.describeDiceRechargeAttempt(ability, battle) : null;
	}

	abilityStatusLabel(ability: BattleSpecialAbility): string {
		return this.battleService.describeAbilityStatus(ability);
	}

	abilityUsageLabel(ability: BattleSpecialAbility): string | null {
		return this.battleService.describeAbilityUsage(ability);
	}

	abilityRecoveryLabel(ability: BattleSpecialAbility): string {
		return this.battleService.describeAbilityRecovery(ability);
	}

	abilityRuleLabel(ability: BattleSpecialAbility): string | null {
		return this.battleService.describeAbilityRule(ability);
	}

	abilityLastUsedLabel(ability: BattleSpecialAbility): string | null {
		return this.battleService.describeAbilityLastUsed(ability);
	}

	abilityResetLabel(ability: BattleSpecialAbility): string {
		if (ability.recoveryType === 'short-rest') return 'Resetar usos';
		if (ability.recoveryType === 'long-rest') return 'Resetar usos';
		if (ability.recoveryType === 'uses-per-day') return 'Resetar usos';
		if (ability.recoveryType === 'uses-per-combat') return 'Resetar usos';
		if (ability.recoveryType === 'manual' && !ability.isAvailable) return 'Marcar disponível';
		return 'Resetar';
	}

	abilityUseLabel(ability: BattleSpecialAbility): string {
		if (ability.recoveryType === 'manual') return 'Marcar usado';
		return 'Usar';
	}

	canUseAbility(ability: BattleSpecialAbility): boolean {
		return ability.isAvailable;
	}

	setLairActionDraft(patch: Partial<LairActionDraft>) {
		this.lairActionDraft.update((draft) => ({ ...draft, ...patch }));
	}

	addLairAction() {
		const draft = this.lairActionDraft();
		if (!draft.name.trim()) {
			this.showToast('error', 'Informe o nome da lair action.');
			return;
		}

		this.updateBattle((battle) =>
			this.battleService.addLairAction(battle, {
				name: draft.name,
				description: draft.description,
				initiative: this.parseInitiativeInput(draft.initiative || '20'),
				frequency: draft.frequency,
				cooldownRounds:
					draft.frequency === 'cooldown-rounds'
						? Math.max(1, this.parseNonNegativeInt(draft.cooldownRounds) || 1)
						: undefined,
			}),
		);

		this.lairActionDraft.set(this.createLairActionDraft());
	}

	triggerLairAction(actionId: string) {
		this.updateBattle((battle) => this.battleService.triggerLairAction(battle, actionId));
	}

	toggleLairAction(actionId: string, active: boolean) {
		this.updateBattle((battle) =>
			this.battleService.updateLairActionActive(battle, actionId, active),
		);
	}

	removeLairAction(actionId: string) {
		this.updateBattle((battle) => this.battleService.removeLairAction(battle, actionId));
	}

	setTrapDraft(patch: Partial<TrapDraft>) {
		this.trapDraft.update((draft) => ({ ...draft, ...patch }));
	}

	addTrap() {
		const draft = this.trapDraft();
		if (!draft.name.trim()) {
			this.showToast('error', 'Informe o nome da armadilha.');
			return;
		}

		this.updateBattle((battle) =>
			this.battleService.addTrap(battle, {
				name: draft.name,
				description: draft.description,
				triggerType: draft.triggerType,
				initiative:
					draft.triggerType === 'initiative'
						? this.parseInitiativeInput(draft.initiative || '20')
						: undefined,
				frequency: draft.frequency,
				cooldownRounds:
					draft.frequency === 'cooldown-rounds'
						? Math.max(1, this.parseNonNegativeInt(draft.cooldownRounds) || 1)
						: undefined,
			}),
		);

		this.trapDraft.set(this.createTrapDraft());
	}

	triggerTrap(trapId: string) {
		this.updateBattle((battle) => this.battleService.triggerTrap(battle, trapId));
	}

	toggleTrap(trapId: string, active: boolean) {
		this.updateBattle((battle) => this.battleService.updateTrapActive(battle, trapId, active));
	}

	removeTrap(trapId: string) {
		this.updateBattle((battle) => this.battleService.removeTrap(battle, trapId));
	}

	eventActorLabel(event: BattleUpcomingEvent): string {
		if (event.type === 'lair-action') return 'Ação de covil';
		if (event.type === 'trap') return 'Armadilha';
		if (event.type === 'condition-expire') return 'Condição expira';
		if (event.type === 'ability-recharge') return 'Habilidade disponível';
		if (event.type === 'round-start') return 'Início do round';
		if (event.type === 'pending-combatant') return 'Entrada na iniciativa';
		return 'Próximo turno';
	}

	specialTurnEvent(): BattleLairAction | BattleTrap | null {
		const specialTurn = this.currentSpecialTurn();
		if (!specialTurn) return null;
		const battle = this.battle();
		if (!battle) return null;
		return specialTurn.type === 'lair-action'
			? battle.lairActions.find((action) => action.id === specialTurn.eventId) ?? null
			: battle.traps.find((trap) => trap.id === specialTurn.eventId) ?? null;
	}

	specialTurnTypeLabel(): string {
		return this.currentSpecialTurn()?.type === 'lair-action' ? 'LAIR ACTION' : 'ARMADILHA';
	}

	abilityAvailabilityClasses(ability: BattleSpecialAbility): string {
		if (ability.isAvailable) return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
		if (ability.recoveryType === 'uses-per-day' || ability.recoveryType === 'uses-per-combat')
			return 'border-rose-400/30 bg-rose-500/10 text-rose-100';
		if (ability.recoveryType === 'turn-cooldown' || ability.recoveryType === 'round-cooldown') {
			return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
		}
		return 'border-slate-300/20 bg-slate-500/10 text-slate-100';
	}

	spellSlotsSummary(combatant: BattleCombatant): string | null {
		if (!combatant.spellSlots.length) return null;
		const max = combatant.spellSlots.reduce((total, slot) => total + slot.max, 0);
		const available = combatant.spellSlots.reduce(
			(total, slot) => total + this.availableSpellSlots(slot),
			0,
		);
		return `${available}/${max} slots disponíveis`;
	}

	encounterEventFrequencyLabel(event: BattleLairAction | BattleTrap): string {
		if (event.frequency === 'every-round') return 'Todo round';
		if (event.frequency === 'once') return 'Uma vez';
		if (event.frequency === 'cooldown-rounds') {
			const remaining = Math.max(0, event.currentCooldownRounds ?? 0);
			if (remaining > 0) {
				return remaining === 1 ? 'Volta em 1 round' : `Volta em ${remaining} rounds`;
			}
			const cooldown = Math.max(1, event.cooldownRounds ?? 1);
			return cooldown === 1 ? 'Cooldown de 1 round' : `Cooldown de ${cooldown} rounds`;
		}
		return 'Manual';
	}

	lairActionScheduleLabel(action: BattleLairAction): string {
		return `${this.encounterEventFrequencyLabel(action)} na iniciativa ${action.initiative}`;
	}

	trapScheduleLabel(trap: BattleTrap): string {
		if (trap.triggerType === 'initiative') {
			return `${this.encounterEventFrequencyLabel(trap)} na iniciativa ${trap.initiative ?? 20}`;
		}
		if (trap.triggerType === 'round-start')
			return `${this.encounterEventFrequencyLabel(trap)} no início do round`;
		if (trap.triggerType === 'round-end')
			return `${this.encounterEventFrequencyLabel(trap)} no fim do round`;
		return 'Manual';
	}

	spellSlotsEnabled(combatant: BattleCombatant): boolean {
		return combatant.spellSlots.length > 0;
	}

	hasSpells(combatant: BattleCombatant): boolean {
		return combatant.spells.length > 0;
	}

	async openSpellQuickView(spell: BattleCombatant['spells'][number]) {
		this.closeReferenceSheetViewer(false);
		this.referenceOverlay.openSpell({ name: spell.name, source: spell.source });
	}

	hasSheetFeatures(combatant: BattleCombatant): boolean {
		return combatant.features.length > 0;
	}

	spellSlotsVisible(combatant: BattleCombatant): boolean {
		if (!this.spellSlotsEnabled(combatant)) return false;
		return !combatant.spellSlotsCollapsed;
	}

	toggleSpellSlotsVisibility(combatantId: string) {
		const combatant = this.combatants().find((item) => item.id === combatantId);
		if (!combatant) return;
		this.updateBattle((battle) =>
			this.battleService.setSpellSlotsCollapsed(
				battle,
				combatantId,
				!combatant.spellSlotsCollapsed,
			),
		);
	}

	setSpellSlotMax(combatantId: string, level: number, value: unknown) {
		this.updateBattle((battle) =>
			this.battleService.setSpellSlotMax(
				battle,
				combatantId,
				level,
				this.parseNonNegativeInt(value),
			),
		);
	}

	setSpellSlotUsed(combatantId: string, level: number, value: unknown) {
		this.updateBattle((battle) =>
			this.battleService.setSpellSlotUsed(
				battle,
				combatantId,
				level,
				this.parseNonNegativeInt(value),
			),
		);
	}

	useSpellSlot(combatantId: string, level: number) {
		this.updateBattle((battle) => this.battleService.useSpellSlot(battle, combatantId, level));
	}

	recoverSpellSlot(combatantId: string, level: number) {
		this.updateBattle((battle) => this.battleService.recoverSpellSlot(battle, combatantId, level));
	}

	availableSpellSlots(slot: BattleSpellSlotLevel): number {
		return this.battleService.getAvailableSpellSlots(slot);
	}

	openAddCombatantModal() {
		this.captureModalTrigger();
		this.homebrewSheets.set(this.localStorageService.listSheets());
		this.homebrewSearch.set('');
		this.addCombatantDraft.set(this.createAddCombatantDraft());
		this.bestiarySearch.set('');
		this.addCombatantModalOpen.set(true);
		this.focusModal();
	}

	closeAddCombatantModal() {
		this.selectedImportedCreature.set(null);
		this.addCombatantModalOpen.set(false);
		this.restoreModalTrigger();
	}

	setAddCombatantMode(mode: AddCombatantDraft['mode']) {
		this.selectedImportedCreature.set(null);
		this.addCombatantDraft.set({
			...this.createAddCombatantDraft(),
			mode,
		});
	}

	setAddCombatantDraft(patch: Partial<AddCombatantDraft>) {
		this.addCombatantDraft.update((draft) => ({ ...draft, ...patch }));
	}

	useHomebrewSheet(sheetId: string) {
		const sheet = this.homebrewSheets().find((item) => item.id === sheetId);
		if (!sheet) {
			this.selectedImportedCreature.set(null);
			this.setAddCombatantDraft({
				sheetId: '',
				name: '',
				side: 'enemy',
				initiative: '0',
			});
			return;
		}
		const creature = this.creatureTemplateService.createFromSavedSheet(sheet);
		this.selectedImportedCreature.set(creature);
		this.addCombatantDraft.update((draft) => ({
			...draft,
			mode: 'homebrew',
			sheetId,
			name: creature.name || sheet.title,
			side: this.defaultSideForSheet(sheet),
			maxHp: String(creature.maxHp),
			armorClass: creature.armorClass == null ? '' : String(creature.armorClass),
			initiative: '0',
		}));
	}

	async openCompendium() {
		if (this.bestiaryMonsters().length) return;
		this.bestiaryLoading.set(true);
		try {
			this.bestiaryMonsters.set((await this.bestiary.getIndex()).monsters);
		} catch (error) {
			this.showToast(
				'error',
				error instanceof Error ? error.message : 'Erro ao carregar bestiário local.',
			);
		} finally {
			this.bestiaryLoading.set(false);
		}
	}

	async useCompendiumMonster(monsterRef: CompendiumBestiaryMonsterIndexEntry) {
		try {
			const monster = await this.bestiary.getMonster(monsterRef.source, monsterRef.name);
			if (!monster) throw new Error('Criatura não encontrada no arquivo local.');
			const creature = this.compendiumAdapter.toCreatureSheet(monster);
			this.selectedImportedCreature.set(creature);
			this.addCombatantDraft.update((draft) => ({
				...draft,
				mode: 'compendium',
				sheetId: '',
				name: creature.name,
				side: 'enemy',
				maxHp: String(creature.maxHp),
				armorClass: String(creature.armorClass ?? ''),
				initiative: '0',
			}));
		} catch (error) {
			this.showToast('error', error instanceof Error ? error.message : 'Erro ao buscar criatura.');
		}
	}

	async addCombatant() {
		const battle = this.battle();
		if (!battle) return;

		const draft = this.addCombatantDraft();
		const importedCreature = this.selectedImportedCreature();
		if (draft.mode === 'manual' && !draft.name.trim()) {
			this.showToast('error', 'Informe o nome do combatente.');
			return;
		}
		if (draft.mode !== 'manual' && !importedCreature) {
			this.showToast(
				'error',
				draft.mode === 'homebrew'
					? 'Selecione uma ficha homebrew.'
					: 'Selecione uma criatura do bestiário.',
			);
			return;
		}

		const creature =
			draft.mode === 'manual'
				? this.createManualCreatureFromDraft(draft)
				: this.creatureTemplateService.cloneCreature(importedCreature!);
		const category =
			draft.mode === 'homebrew'
				? (this.homebrewSheets().find((sheet) => sheet.id === draft.sheetId)?.category ?? 'monster')
				: draft.mode === 'compendium'
					? 'monster'
					: this.categoryForSide(draft.side);
		const overrides =
			draft.mode === 'manual'
				? {
						name: draft.name.trim(),
						side: draft.side,
						initiative: this.parseInitiativeInput(draft.initiative),
						maxHp: this.parseNonNegativeInt(draft.maxHp),
						currentHp: this.parseNonNegativeInt(draft.maxHp),
						armorClass: this.parseArmorClassInput(draft.armorClass),
						category,
						sourceSheetId: undefined,
					}
				: {
						side: draft.side,
						initiative: this.parseInitiativeInput(draft.initiative),
						category,
						sourceSheetId: draft.mode === 'homebrew' ? draft.sheetId : undefined,
					};

		this.updateBattle((current) =>
			this.battleService.addCombatantFromParticipant(current, {
				id: crypto.randomUUID(),
				name: overrides.name ?? creature.name,
				category,
				side: overrides.side,
				initiative: overrides.initiative,
				sourceSheetId: overrides.sourceSheetId,
				sheet: creature,
			}),
		);

		this.closeAddCombatantModal();
		this.showToast(
			'success',
			battle.combatants.length > 0
				? 'Combatente adicionado para entrar no próximo round.'
				: 'Combatente adicionado.',
		);
	}

	duplicateCombatant(combatantId: string) {
		this.updateBattle((battle) => this.battleService.duplicateCombatant(battle, combatantId));
		this.showToast('success', 'Combatente duplicado para o próximo round.');
	}

	openRemoveCombatantModal(combatantId: string) {
		const combatant = this.combatants().find((item) => item.id === combatantId);
		if (!combatant) return;

		this.captureModalTrigger();
		this.confirmModal.set({
			title: 'Remover combatente?',
			description: `Essa ação remove ${combatant.displayName || combatant.name} da batalha atual.`,
			confirmLabel: 'Remover combatente',
			action: 'remove-combatant',
			tone: 'danger',
			combatantId,
		});
		this.focusModal();
	}

	getInitiativeDraft(combatant: BattleCombatant): string {
		return (
			this.initiativeDrafts()[combatant.id] ??
			String(combatant.nextRoundInitiative ?? combatant.initiative)
		);
	}

	setInitiativeDraft(combatantId: string, value: string) {
		this.initiativeDrafts.update((drafts) => ({ ...drafts, [combatantId]: value }));
	}

	applyInitiativeChange(combatantId: string) {
		const value = this.parseInitiativeInput(this.initiativeDrafts()[combatantId]);
		this.updateBattle((battle) =>
			this.battleService.scheduleCombatantInitiative(battle, combatantId, value),
		);
		this.showToast('success', 'Iniciativa agendada para o próximo round.');
	}

	clearInitiativeChange(combatantId: string) {
		this.updateBattle((battle) =>
			this.battleService.clearScheduledCombatantInitiative(battle, combatantId),
		);
		const combatant = this.combatants().find((item) => item.id === combatantId);
		this.initiativeDrafts.update((drafts) => ({
			...drafts,
			[combatantId]: String(combatant?.initiative ?? 0),
		}));
	}

	getInitiativeTieBreakerValue(combatant: BattleCombatant): string {
		const value =
			combatant.nextRoundInitiativeTieBreaker === undefined
				? combatant.initiativeTieBreaker
				: combatant.nextRoundInitiativeTieBreaker;
		return value == null ? '' : String(value);
	}

	scheduleInitiativeTieBreaker(combatantId: string, value: string) {
		this.updateBattle((battle) =>
			this.battleService.scheduleCombatantInitiativeTieBreaker(
				battle,
				combatantId,
				this.parseOptionalInitiativeTieBreaker(value),
			),
		);
	}

	isPendingCombatant(combatant: BattleCombatant): boolean {
		return combatant.pendingAdd;
	}

	shouldShowPendingInitiative(combatant: BattleCombatant): boolean {
		return (
			combatant.nextRoundInitiative != null &&
			combatant.nextRoundInitiative !== combatant.initiative
		);
	}

	shouldShowPendingInitiativeTieBreaker(combatant: BattleCombatant): boolean {
		return combatant.nextRoundInitiativeTieBreaker !== undefined;
	}

	isInactiveUntilNextRound(combatant: BattleCombatant): boolean {
		const battle = this.battle();
		return (
			battle != null &&
			combatant.inactiveUntilRound != null &&
			combatant.inactiveUntilRound > battle.round
		);
	}

	initiativeSummary(combatant: BattleCombatant): string {
		const tieBreaker =
			combatant.initiativeTieBreaker == null ? '' : ` (DES ${combatant.initiativeTieBreaker})`;
		if (combatant.pendingAdd) return `Entra com iniciativa ${combatant.initiative}${tieBreaker}`;
		if (this.isInactiveUntilNextRound(combatant)) {
			return `Fora da rotação até o round ${combatant.inactiveUntilRound}`;
		}
		if (this.shouldShowPendingInitiative(combatant)) {
			return `Iniciativa ${combatant.initiative}${tieBreaker} · Próximo round ${combatant.nextRoundInitiative}`;
		}
		return `Iniciativa ${combatant.initiative}${tieBreaker}`;
	}

	hpSummary(combatant: BattleCombatant): string {
		const temp = combatant.temporaryHp > 0 ? ` + ${combatant.temporaryHp} temp` : '';
		return `${combatant.currentHp}/${combatant.maxHp}${temp}`;
	}

	formatDuration(totalSeconds: number): string {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}

	sideLabel(side: BattleCombatantSide): string {
		if (side === 'player') return 'Jogador';
		if (side === 'ally') return 'Aliado';
		if (side === 'neutral') return 'Neutro';
		return 'Inimigo';
	}

	sideBadgeClasses(side: BattleCombatantSide): string {
		if (side === 'player') return 'border-sky-400/30 bg-sky-500/15 text-sky-100';
		if (side === 'ally') return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100';
		if (side === 'neutral') return 'border-slate-300/20 bg-slate-500/10 text-slate-100';
		return 'border-rose-400/30 bg-rose-500/15 text-rose-100';
	}

	combatOrderRowClasses(combatant: BattleCombatant): string {
		const base = 'grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-white/10 px-1 py-2 last:border-b-0';
		if (combatant.defeated) return `${base} opacity-45`;
		if (this.currentCombatant()?.id === combatant.id) {
			return `${base} -mx-2 border-amber-300/30 bg-amber-500/15 px-3 text-amber-50`;
		}
		return base;
	}

	combatOrderSideDotClasses(side: BattleCombatantSide): string {
		if (side === 'player') return 'bg-sky-300';
		if (side === 'ally') return 'bg-emerald-300';
		if (side === 'neutral') return 'bg-slate-300';
		return 'bg-rose-300';
	}

	confirmButtonClasses(tone: ConfirmModalState['tone']): string {
		if (tone === 'danger') return 'border-red-300/30 bg-red-500/15 hover:bg-red-500/20';
		return 'border-emerald-300/30 bg-emerald-500/15 hover:bg-emerald-500/20';
	}

	conditionDraftPreview(combatantId: string): string {
		const draft = this.getConditionDraft(combatantId);
		const preset = this.conditionOptions.find((option) => option.name === draft.preset);
		if (preset?.name === 'custom' && !draft.customLabel.trim()) {
			return 'Digite um nome personalizado';
		}
		return (draft.customLabel || preset?.label || 'Condição sem nome').trim();
	}

	conditionModeLabel(mode: ConditionDurationMode): string {
		if (mode === 'next-turn-end') return 'Até o fim do próximo turno';
		if (mode === 'turns') return 'Por turnos';
		if (mode === 'rounds') return 'Por rounds';
		return 'Sem duração';
	}

	statusBadgeClasses(status: BattleEncounter['status'] | undefined): string {
		if (status === 'paused') return 'bg-amber-500/15 border-amber-400/30 text-amber-100';
		if (status === 'completed') return 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100';
		return 'bg-sky-500/15 border-sky-400/30 text-sky-100';
	}

	cardClasses(combatant: BattleCombatant): string {
		const isCurrent = this.currentCombatant()?.id === combatant.id;
		const base = 'scroll-mt-64 rounded-3xl border p-4 transition';

		if (combatant.pendingAdd) return `${base} border-dashed border-white/15 bg-white/5 opacity-90`;
		if (combatant.defeated) return `${base} border-red-400/30 bg-red-500/10 opacity-75`;
		if (isCurrent) {
			return `${base} border-amber-300/40 bg-amber-500/10 shadow-[0_0_0_1px_rgba(251,191,36,0.18)]`;
		}
		if (combatant.side === 'player') return `${base} border-sky-400/20 bg-sky-500/5`;
		if (combatant.side === 'ally') return `${base} border-emerald-400/20 bg-emerald-500/5`;
		if (combatant.side === 'neutral') return `${base} border-slate-300/15 bg-slate-500/5`;
		return `${base} border-rose-400/15 bg-rose-500/5`;
	}

	featureKindLabel(kind: string): string {
		if (kind === 'action') return 'Ação';
		if (kind === 'reaction') return 'Reação';
		if (kind === 'legendary') return 'Lendária';
		if (kind === 'spellcasting') return 'Spellcasting';
		if (kind === 'trait') return 'Trait';
		return 'Nota';
	}

	spellSlotLevelCount(creature: CreatureSheet | null): number {
		return creature?.spellSlots.length ?? 0;
	}

	private updateBattle(updater: (battle: BattleEncounter) => BattleEncounter) {
		const battle = this.battle();
		if (!battle) return;
		this.battle.set(updater(battle));
	}

	private captureModalTrigger() {
		this.modalTrigger =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
	}

	private restoreModalTrigger() {
		const trigger = this.modalTrigger;
		this.modalTrigger = null;
		window.setTimeout(() => trigger?.focus());
	}

	private focusModal() {
		window.setTimeout(() =>
			document
				.querySelector<HTMLElement>(
					'[data-battle-modal] button, [data-battle-modal] input, [data-battle-modal] select',
				)
				?.focus(),
		);
	}

	private createAddCombatantDraft(): AddCombatantDraft {
		return {
			mode: 'manual',
			sheetId: '',
			name: '',
			side: 'enemy',
			maxHp: '0',
			armorClass: '',
			initiative: '0',
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
			triggerType: 'initiative',
			initiative: '20',
			frequency: 'once',
			cooldownRounds: '1',
		};
	}

	private createManualCreatureFromDraft(draft: AddCombatantDraft): CreatureSheet {
		return this.creatureTemplateService.createManualCreature({
			name: draft.name.trim(),
			hp: this.parseNonNegativeInt(draft.maxHp),
			armorClass: draft.armorClass.trim(),
			category: this.categoryForSide(draft.side),
		});
	}

	private referenceSheetForCombatant(combatant: BattleCombatant): CreatureSheet {
		const savedSheet = this.sourceSheetForCombatant(combatant);
		// The combat snapshot governs runtime state; the library sheet provides the current full reference.
		if (savedSheet) return this.creatureTemplateService.createFromSavedSheet(savedSheet);

		const reference = this.battle()?.referenceSheets.find(
			(sheet) => sheet.id === combatant.referenceSheetId,
		);
		if (reference) return reference.sheet;

		return {
			name: combatant.displayName?.trim() || combatant.name,
			armorClass: combatant.armorClass,
			maxHp: combatant.maxHp,
			spellSlots: combatant.spellSlots.map((slot) => ({ level: slot.level, max: slot.max })),
			spells: structuredClone(combatant.spells),
			specialAbilities: combatant.specialAbilities.map((ability) => ({
				id: ability.id,
				name: ability.name,
				description: ability.description,
				recoveryType: ability.recoveryType,
				maxUses: ability.maxUses,
				cooldownTurns: ability.cooldownTurns,
				cooldownRounds: ability.cooldownRounds,
				rechargeDice: ability.rechargeDice,
				rechargeOn: ability.rechargeOn,
			})),
			features: structuredClone(combatant.features),
		};
	}

	private sourceSheetForCombatant(combatant: BattleCombatant): SavedSheetInterface | null {
		return combatant.sourceSheetId ? this.localStorageService.getSheet(combatant.sourceSheetId) : null;
	}

	private defaultSideForSheet(sheet: SavedSheetInterface): BattleCombatantSide {
		if (sheet.category === 'pc') return 'player';
		if (sheet.category === 'npc' || sheet.category === 'other') return 'neutral';
		return 'enemy';
	}

	private categoryForSide(side: BattleCombatantSide) {
		if (side === 'player') return 'pc' as const;
		if (side === 'ally' || side === 'neutral') return 'npc' as const;
		return 'monster' as const;
	}

	private parseNonNegativeInt(value: unknown): number {
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) return 0;
		return Math.max(0, Math.floor(numeric));
	}

	private parseInitiativeInput(value: unknown): number {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? Math.floor(numeric) : 0;
	}

	private parseOptionalInitiativeTieBreaker(value: unknown): number | undefined {
		if (value == null || String(value).trim() === '') return undefined;
		const numeric = Number(value);
		return Number.isFinite(numeric) ? Math.floor(numeric) : undefined;
	}

	private parseArmorClassInput(value: unknown): number | undefined {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? Math.floor(numeric) : undefined;
	}

	private slugify(value: string): string {
		return (value || '')
			.trim()
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '');
	}

	private showToast(type: 'success' | 'error', text: string) {
		this.toast.set({ type, text });
		window.setTimeout(() => {
			if (this.toast()?.text === text) this.toast.set(null);
		}, 2200);
	}
}
