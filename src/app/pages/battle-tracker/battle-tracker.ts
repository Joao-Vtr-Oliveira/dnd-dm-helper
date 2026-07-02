import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type {
	BattleAbilityRechargeType,
	BattleCombatant,
	BattleCombatantSide,
	BattleCondition,
	BattleConditionDurationType,
	BattleConditionPreset,
	BattleEncounter,
	BattleSpecialAbility,
	BattleSpellSlotLevel,
} from '../../models/battle-encounter-model';
import type {
	CreatureInterface,
	SpellInterface,
	SpellsByKey,
} from '../../models/battleTracker-model';
import {
	BattleEncounterService,
	DEFAULT_BATTLE_CONDITIONS,
} from '../../services/battle-encounter-service/battle-encounter-service';
import { BattleEncounterStorageService } from '../../services/battle-encounter-storage-service/battle-encounter-storage-service';
import {
	LocalStorageService,
	type SavedSheetInterface,
} from '../../services/local-storage-service/local-storage-service';
import {
	Dnd5eApiService,
	type ApiResourceListItem,
} from '../../services/dnd-api/dnd-api';
import { CreatureTemplateService } from '../../services/creature-template-service/creature-template-service';
import { firstValueFrom } from 'rxjs';

type ConditionDurationMode = 'manual' | 'next-turn-end' | 'turns' | 'rounds';

type ConditionDraft = {
	preset: string;
	customLabel: string;
	durationMode: ConditionDurationMode;
	durationValue: string;
};

type AbilityDraft = {
	name: string;
	description: string;
	rechargeType: BattleAbilityRechargeType;
	cooldownValue: string;
	rechargeOn: string;
};

type AddCombatantDraft = {
	mode: 'manual' | 'homebrew' | 'api';
	sheetId: string;
	apiIndex: string;
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
	imports: [CommonModule, FormsModule],
	templateUrl: './battle-tracker.html',
})
export class BattleTrackerPage {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly battleStorage = inject(BattleEncounterStorageService);
	private readonly battleService = inject(BattleEncounterService);
	private readonly localStorageService = inject(LocalStorageService);
	private readonly dndApi = inject(Dnd5eApiService);
	private readonly creatureTemplateService = inject(CreatureTemplateService);

	private readonly battleId = this.route.snapshot.paramMap.get('battleId');

	readonly battle = signal<BattleEncounter | null>(
		this.battleId ? this.battleStorage.getBattleEncounterById(this.battleId) : null
	);
	readonly now = signal(Date.now());
	readonly damageDrafts = signal<Record<string, string>>({});
	readonly healingDrafts = signal<Record<string, string>>({});
	readonly conditionDrafts = signal<Record<string, ConditionDraft>>({});
	readonly abilityDrafts = signal<Record<string, AbilityDraft>>({});
	readonly initiativeDrafts = signal<Record<string, string>>({});
	readonly toast = signal<{ type: 'success' | 'error'; text: string } | null>(null);
	readonly confirmModal = signal<ConfirmModalState | null>(null);
	readonly addCombatantModalOpen = signal(false);
	readonly addCombatantDraft = signal<AddCombatantDraft>(this.createAddCombatantDraft());
	readonly selectedImportedCreature = signal<CreatureInterface | null>(null);
	readonly homebrewSheets = signal<SavedSheetInterface[]>(this.localStorageService.listSheets());
	readonly apiMonsters = signal<ApiResourceListItem[]>([]);
	readonly apiLoading = signal(false);
	readonly apiSearch = signal('');
	readonly filteredApiMonsters = computed(() => {
		const query = this.apiSearch().trim().toLowerCase();
		if (!query) return this.apiMonsters();
		return this.apiMonsters().filter(
			(monster) =>
				monster.name.toLowerCase().includes(query) ||
				monster.index.toLowerCase().includes(query)
		);
	});

