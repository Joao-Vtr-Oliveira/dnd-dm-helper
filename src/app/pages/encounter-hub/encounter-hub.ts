import { CommonModule } from '@angular/common';
import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
	LucideCircleAlert,
	LucideCircleCheck,
	LucideEllipsis,
	LucideTriangleAlert,
	LucideX,
} from '@lucide/angular';
import { AppSelectComponent } from '../../components/app-select/app-select';
import type {
	BattleCombatantSide,
	BattleEncounter,
	BattleEncounterCreateOptions,
} from '../../models/battle-encounter-model';
import { isCampaignOrganizationEligible } from '../../models/campaign-world-model';
import type { EncounterParticipant } from '../../models/encounter-model';
import { abilityModifier } from '../../models/creature-sheet-rules';
import { BattleEncounterStorageService } from '../../services/battle-encounter-storage-service/battle-encounter-storage-service';
import { BattleEncounterService } from '../../services/battle-encounter-service/battle-encounter-service';
import { CampaignWorldService } from '../../services/campaign-world-service/campaign-world-service';
import {
	EncounterHubFilterService,
	type EncounterHubFilters,
	type EncounterHubItem,
	type EncounterHubLifecycleFilter,
	type EncounterHubSortOption,
	type EncounterHubStatusFilter,
} from '../../services/encounter-hub-filter-service/encounter-hub-filter-service';
import { DialogFocusDirective } from '../../directives/dialog-focus';
import {
	LocalStorageService,
	type SavedEncounter,
} from '../../services/local-storage-service/local-storage-service';

type ConfirmModalState = {
	title: string;
	description: string;
	confirmLabel: string;
	encounterId: string;
	action: 'new-battle' | 'delete-encounter';
};

type BattleSetupModalState = {
	encounterId: string;
	mode: 'start' | 'new';
	battleName: string;
	sides: Record<string, BattleCombatantSide>;
	initiatives: Record<string, number | null>;
	initiativeTieBreakers: Record<string, number>;
};

@Component({
	selector: 'app-encounter-hub',
	standalone: true,
	imports: [
		AppSelectComponent,
		CommonModule,
		DialogFocusDirective,
		FormsModule,
		LucideCircleAlert,
		LucideCircleCheck,
		LucideEllipsis,
		LucideTriangleAlert,
		LucideX,
	],
	templateUrl: './encounter-hub.html',
})
export class EncounterHub {
	private readonly ls = inject(LocalStorageService);
	private readonly router = inject(Router);
	private readonly battleStorage = inject(BattleEncounterStorageService);
	private readonly battleService = inject(BattleEncounterService);
	private readonly hubFilterService = inject(EncounterHubFilterService);

	private readonly initialFilters = this.hubFilterService.loadFilters();
	readonly campaignWorld = inject(CampaignWorldService);

	readonly filters = signal<EncounterHubFilters>(this.initialFilters);
	readonly encounters = signal<SavedEncounter[]>(this.ls.listEncounters());
	readonly battles = signal<BattleEncounter[]>(this.battleStorage.getBattleEncounters());
	readonly toast = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
	readonly confirmModal = signal<ConfirmModalState | null>(null);
	readonly battleSetupModal = signal<BattleSetupModalState | null>(null);
	readonly actionMenuEncounterId = signal<string | null>(null);

	private toastTimer: number | null = null;

	readonly items = computed(() =>
		this.hubFilterService.buildItems(this.encounters(), this.battles()),
	);

	readonly filteredItems = computed(() =>
		this.hubFilterService.sortItems(
			this.hubFilterService.filterItems(this.items(), this.filters(), this.campaignWorld.world()),
			this.filters().sort,
		),
	);

	readonly tagOptions = computed(() => {
		const tags = new Set<string>();
		for (const encounter of this.encounters()) {
			for (const tag of encounter.tags) if (tag.trim()) tags.add(tag.trim());
		}
		return ['all', ...Array.from(tags).sort((left, right) => left.localeCompare(right))];
	});

	readonly empireOptions = computed(() => [
		{ id: 'all', label: 'Todos os impérios' },
		...(this.campaignWorld.world()?.empires ?? [])
			.slice()
			.sort((left, right) => left.name.localeCompare(right.name))
			.map((empire) => ({ id: empire.id, label: empire.name })),
	]);

