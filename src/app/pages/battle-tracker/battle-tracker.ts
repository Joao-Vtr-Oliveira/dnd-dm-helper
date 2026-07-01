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
import {
	BattleEncounterService,
	DEFAULT_BATTLE_CONDITIONS,
} from '../../services/battle-encounter-service/battle-encounter-service';
import { BattleEncounterStorageService } from '../../services/battle-encounter-storage-service/battle-encounter-storage-service';

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

type ConfirmModalState = {
	title: string;
	description: string;
	confirmLabel: string;
	action: 'complete-battle';
	tone: 'success' | 'danger';
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

	private readonly battleId = this.route.snapshot.paramMap.get('battleId');

	readonly battle = signal<BattleEncounter | null>(
		this.battleId ? this.battleStorage.getBattleEncounterById(this.battleId) : null
	);
	readonly now = signal(Date.now());
	readonly damageDrafts = signal<Record<string, string>>({});
	readonly healingDrafts = signal<Record<string, string>>({});
	readonly conditionDrafts = signal<Record<string, ConditionDraft>>({});
	readonly abilityDrafts = signal<Record<string, AbilityDraft>>({});
	readonly spellSlotPanels = signal<Record<string, boolean>>({});
	readonly toast = signal<{ type: 'success' | 'error'; text: string } | null>(null);
	readonly confirmModal = signal<ConfirmModalState | null>(null);

	readonly conditionOptions: BattleConditionPreset[] = DEFAULT_BATTLE_CONDITIONS;
	readonly combatants = computed(() => this.battle()?.combatants ?? []);
	readonly currentCombatant = computed(() => {
		const battle = this.battle();
		if (!battle || battle.activeTurnIndex < 0) return null;
		return battle.combatants[battle.activeTurnIndex] ?? null;
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
		this.spellSlotPanels.update((panels) => ({ ...panels, [combatantId]: true }));
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
		return this.spellSlotPanels()[combatant.id] ?? true;
	}

	toggleSpellSlotsVisibility(combatantId: string) {
		this.spellSlotPanels.update((panels) => ({
			...panels,
			[combatantId]: !(panels[combatantId] ?? true),
		}));
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

		if (combatant.defeated) return `${base} border-red-400/30 bg-red-500/10 opacity-75`;
		if (isCurrent) {
			return `${base} border-amber-300/40 bg-amber-500/10 shadow-[0_0_0_1px_rgba(251,191,36,0.18)]`;
		}
		if (combatant.side === 'player') return `${base} border-sky-400/20 bg-sky-500/5`;
		if (combatant.side === 'ally') return `${base} border-emerald-400/20 bg-emerald-500/5`;
		if (combatant.side === 'neutral') return `${base} border-slate-300/15 bg-slate-500/5`;
		return `${base} border-rose-400/15 bg-rose-500/5`;
	}

	private updateBattle(updater: (battle: BattleEncounter) => BattleEncounter) {
		const battle = this.battle();
		if (!battle) return;
		this.battle.set(updater(battle));
	}

	private parseNonNegativeInt(value: unknown): number {
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) return 0;
		return Math.max(0, Math.floor(numeric));
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