	readonly conditionOptions: BattleConditionPreset[] = DEFAULT_BATTLE_CONDITIONS;
	readonly combatants = computed(() => [
		...(this.battle()?.combatants ?? []),
		...(this.battle()?.pendingCombatants ?? []),
	]);
	readonly currentCombatant = computed(() => {
		const battle = this.battle();
		return battle ? this.battleService.getCurrentCombatant(battle) : null;
	});
	readonly currentTurnElapsedSeconds = computed(() => {
		const battle = this.battle();
		if (!battle) return 0;
		return this.battleService.getCurrentTurnElapsedSeconds(battle, new Date(this.now()));
	});
	readonly turnHistory = computed(() => this.battle()?.turnHistory ?? []);
	readonly battleStatusLabel = computed(() => {
		const status = this.battle()?.status;
		if (status === 'paused') return 'Pausada';
		if (status === 'completed') return 'Concluída';
		return 'Ativa';
	});

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
		this.confirmModal.set({
			title: 'Concluir batalha?',
			description: 'O histórico será mantido e essa batalha deixará de aparecer como ativa.',
			confirmLabel: 'Concluir batalha',
			action: 'complete-battle',
			tone: 'success',
		});
	}

	closeConfirmModal() {
		this.confirmModal.set(null);
	}

	confirmModalAction() {
		const modal = this.confirmModal();
		if (!modal) return;

		if (modal.action === 'complete-battle') {
			this.updateBattle((battle) => this.battleService.completeBattle(battle));
			this.showToast('success', 'Batalha concluída.');
		}

		if (modal.action === 'remove-combatant' && modal.combatantId) {
			this.updateBattle((battle) =>
				this.battleService.removeCombatant(battle, modal.combatantId!)
			);
			this.showToast('success', 'Combatente removido.');
		}

		this.closeConfirmModal();
	}

	nextTurn() {
		this.updateBattle((battle) => this.battleService.advanceTurn(battle));
	}

	previousTurn() {
		this.updateBattle((battle) => this.battleService.rewindTurn(battle));
	}

	setCombatantSide(combatantId: string, side: BattleCombatantSide) {
		this.updateBattle((battle) =>
			this.battleService.updateCombatant(battle, combatantId, { side })
		);
	}

	setCurrentHp(combatantId: string, value: unknown) {
		this.updateBattle((battle) =>
			this.battleService.updateCombatantHp(battle, combatantId, {
				currentHp: this.parseNonNegativeInt(value),
			})
		);
	}

	setMaxHp(combatantId: string, value: unknown) {
		this.updateBattle((battle) =>
			this.battleService.updateCombatantHp(battle, combatantId, {
				maxHp: this.parseNonNegativeInt(value),
			})
		);
	}

	setTemporaryHp(combatantId: string, value: unknown) {
		this.updateBattle((battle) =>
			this.battleService.updateCombatantHp(battle, combatantId, {
				temporaryHp: this.parseNonNegativeInt(value),
			})
		);
	}

	toggleDefeated(combatantId: string, checked: boolean) {
		this.updateBattle((battle) =>
			this.battleService.setCombatantDefeated(battle, combatantId, checked)
		);
	}

	toggleCombatantCollapsed(combatantId: string, collapsed?: boolean) {
		const combatant = this.combatants().find((item) => item.id === combatantId);
		if (!combatant) return;
		this.updateBattle((battle) =>
			this.battleService.updateCombatant(battle, combatantId, {
				collapsed: collapsed ?? !combatant.collapsed,
			})
		);
	}

	applyDamage(combatantId: string) {
		const amount = this.parseNonNegativeInt(this.damageDrafts()[combatantId]);
		if (!amount) return;

		this.updateBattle((battle) => this.battleService.applyDamage(battle, combatantId, amount));
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
					name: preset?.name === 'custom' ? this.slugify(label) || 'custom' : preset?.name ?? 'custom',
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
					name: preset?.name === 'custom' ? this.slugify(label) || 'custom' : preset?.name ?? 'custom',
					label,
					description: preset?.description,
					durationType: 'turns' as BattleConditionDurationType,
					durationTurns: durationValue,
				};
			}

			if (draft.durationMode === 'rounds') {
				return {
					name: preset?.name === 'custom' ? this.slugify(label) || 'custom' : preset?.name ?? 'custom',
					label,
					description: preset?.description,
					durationType: 'rounds' as BattleConditionDurationType,
					durationRounds: durationValue,
				};
			}

			return {
				name: preset?.name === 'custom' ? this.slugify(label) || 'custom' : preset?.name ?? 'custom',
				label,
				description: preset?.description,
				durationType: 'manual' as BattleConditionDurationType,
			};
		})();

		this.updateBattle((current) =>
			this.battleService.addCondition(current, combatantId, conditionInput)
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
			this.battleService.removeCondition(battle, combatantId, conditionId)
		);
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
			this.battleService.updateCombatantNotes(battle, combatantId, value)
		);
	}

	getAbilityDraft(combatantId: string): AbilityDraft {
		return (
			this.abilityDrafts()[combatantId] ?? {
				name: '',
				description: '',
				rechargeType: 'manual',
				cooldownValue: '1',
				rechargeOn: '5,6',
			}
		);
	}

	setAbilityDraft(combatantId: string, patch: Partial<AbilityDraft>) {
		this.abilityDrafts.update((drafts) => ({
			...drafts,
			[combatantId]: {
				...this.getAbilityDraft(combatantId),
				...patch,
			},
		}));
	}

	addAbility(combatantId: string) {
		const draft = this.getAbilityDraft(combatantId);
		const name = draft.name.trim();
		if (!name) {
			this.showToast('error', 'Informe o nome da habilidade.');
			return;
		}

		const cooldownValue = Math.max(1, this.parseNonNegativeInt(draft.cooldownValue) || 1);
		const rechargeOn = draft.rechargeOn
			.split(',')
			.map((item) => this.parseNonNegativeInt(item))
			.filter((item) => item > 0);

		this.updateBattle((battle) =>
			this.battleService.addSpecialAbility(battle, combatantId, {
				name,
				description: draft.description,
				rechargeType: draft.rechargeType,
				cooldownTurns: draft.rechargeType === 'turns' ? cooldownValue : undefined,
				cooldownRounds: draft.rechargeType === 'rounds' ? cooldownValue : undefined,
				rechargeDice: draft.rechargeType === 'dice' ? 'd6' : undefined,
				rechargeOn: draft.rechargeType === 'dice' ? rechargeOn : undefined,
			})
		);

		this.abilityDrafts.update((drafts) => ({
			...drafts,
			[combatantId]: {
				name: '',
				description: '',
				rechargeType: 'manual',
				cooldownValue: '1',
				rechargeOn: '5,6',
			},
		}));
	}

	useAbility(combatantId: string, abilityId: string) {
		this.updateBattle((battle) => this.battleService.useSpecialAbility(battle, combatantId, abilityId));
	}

	resetAbility(combatantId: string, abilityId: string) {
		this.updateBattle((battle) =>
			this.battleService.resetSpecialAbility(battle, combatantId, abilityId)
		);
	}

	removeAbility(combatantId: string, abilityId: string) {
		this.updateBattle((battle) =>
			this.battleService.removeSpecialAbility(battle, combatantId, abilityId)
		);
	}

	rollAbilityRecharge(combatantId: string, abilityId: string) {
		const battle = this.battle();
		if (!battle) return;

		const result = this.battleService.rollSpecialAbilityRecharge(battle, combatantId, abilityId);
		if (!result) return;

		this.battle.set(result.battle);
		this.showToast(
			result.success
				? 'success'
				: 'error',
			result.success ? `Recharge bem-sucedido: ${result.roll}.` : `Recharge falhou: ${result.roll}.`
		);
	}

	abilityStatusLabel(ability: BattleSpecialAbility): string {
		return this.battleService.describeAbilityStatus(ability);
	}

	enableSpellSlots(combatantId: string) {
		this.updateBattle((battle) => this.battleService.enableSpellSlots(battle, combatantId));
	}

	disableSpellSlots(combatantId: string) {
		this.updateBattle((battle) => this.battleService.disableSpellSlots(battle, combatantId));
	}

	spellSlotsEnabled(combatant: BattleCombatant): boolean {
		return combatant.spellSlots.length > 0;
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
				!combatant.spellSlotsCollapsed
			)
		);
	}

	setSpellSlotMax(combatantId: string, level: number, value: unknown) {
		this.updateBattle((battle) =>
			this.battleService.setSpellSlotMax(battle, combatantId, level, this.parseNonNegativeInt(value))
		);
	}

	setSpellSlotUsed(combatantId: string, level: number, value: unknown) {
		this.updateBattle((battle) =>
			this.battleService.setSpellSlotUsed(
				battle,
				combatantId,
				level,
				this.parseNonNegativeInt(value)
			)
		);
	}

	useSpellSlot(combatantId: string, level: number) {
		this.updateBattle((battle) => this.battleService.useSpellSlot(battle, combatantId, level));
	}

	recoverSpellSlot(combatantId: string, level: number) {
		this.updateBattle((battle) =>
			this.battleService.recoverSpellSlot(battle, combatantId, level)
		);
	}

	availableSpellSlots(slot: BattleSpellSlotLevel): number {
		return this.battleService.getAvailableSpellSlots(slot);
	}

	openAddCombatantModal() {
		this.homebrewSheets.set(this.localStorageService.listSheets());
		this.addCombatantDraft.set(this.createAddCombatantDraft());
		this.apiSearch.set('');
		this.addCombatantModalOpen.set(true);
		if (!this.apiMonsters().length) {
			this.loadApiMonsters();
		}
	}

	closeAddCombatantModal() {
		this.selectedImportedCreature.set(null);
		this.addCombatantModalOpen.set(false);
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
		const creature = this.creatureTemplateService.createFromSavedSheet(sheet, { id: Date.now() });
		this.selectedImportedCreature.set(creature);
		this.addCombatantDraft.update((draft) => ({
			...draft,
			mode: 'homebrew',
			sheetId,
			apiIndex: '',
			name: creature.name || sheet.title,
			side: this.defaultSideForSheet(sheet),
			maxHp: String(creature.maxHealthPoints ?? 0),
			armorClass:
				creature.armorClass == null || creature.armorClass === ''
					? ''
					: String(creature.armorClass),
			initiative:
				creature.initiative == null || Number.isNaN(Number(creature.initiative))
					? '0'
					: String(creature.initiative),
		}));
	}

	async useApiMonster(index: string) {
		const monsterRef = this.apiMonsters().find((monster) => monster.index === index);
		if (!monsterRef) return;
		try {
			const monster = await firstValueFrom(this.dndApi.getMonster(index));
			const creature = this.creatureTemplateService.createFromApiMonster(monster, {
				id: Date.now(),
				initiative: this.dndApi.dexMod(monster),
			});
			this.selectedImportedCreature.set(creature);
			this.addCombatantDraft.update((draft) => ({
				...draft,
				mode: 'api',
				apiIndex: index,
				sheetId: '',
				name: creature.name || monsterRef.name,
				side: 'enemy',
				maxHp: String(creature.maxHealthPoints ?? 0),
				armorClass: String(creature.armorClass ?? ''),
				initiative: creature.initiative == null ? '0' : String(creature.initiative),
			}));
		} catch (err: any) {
			this.showToast('error', err?.message ?? 'Erro ao buscar monstro.');
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
					: 'Selecione um monstro da API.'
			);
			return;
		}

		const creature =
			draft.mode === 'manual'
				? this.createManualCreatureFromDraft(draft)
				: this.creatureTemplateService.cloneCreature(importedCreature!, {
						id: Date.now(),
						initiative: this.parseInitiativeInput(draft.initiative),
				  });
		const overrides =
			draft.mode === 'manual'
				? {
						name: draft.name.trim(),
						side: draft.side,
						initiative: this.parseInitiativeInput(draft.initiative),
						maxHp: this.parseNonNegativeInt(draft.maxHp),
						currentHp: this.parseNonNegativeInt(draft.maxHp),
						armorClass: this.parseArmorClassInput(draft.armorClass),
						category: creature.category,
						sourceSheetId: creature.sourceSheetId,
				  }
				: {
						side: draft.side,
						initiative: this.parseInitiativeInput(draft.initiative),
						category: creature.category,
						sourceSheetId: creature.sourceSheetId,
				  };

		this.updateBattle((current) =>
			this.battleService.addCombatantFromCreature(current, creature, overrides)
		);

		this.closeAddCombatantModal();
		this.showToast(
			'success',
			battle.combatants.length > 0
				? 'Combatente adicionado para entrar no próximo round.'
				: 'Combatente adicionado.'
		);
	}

	duplicateCombatant(combatantId: string) {
		this.updateBattle((battle) => this.battleService.duplicateCombatant(battle, combatantId));
		this.showToast('success', 'Combatente duplicado para o próximo round.');
	}

	openRemoveCombatantModal(combatantId: string) {
		const combatant = this.combatants().find((item) => item.id === combatantId);
		if (!combatant) return;

		this.confirmModal.set({
			title: 'Remover combatente?',
			description: `Essa ação remove ${combatant.displayName || combatant.name} da batalha atual.`,
			confirmLabel: 'Remover combatente',
			action: 'remove-combatant',
			tone: 'danger',
			combatantId,
		});
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
			this.battleService.scheduleCombatantInitiative(battle, combatantId, value)
		);
		this.showToast('success', 'Iniciativa agendada para o próximo round.');
	}

	clearInitiativeChange(combatantId: string) {
		this.updateBattle((battle) =>
			this.battleService.clearScheduledCombatantInitiative(battle, combatantId)
		);
		const combatant = this.combatants().find((item) => item.id === combatantId);
		this.initiativeDrafts.update((drafts) => ({
			...drafts,
			[combatantId]: String(combatant?.initiative ?? 0),
		}));
	}

	isPendingCombatant(combatant: BattleCombatant): boolean {
		return combatant.pendingAdd;
	}

	shouldShowPendingInitiative(combatant: BattleCombatant): boolean {
		return combatant.nextRoundInitiative != null && combatant.nextRoundInitiative !== combatant.initiative;
	}

	isInactiveUntilNextRound(combatant: BattleCombatant): boolean {
		const battle = this.battle();
		return battle != null && combatant.inactiveUntilRound != null && combatant.inactiveUntilRound > battle.round;
	}

	initiativeSummary(combatant: BattleCombatant): string {
		if (combatant.pendingAdd) return `Entra com iniciativa ${combatant.initiative}`;
		if (this.isInactiveUntilNextRound(combatant)) {
			return `Fora da rotação até o round ${combatant.inactiveUntilRound}`;
		}
		if (this.shouldShowPendingInitiative(combatant)) {
			return `Atual ${combatant.initiative} · Próximo round ${combatant.nextRoundInitiative}`;
		}
		return `Atual ${combatant.initiative}`;
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

	sideSelectClasses(side: BattleCombatantSide): string {
		if (side === 'player') return 'border-sky-400/25 bg-sky-500/10 text-sky-50';
		if (side === 'ally') return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-50';
		if (side === 'neutral') return 'border-slate-300/20 bg-slate-500/10 text-slate-50';
		return 'border-rose-400/25 bg-rose-500/10 text-rose-50';
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
		const base = 'rounded-3xl border p-4 transition';

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

	spellEntries(spells: SpellsByKey | null | undefined): Array<{ key: string; value: SpellInterface }> {
		return Object.entries(spells || {}).map(([key, value]) => ({ key, value }));
	}

	spellSlotLevelCount(creature: CreatureInterface | null): number {
		if (!creature?.totalSpellSlots) return 0;
		return Object.values(creature.totalSpellSlots).filter(
			(value) => typeof value === 'number' && value > 0
		).length;
	}

	private updateBattle(updater: (battle: BattleEncounter) => BattleEncounter) {
		const battle = this.battle();
		if (!battle) return;
		this.battle.set(updater(battle));
	}

	private createAddCombatantDraft(): AddCombatantDraft {
		return {
			mode: 'manual',
			sheetId: '',
			apiIndex: '',
			name: '',
			side: 'enemy',
			maxHp: '0',
			armorClass: '',
			initiative: '0',
		};
	}

	private createManualCreatureFromDraft(draft: AddCombatantDraft): CreatureInterface {
		return this.creatureTemplateService.createManualCreature({
			id: Date.now(),
			name: draft.name.trim(),
			initiative: this.parseInitiativeInput(draft.initiative),
			hp: this.parseNonNegativeInt(draft.maxHp),
			armorClass: draft.armorClass.trim(),
			category: this.categoryForSide(draft.side),
		});
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

	private parseArmorClassInput(value: unknown): number | undefined {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? Math.floor(numeric) : undefined;
	}

	private loadApiMonsters() {
		this.apiLoading.set(true);
		this.dndApi.listMonsters().subscribe({
			next: (monsters) => {
				this.apiMonsters.set(
					[...monsters].sort((left, right) => left.name.localeCompare(right.name))
				);
				this.apiLoading.set(false);
			},
			error: (err) => {
				this.apiLoading.set(false);
				this.showToast('error', err?.message ?? 'Erro ao carregar bestiário.');
			},
		});
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