	readonly stateOptions = computed(() => {
		const empireId = this.filters().empireId;
		return [
			{ id: 'all', label: 'Todos os estados' },
			...(this.campaignWorld.world()?.states ?? [])
				.filter((state) => empireId === 'all' || state.empireId === empireId)
				.slice()
				.sort((left, right) => left.name.localeCompare(right.name))
				.map((state) => ({
					id: state.id,
					label:
						this.campaignWorld.resolveLocation({ scopeType: 'state', scopeId: state.id })?.breadcrumb.join(' › ') ??
						state.name,
				})),
		];
	});

	readonly settlementOptions = computed(() => {
		const empireId = this.filters().empireId;
		const stateId = this.filters().stateId;
		const world = this.campaignWorld.world();
		return [
			{ id: 'all', label: 'Todos os settlements' },
			...(world?.settlements ?? [])
				.filter((settlement) => {
					if (stateId !== 'all') return settlement.stateId === stateId;
					if (empireId === 'all') return true;
					return world?.states.some(
						(state) => state.id === settlement.stateId && state.empireId === empireId,
					);
				})
				.slice()
				.sort((left, right) => left.name.localeCompare(right.name))
				.map((settlement) => ({
					id: settlement.id,
					label:
						this.campaignWorld
							.resolveLocation({ scopeType: 'settlement', scopeId: settlement.id })
							?.breadcrumb.join(' › ') ?? settlement.name,
				})),
		];
	});

	readonly organizationOptions = computed(() => [
		{ id: 'all', label: 'Todas as organizações' },
		...(this.campaignWorld.world()?.organizations ?? [])
			.filter((organization) => isCampaignOrganizationEligible(organization))
			.slice()
			.sort((left, right) => left.name.localeCompare(right.name))
			.map((organization) => ({
				id: organization.id,
				label: organization.archived ? `${organization.name} (arquivada)` : organization.name,
			})),
	]);

	readonly groupedItems = computed(() => this.hubFilterService.groupItems(this.filteredItems()));

	readonly ongoingBattles = computed(() =>
		this.battles().filter((battle) => battle.status === 'active' || battle.status === 'paused'),
	);

	constructor() {
		effect(() => {
			this.hubFilterService.saveFilters(this.filters());
		});
	}

	@HostListener('document:keydown.escape')
	onEscape() {
		if (this.battleSetupModal()) {
			this.closeBattleSetupModal();
			return;
		}
		if (this.confirmModal()) {
			this.closeConfirmModal();
			return;
		}
		this.closeActionMenu();
	}

	toggleActionMenu(encounterId: string) {
		this.actionMenuEncounterId.update((openId) => (openId === encounterId ? null : encounterId));
	}

	closeActionMenu() {
		this.actionMenuEncounterId.set(null);
	}

	newEncounter() {
		this.router.navigate(['/home/encounter-builder']);
	}

	edit(id: string) {
		this.router.navigate(['/home/encounter-builder', id]);
	}

	duplicate(id: string) {
		this.ls.duplicateEncounter(id);
		this.refresh();
		this.showToast({ type: 'success', text: 'Encounter duplicado.' });
	}

	remove(id: string) {
		const battles = this.battleStorage.getBattlesByEncounterId(id);
		if (battles.length > 0) {
			this.confirmModal.set({
				title: 'Deletar encounter e preservar batalhas?',
				description:
					'Esse encounter possui batalhas salvas. Elas permanecerão como histórico com a referência de origem preservada.',
				confirmLabel: 'Deletar encounter e preservar histórico',
				encounterId: id,
				action: 'delete-encounter',
			});
			return;
		}

		this.confirmModal.set({
			title: 'Deletar encounter?',
			description: 'Essa ação removerá o encounter permanentemente.',
			confirmLabel: 'Deletar encounter',
			encounterId: id,
			action: 'delete-encounter',
		});
	}

	startBattle(encounterId: string) {
		const encounter = this.ls.getEncounter(encounterId);
		if (!encounter) {
			this.showToast({ type: 'error', text: 'Encounter nao encontrado.' });
			return;
		}

		this.openBattleSetup(encounter, 'start');
	}

	continueBattle(encounterId: string) {
		const battle = this.battleStorage.getActiveBattleByEncounterId(encounterId);
		if (!battle) {
			this.showToast({ type: 'error', text: 'Nenhuma batalha ativa para continuar.' });
			return;
		}

		if (battle.status === 'paused') {
			const resumed = this.battleStorage.resumeBattleEncounter(battle.id);
			if (resumed) this.refreshBattles();
		}

		this.openBattle(battle.id);
	}

