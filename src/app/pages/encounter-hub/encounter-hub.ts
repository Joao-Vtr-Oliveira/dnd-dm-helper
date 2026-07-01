import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { BattleEncounter } from '../../models/battle-encounter-model';
import { BattleEncounterStorageService } from '../../services/battle-encounter-storage-service/battle-encounter-storage-service';
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

	readonly q = signal('');
	readonly importOpen = signal(false);
	readonly importText = signal('');
	readonly msg = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
	readonly encounters = signal<SavedEncounter[]>(this.ls.listEncounters());
	readonly battles = signal<BattleEncounter[]>(this.battleStorage.getBattleEncounters());
	readonly toast = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
	readonly confirmModal = signal<ConfirmModalState | null>(null);

	private toastTimer: number | null = null;

	readonly filtered = computed(() => {
		const q = this.q().trim().toLowerCase();
		const all = this.encounters();
		if (!q) return all;
		return all.filter((encounter) => encounter.title.toLowerCase().includes(q));
	});

	readonly ongoingBattles = computed(() =>
		this.battles().filter((battle) => battle.status === 'active' || battle.status === 'paused')
	);

	readonly activeBattleByEncounterId = computed(() => {
		const map = new Map<string, BattleEncounter>();

		for (const battle of this.ongoingBattles()) {
			const previous = map.get(battle.sourceEncounterId);
			if (!previous || Date.parse(battle.updatedAt) > Date.parse(previous.updatedAt)) {
				map.set(battle.sourceEncounterId, battle);
			}
		}

		return map;
	});

	readonly hasAnyBattleByEncounterId = computed(() => {
		const set = new Set<string>();
		for (const battle of this.battles()) {
			set.add(battle.sourceEncounterId);
		}
		return set;
	});

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

		const existing = this.battleStorage.getActiveBattleByEncounterId(encounterId);
		if (existing) {
			this.openBattle(existing.id);
			return;
		}

		const battle = this.battleStorage.createBattleFromEncounter(encounter);
		this.refreshBattles();
		this.router.navigate(['/home/battle-tracker', battle.id]);
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
					'Ja existe uma batalha ativa ou pausada para este encounter. A batalha atual sera mantida, mas voce abrira uma nova sessao local.',
				confirmLabel: 'Criar nova batalha',
				encounterId,
			});
			return;
		}

		this.createBattleAndNavigate(encounter);
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
		this.createBattleAndNavigate(encounter);
	}

	openBattle(battleId: string) {
		this.router.navigate(['/home/battle-tracker', battleId]);
	}

	relatedBattle(encounterId: string): BattleEncounter | null {
		return this.activeBattleByEncounterId().get(encounterId) ?? null;
	}

	hasAnyBattle(encounterId: string): boolean {
		return this.hasAnyBattleByEncounterId().has(encounterId);
	}

	battleStatusLabel(battle: BattleEncounter | null): string {
		if (!battle) return '';
		if (battle.status === 'paused') return 'Pausada';
		if (battle.status === 'completed') return 'Concluida';
		return 'Ativa';
	}

	currentCombatantName(battle: BattleEncounter): string {
		if (battle.activeTurnIndex < 0) return 'Sem combatentes';
		return battle.combatants[battle.activeTurnIndex]?.displayName || battle.combatants[battle.activeTurnIndex]?.name || 'Sem combatentes';
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
			this.msg.set({ type: 'error', text: 'Nao foi possivel ler o arquivo.' });
		} finally {
			input.value = '';
		}
	}

	private refresh() {
		this.encounters.set(this.ls.listEncounters());
		this.refreshBattles();
	}

	private createBattleAndNavigate(encounter: SavedEncounter) {
		const battle = this.battleStorage.createBattleFromEncounter(encounter);
		this.refreshBattles();
		this.router.navigate(['/home/battle-tracker', battle.id]);
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
