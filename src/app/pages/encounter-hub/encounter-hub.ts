import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type {
	BattleCombatantSide,
	BattleEncounter,
	BattleEncounterCreateOptions,
} from '../../models/battle-encounter-model';
import { BattleEncounterStorageService } from '../../services/battle-encounter-storage-service/battle-encounter-storage-service';
import {
	EncounterHubFilterService,
	type EncounterHubFilters,
	type EncounterHubItem,
	type EncounterHubSortOption,
	type EncounterHubStatusFilter,
} from '../../services/encounter-hub-filter-service/encounter-hub-filter-service';
import { EncounterIoService } from '../../services/encounter-io-service/encounter-io-service';
import {
	LocalStorageService,
	SavedEncounter,
} from '../../services/local-storage-service/local-storage-service';

type ConfirmModalState = {
	title: string;
	description: string;
	confirmLabel: string;
	encounterId: string;
};

type BattleSetupModalState = {
	encounterId: string;
	mode: 'start' | 'new';
	battleName: string;
	sides: Record<number, BattleCombatantSide>;
	initiatives: Record<number, number>;
};

@Component({
	selector: 'app-encounter-hub',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './encounter-hub.html',
})
export class EncounterHub {
	private readonly ls = inject(LocalStorageService);
	private readonly io = inject(EncounterIoService);
	private readonly router = inject(Router);
	private readonly battleStorage = inject(BattleEncounterStorageService);
	private readonly hubFilterService = inject(EncounterHubFilterService);

	private readonly initialFilters = this.hubFilterService.loadFilters();

	readonly filters = signal<EncounterHubFilters>(this.initialFilters);
	readonly importOpen = signal(false);
	readonly importText = signal('');
	readonly msg = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
	readonly encounters = signal<SavedEncounter[]>(this.ls.listEncounters());
	readonly battles = signal<BattleEncounter[]>(this.battleStorage.getBattleEncounters());
	readonly toast = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
	readonly confirmModal = signal<ConfirmModalState | null>(null);
	readonly battleSetupModal = signal<BattleSetupModalState | null>(null);

	private toastTimer: number | null = null;

	readonly items = computed(() =>
		this.hubFilterService.buildItems(this.encounters(), this.battles())
	);

	readonly filteredItems = computed(() =>
		this.hubFilterService.sortItems(
			this.hubFilterService.filterItems(this.items(), this.filters()),
			this.filters().sort
		)
	);

	readonly groupedItems = computed(() => this.hubFilterService.groupItems(this.filteredItems()));

	readonly ongoingBattles = computed(() =>
		this.battles().filter((battle) => battle.status === 'active' || battle.status === 'paused')
	);

	constructor() {
		effect(() => {
			this.hubFilterService.saveFilters(this.filters());
		});
	}

	newEncounter() {
		this.router.navigate(['/home/encounter-builder']);
	}

	edit(id: string) {
		this.router.navigate(['/home/encounter-builder', id]);
	}

	export(id: string) {
		const item = this.ls.getEncounter(id);
		if (!item) return;

		this.io.download(item.data, item.title, {
			includeDate: false,
			suffix: id.slice(0, 6),
		});
		this.showToast({ type: 'success', text: 'Encounter exportado.' });
	}

	duplicate(id: string) {
		this.ls.duplicateEncounter(id);
		this.refresh();
		this.showToast({ type: 'success', text: 'Encounter duplicado.' });
	}

	remove(id: string) {
		this.ls.deleteEncounter(id);
		this.refresh();
		this.showToast({ type: 'success', text: 'Encounter removido.' });
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
			encounter.data.creatures.map((creature) => [creature.id, 'enemy' as BattleCombatantSide])
		);
		const initiatives = Object.fromEntries(
			encounter.data.creatures.map((creature) => [creature.id, Number(creature.initiative ?? 0)])
		);

		this.battleSetupModal.set({
			encounterId: encounter.id,
			mode,
			battleName: encounter.title,
			sides,
			initiatives,
		});
	}

	closeBattleSetupModal() {
		this.battleSetupModal.set(null);
	}

	setBattleSetupName(value: string) {
		this.battleSetupModal.update((modal) => (modal ? { ...modal, battleName: value } : modal));
	}

	setBattleSetupSide(creatureId: number, side: BattleCombatantSide) {
		this.battleSetupModal.update((modal) =>
			modal
				? {
						...modal,
						sides: {
							...modal.sides,
							[creatureId]: side,
						},
				  }
				: modal
		);
	}

	setBattleSetupInitiative(creatureId: number, value: unknown) {
		const numeric = Number(value);
		this.battleSetupModal.update((modal) =>
			modal
				? {
						...modal,
						initiatives: {
							...modal.initiatives,
							[creatureId]: Number.isFinite(numeric) ? numeric : 0,
						},
				  }
				: modal
		);
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
		};

		const battle = this.battleStorage.createBattleFromEncounter(encounter, options);
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
		if (item.status === 'active') return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100';
		if (item.status === 'paused') return 'border-amber-400/30 bg-amber-500/15 text-amber-100';
		if (item.status === 'completed') return 'border-slate-300/20 bg-slate-500/10 text-slate-100';
		return 'border-sky-400/30 bg-sky-500/15 text-sky-100';
	}

	currentCombatantName(battle: BattleEncounter | null): string {
		if (!battle || battle.activeTurnIndex < 0) return 'Sem combatentes';
		return (
			battle.combatants[battle.activeTurnIndex]?.displayName ||
			battle.combatants[battle.activeTurnIndex]?.name ||
			'Sem combatentes'
		);
	}

	filterLabel(status: EncounterHubStatusFilter): string {
		if (status === 'prepared') return 'Encontros preparados';
		if (status === 'active') return 'Batalha ativa';
		if (status === 'paused') return 'Batalha pausada';
		if (status === 'completed') return 'Batalha concluída';
		return 'Todos';
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

	getBattleSetupEncounter(): SavedEncounter | null {
		const modal = this.battleSetupModal();
		if (!modal) return null;
		return this.ls.getEncounter(modal.encounterId);
	}

	updateQuery(value: string) {
		this.filters.update((filters) => ({ ...filters, query: value }));
	}

	updateStatus(status: EncounterHubStatusFilter) {
		this.filters.update((filters) => ({ ...filters, status }));
	}

	updateSort(sort: EncounterHubSortOption) {
		this.filters.update((filters) => ({ ...filters, sort }));
	}

	importAndSave() {
		try {
			const { encounter, warnings } = this.io.fromJsonText(this.importText());
			const saved = this.ls.createEncounter('Imported Encounter', encounter);
			this.refresh();

			if (warnings.length) this.msg.set({ type: 'warn', text: warnings.join(' ') });
			else this.showToast({ type: 'success', text: 'Encounter importado e salvo.' });

			this.router.navigate(['/home/encounter-builder', saved.id]);
		} catch (err: any) {
			this.showToast({ type: 'error', text: err?.message ?? 'Erro ao importar.' });
		}
	}

	async onFileSelected(ev: Event) {
		const input = ev.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		try {
			const text = await file.text();
			this.importText.set(text);
			this.importAndSave();
		} catch {
			this.msg.set({ type: 'error', text: 'Não foi possível ler o arquivo.' });
		} finally {
			input.value = '';
		}
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