	newBattle(encounterId: string) {
		const encounter = this.ls.getEncounter(encounterId);
		if (!encounter) {
			this.showToast({ type: 'error', text: 'Encounter nao encontrado.' });
			return;
		}

		const activeBattle = this.battleStorage.getActiveBattleByEncounterId(encounterId);
		if (activeBattle) {
			this.confirmModal.set({
				title: 'Criar uma nova batalha?',
				description:
					'Já existe uma batalha ativa ou pausada para este encounter. A sessão atual será mantida, mas você pode criar uma nova batalha local.',
				confirmLabel: 'Preparar nova batalha',
				encounterId,
				action: 'new-battle',
			});
			return;
		}

		this.openBattleSetup(encounter, 'new');
	}

	openBattle(battleId: string) {
		this.router.navigate(['/home/battle-tracker', battleId]);
	}

	openBattleSetup(encounter: SavedEncounter, mode: 'start' | 'new') {
		const sides = Object.fromEntries(
			encounter.participants.map((participant) => [
				participant.id,
				participant.side ?? this.defaultBattleSetupSide(participant.category),
			]),
		);
		const initiatives = Object.fromEntries(
			encounter.participants.map((participant) => [participant.id, participant.initiative]),
		);

		this.battleSetupModal.set({
			encounterId: encounter.id,
			mode,
			battleName: encounter.title,
			sides,
			initiatives,
			initiativeTieBreakers: this.automaticTieBreakers(encounter.participants, initiatives, {}),
		});
	}

	closeBattleSetupModal() {
		this.battleSetupModal.set(null);
	}

	setBattleSetupName(value: string) {
		this.battleSetupModal.update((modal) => (modal ? { ...modal, battleName: value } : modal));
	}

	setBattleSetupSide(participantId: string, side: BattleCombatantSide) {
		this.battleSetupModal.update((modal) =>
			modal
				? {
						...modal,
						sides: {
							...modal.sides,
							[participantId]: side,
						},
					}
				: modal,
		);
	}

	setBattleSetupInitiative(participantId: string, value: unknown) {
		const text = String(value ?? '').trim();
		const numeric = Number(text);
		this.battleSetupModal.update((modal) => {
			if (!modal) return modal;
			const initiatives = {
				...modal.initiatives,
				[participantId]: text && Number.isFinite(numeric) ? numeric : null,
			};
			return {
				...modal,
				initiatives,
				initiativeTieBreakers: this.automaticTieBreakers(
					this.getBattleSetupEncounter()?.participants ?? [],
					initiatives,
					modal.initiativeTieBreakers,
				),
			};
		});
	}

	setBattleSetupInitiativeTieBreaker(participantId: string, value: unknown) {
		const text = String(value ?? '').trim();
		const numeric = Number(text);
		this.battleSetupModal.update((modal) => {
			if (!modal) return modal;
			const initiativeTieBreakers = { ...modal.initiativeTieBreakers };
			if (!text || !Number.isFinite(numeric)) delete initiativeTieBreakers[participantId];
			else initiativeTieBreakers[participantId] = numeric;
			return { ...modal, initiativeTieBreakers };
		});
	}

	launchBattleFromSetup() {
		const modal = this.battleSetupModal();
		if (!modal) return;

		const encounter = this.ls.getEncounter(modal.encounterId);
		if (!encounter) {
			this.closeBattleSetupModal();
			this.showToast({ type: 'error', text: 'Encounter nao encontrado.' });
			return;
		}

		const options: BattleEncounterCreateOptions = {
			name: modal.battleName.trim() || encounter.title,
			combatantSides: modal.sides,
			initiativeOverrides: modal.initiatives,
			initiativeTieBreakerOverrides: modal.initiativeTieBreakers,
		};

		const prepared = this.battleStorage.getOrCreateBattleFromEncounter(
			encounter,
			options,
			modal.mode === 'new',
		);
		let battle = prepared.battle;
		if (prepared.kind === 'existing' && battle.status === 'paused') {
			battle = this.battleStorage.resumeBattleEncounter(battle.id) ?? battle;
		}
		this.closeBattleSetupModal();
		this.refreshBattles();
		this.router.navigate(['/home/battle-tracker', battle.id]);
	}

	closeConfirmModal() {
		this.confirmModal.set(null);
	}

