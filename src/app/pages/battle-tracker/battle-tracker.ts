import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type {
	BattleCombatant,
	BattleCombatantSide,
	BattleConditionPreset,
	BattleEncounter,
} from '../../models/battle-encounter-model';
import {
	BattleEncounterService,
	DEFAULT_BATTLE_CONDITIONS,
} from '../../services/battle-encounter-service/battle-encounter-service';
import { BattleEncounterStorageService } from '../../services/battle-encounter-storage-service/battle-encounter-storage-service';

type ConditionDraft = {
	preset: string;
	customLabel: string;
	durationRounds: string;
	durationTurns: string;
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
		if (status === 'completed') return 'Concluida';
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
			description: 'O historico sera mantido e essa batalha deixara de aparecer como ativa.',
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
			this.showToast('success', 'Batalha concluida.');
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
				durationRounds: '',
				durationTurns: '',
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
		const draft = this.getConditionDraft(combatantId);
		const preset = this.conditionOptions.find((option) => option.name === draft.preset);
		const customLabel = draft.customLabel.trim();
		const label = (customLabel || preset?.label || '').trim();

		if (!label) {
			this.showToast('error', 'Informe o nome da condicao.');
			return;
		}

		this.updateBattle((battle) =>
			this.battleService.addCondition(battle, combatantId, {
				name: preset?.name === 'custom' ? this.slugify(label) || 'custom' : preset?.name ?? 'custom',
				label,
				description: preset?.name === 'custom' ? undefined : preset?.description,
				durationRounds: this.parseOptionalNonNegativeInt(draft.durationRounds),
				durationTurns: this.parseOptionalNonNegativeInt(draft.durationTurns),
			})
		);

		this.conditionDrafts.update((drafts) => ({
			...drafts,
			[combatantId]: {
				preset: this.conditionOptions[0]?.name ?? 'prone',
				customLabel: '',
				durationRounds: '',
				durationTurns: '',
			},
		}));
	}

	removeCondition(combatantId: string, conditionId: string) {
		this.updateBattle((battle) =>
			this.battleService.removeCondition(battle, combatantId, conditionId)
		);
	}

	setDmNotes(value: string) {
		this.updateBattle((battle) => this.battleService.updateBattleNotes(battle, value));
	}

	setPrivateNotes(combatantId: string, value: string) {
		this.updateBattle((battle) =>
			this.battleService.updateCombatantNotes(battle, combatantId, value)
		);
	}

	formatDuration(totalSeconds: number): string {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}

	sideLabel(side: BattleCombatantSide): string {
		if (side === 'player') return 'Player';
		if (side === 'ally') return 'Aliado';
		if (side === 'neutral') return 'Neutro';
		return 'Inimigo';
	}

	sideBadgeClasses(side: BattleCombatantSide): string {
		if (side === 'player') return 'border-sky-400/30 bg-sky-500/15 text-sky-100';
		if (side === 'ally') return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100';
		if (side === 'neutral') return 'border-slate-300/20 bg-slate-400/10 text-slate-100';
		return 'border-rose-400/30 bg-rose-500/15 text-rose-100';
	}

	sideSelectClasses(side: BattleCombatantSide): string {
		if (side === 'player') return 'border-sky-400/25 bg-sky-500/10 text-sky-50';
		if (side === 'ally') return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-50';
		if (side === 'neutral') return 'border-slate-300/20 bg-slate-500/10 text-slate-50';
		return 'border-rose-400/25 bg-rose-500/10 text-rose-50';
	}

	confirmButtonClasses(tone: ConfirmModalState['tone']): string {
		if (tone === 'danger') {
			return 'border-red-300/30 bg-red-500/15 hover:bg-red-500/20';
		}

		return 'border-emerald-300/30 bg-emerald-500/15 hover:bg-emerald-500/20';
	}

	conditionDraftPreview(combatantId: string): string {
		const draft = this.getConditionDraft(combatantId);
		const preset = this.conditionOptions.find((option) => option.name === draft.preset);
		if (preset?.name === 'custom' && !draft.customLabel.trim()) {
			return 'Digite um nome personalizado';
		}
		return (draft.customLabel || preset?.label || 'Condicao sem nome').trim();
	}

	statusBadgeClasses(status: BattleEncounter['status'] | undefined): string {
		if (status === 'paused') return 'bg-amber-500/15 border-amber-400/30 text-amber-100';
		if (status === 'completed') return 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100';
		return 'bg-sky-500/15 border-sky-400/30 text-sky-100';
	}

	cardClasses(combatant: BattleCombatant): string {
		const isCurrent = this.currentCombatant()?.id === combatant.id;
		const base = 'rounded-3xl border p-4 transition';

		if (combatant.defeated) {
			return `${base} border-red-400/30 bg-red-500/10 opacity-75`;
		}

		if (isCurrent) {
			return `${base} border-amber-300/40 bg-amber-500/10 shadow-[0_0_0_1px_rgba(251,191,36,0.18)]`;
		}

		if (combatant.side === 'player') {
			return `${base} border-sky-400/20 bg-sky-500/5`;
		}

		if (combatant.side === 'ally') {
			return `${base} border-emerald-400/20 bg-emerald-500/5`;
		}

		if (combatant.side === 'neutral') {
			return `${base} border-slate-300/15 bg-slate-500/5`;
		}

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

	private parseOptionalNonNegativeInt(value: unknown): number | undefined {
		if (value == null || value === '') return undefined;
		return this.parseNonNegativeInt(value);
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