	confirmNewBattle() {
		const modal = this.confirmModal();
		if (!modal) return;

		if (modal.action === 'delete-encounter') {
			this.ls.deleteEncounter(modal.encounterId);
			this.closeConfirmModal();
			this.refresh();
			this.showToast({
				type: 'success',
				text: 'Encounter removido. Batalhas históricas foram preservadas.',
			});
			return;
		}

		const encounter = this.ls.getEncounter(modal.encounterId);
		if (!encounter) {
			this.closeConfirmModal();
			this.showToast({ type: 'error', text: 'Encounter nao encontrado.' });
			return;
		}

		this.closeConfirmModal();
		this.openBattleSetup(encounter, 'new');
	}

	latestBattle(item: EncounterHubItem): BattleEncounter | null {
		return item.activeBattle ?? item.latestBattle;
	}

	battleStatusLabel(battle: BattleEncounter | null): string {
		if (!battle) return 'Encontro preparado';
		if (battle.status === 'paused') return 'Batalha pausada';
		if (battle.status === 'completed') return 'Batalha concluída';
		return 'Batalha ativa';
	}

	itemStatusLabel(item: EncounterHubItem): string {
		if (item.status === 'prepared') return 'Encontro preparado';
		if (item.status === 'paused') return 'Batalha pausada';
		if (item.status === 'completed') return 'Batalha concluída';
		return 'Batalha ativa';
	}

	itemStatusClasses(item: EncounterHubItem): string {
		if (item.status === 'active') return 'border-amber-400/30 bg-amber-500/15 text-amber-100';
		if (item.status === 'paused') return 'border-amber-400/30 bg-amber-500/15 text-amber-100';
		if (item.status === 'completed')
			return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100';
		return 'border-sky-400/30 bg-sky-500/15 text-sky-100';
	}

	currentCombatantName(battle: BattleEncounter | null): string {
		const current = battle ? this.battleService.getCurrentCombatant(battle) : null;
		return current?.displayName || current?.name || 'Nenhum combatente ativo na iniciativa';
	}

	completeBattle(encounterId: string) {
		const battle = this.battleStorage.getActiveBattleByEncounterId(encounterId);
		if (!battle) {
			this.showToast({ type: 'warn', text: 'Nenhuma batalha ativa ou pausada para concluir.' });
			return;
		}
		this.battleStorage.completeBattleEncounter(battle.id);
		this.refresh();
		this.showToast({ type: 'success', text: 'Batalha concluída.' });
	}

	filterLabel(status: EncounterHubStatusFilter): string {
		if (status === 'prepared') return 'Encontros preparados';
		if (status === 'active') return 'Batalha ativa';
		if (status === 'paused') return 'Batalha pausada';
		if (status === 'completed') return 'Batalha concluída';
		return 'Todos';
	}

	lifecycleLabel(lifecycle: EncounterHubLifecycleFilter): string {
		if (lifecycle === 'archived') return 'Arquivados';
		if (lifecycle === 'all') return 'Todos os ciclos';
		return 'Ativos';
	}

	sortLabel(sort: EncounterHubSortOption): string {
		if (sort === 'recent') return 'Mais recentes primeiro';
		if (sort === 'oldest') return 'Mais antigos primeiro';
		if (sort === 'updated') return 'Atualizado recentemente';
		if (sort === 'name') return 'Nome A-Z';
		return 'Uso em mesa';
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

	defaultBattleSetupSide(category: unknown): BattleCombatantSide {
		if (category === 'pc') return 'player';
		if (category === 'npc' || category === 'other') return 'neutral';
		return 'enemy';
	}

	getBattleSetupEncounter(): SavedEncounter | null {
		const modal = this.battleSetupModal();
		if (!modal) return null;
		return this.ls.getEncounter(modal.encounterId);
	}

	isBattleSetupInitiativeTied(participantId: string): boolean {
		return this.getBattleSetupTieGroup(participantId).length > 1;
	}

	isBattleSetupTieResolved(participantId: string): boolean {
		const group = this.getBattleSetupTieGroup(participantId);
		if (group.length < 2) return false;
		const tieBreakers = this.battleSetupModal()?.initiativeTieBreakers ?? {};
		const values = group.map((participant) => tieBreakers[participant.id]);
		return values.every((value) => value != null) && new Set(values).size === group.length;
	}

	battleSetupTieLabel(participantId: string): string | null {
		if (!this.isBattleSetupInitiativeTied(participantId)) return null;
		return this.isBattleSetupTieResolved(participantId) ? 'Empate resolvido por DES' : 'Empate';
	}

	battleSetupInitiativeModifier(participant: EncounterParticipant): string {
		const modifier = abilityModifier(participant.sheet.abilityScores?.dex) ?? 0;
		return `${modifier >= 0 ? '+' : ''}${modifier}`;
	}

	battleSetupRowClasses(participantId: string): string {
		const base = 'app-inset grid gap-3 p-3 md:grid-cols-4 md:items-end';
		if (!this.isBattleSetupInitiativeTied(participantId)) return base;
		return this.isBattleSetupTieResolved(participantId)
			? `${base} border-amber-300/25 bg-amber-500/5`
			: `${base} border-rose-400/35 bg-rose-500/10`;
	}

	battleSetupTieBreakerInputClasses(participantId: string): string {
		const base = 'app-field w-full px-3 py-2';
		if (!this.isBattleSetupInitiativeTied(participantId)) return base;
		return this.isBattleSetupTieResolved(participantId)
			? `${base} border-amber-300/30`
			: `${base} border-rose-400/45`;
	}

	battleSetupTieBadgeClasses(participantId: string): string {
		const base = 'mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold';
		return this.isBattleSetupTieResolved(participantId)
			? `${base} border-amber-300/25 bg-amber-500/10 text-amber-100`
			: `${base} border-rose-400/35 bg-rose-500/15 text-rose-100`;
	}

	private getBattleSetupTieGroup(participantId: string): EncounterParticipant[] {
		const modal = this.battleSetupModal();
		const participants = this.getBattleSetupEncounter()?.participants ?? [];
		if (!modal) return [];
		const initiative = modal.initiatives[participantId];
		if (initiative == null) return [];
		return participants.filter((participant) => modal.initiatives[participant.id] === initiative);
	}

	private automaticTieBreakers(
		participants: EncounterParticipant[],
		initiatives: Record<string, number | null>,
		current: Record<string, number>,
	): Record<string, number> {
		return Object.fromEntries(
			participants.flatMap((participant) => {
				const initiative = initiatives[participant.id];
				const tied =
					initiative != null &&
					participants.filter((candidate) => initiatives[candidate.id] === initiative).length > 1;
				if (!tied) return [];
				const dexterity = participant.sheet.abilityScores?.dex;
				const tieBreaker = current[participant.id] ?? dexterity;
				return Number.isFinite(tieBreaker) ? [[participant.id, tieBreaker] as const] : [];
			}),
		);
	}

	updateQuery(value: string) {
		this.filters.update((filters) => ({ ...filters, query: value }));
	}

	updateTag(tag: string) {
		this.filters.update((filters) => ({ ...filters, tag }));
	}

	updateLifecycle(lifecycle: EncounterHubLifecycleFilter) {
		this.filters.update((filters) => ({ ...filters, lifecycle }));
	}

	updateStatus(status: EncounterHubStatusFilter) {
		this.filters.update((filters) => ({ ...filters, status }));
	}

	updateSort(sort: EncounterHubSortOption) {
		this.filters.update((filters) => ({ ...filters, sort }));
	}

	updateOrganization(organizationId: string) {
		this.filters.update((filters) => ({ ...filters, organizationId }));
	}

	setEmpireFilter(empireId: string) {
		this.filters.update((filters) => ({
			...filters,
			empireId,
			stateId: 'all',
			settlementId: 'all',
		}));
	}

	setStateFilter(stateId: string) {
		this.filters.update((filters) => ({ ...filters, stateId, settlementId: 'all' }));
		if (stateId === 'all') return;
		const state = this.campaignWorld.world()?.states.find((item) => item.id === stateId);
		if (state) this.filters.update((filters) => ({ ...filters, empireId: state.empireId }));
	}

	setSettlementFilter(settlementId: string) {
		this.filters.update((filters) => ({ ...filters, settlementId }));
		if (settlementId === 'all') return;
		const world = this.campaignWorld.world();
		const settlement = world?.settlements.find((item) => item.id === settlementId);
		const state = settlement && world?.states.find((item) => item.id === settlement.stateId);
		if (!state) return;
		this.filters.update((filters) => ({ ...filters, stateId: state.id, empireId: state.empireId }));
	}

	private refresh() {
		this.encounters.set(this.ls.listEncounters());
		this.refreshBattles();
	}

	private refreshBattles() {
		this.battles.set(this.battleStorage.getBattleEncounters());
	}

	private showToast(t: { type: 'success' | 'error' | 'warn'; text: string }, ms = 2200) {
		if (this.toastTimer) window.clearTimeout(this.toastTimer);
		this.toast.set(t);
		this.toastTimer = window.setTimeout(() => this.toast.set(null), ms);
	}
}
