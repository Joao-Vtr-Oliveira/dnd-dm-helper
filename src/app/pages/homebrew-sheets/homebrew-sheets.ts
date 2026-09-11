import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
	LucideCircleAlert,
	LucideCircleCheck,
	LucideEllipsis,
	LucideTriangleAlert,
	LucideX,
} from '@lucide/angular';

import {
	LocalStorageService,
	SavedSheetInterface,
	HomebrewCategory,
} from '../../services/local-storage-service/local-storage-service';
import { FiveEToolsHomebrewService } from '../../services/fiveetools-homebrew-service/fiveetools-homebrew-service';
import { DialogFocusDirective } from '../../directives/dialog-focus';
import {
	HomebrewSheetImportService,
	type HomebrewSheetConflictResolution,
	type HomebrewSheetImportPreview,
	type HomebrewSheetImportResult,
} from '../../services/homebrew-sheet-import-service/homebrew-sheet-import-service';

type FilterAll<T extends string> = 'all' | T;

type ConfirmModalState = {
	action: 'delete-sheet' | 'add-to-fiveetools';
	sheetId: string;
	title: string;
	description: string;
	confirmLabel: string;
};

@Component({
	selector: 'app-homebrew-sheets',
	standalone: true,
	imports: [
		CommonModule,
		DialogFocusDirective,
		FormsModule,
		LucideCircleAlert,
		LucideCircleCheck,
		LucideEllipsis,
		LucideTriangleAlert,
		LucideX,
	],
	templateUrl: './homebrew-sheets.html',
})
export class HomebrewSheets {
	private router = inject(Router);
	private ls = inject(LocalStorageService);
	private fiveEToolsService = inject(FiveEToolsHomebrewService);
	private sheetImportService = inject(HomebrewSheetImportService);

	sheets = signal<SavedSheetInterface[]>(this.ls.listSheets());

	q = signal('');

	categoryFilter = signal<FilterAll<HomebrewCategory>>('all');
	tagFilter = signal<FilterAll<string>>('all');
	sourceFilter = signal<FilterAll<string>>('all');

	toast = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
	importOpen = signal(false);
	importText = signal('');
	importPreview = signal<HomebrewSheetImportPreview | null>(null);
	importResolutions = signal<Record<number, HomebrewSheetConflictResolution>>({});
	importResult = signal<HomebrewSheetImportResult | null>(null);
	confirmModal = signal<ConfirmModalState | null>(null);
	actionMenuSheetId = signal<string | null>(null);
	fiveEToolsLoading = signal<string | null>(null);
	private importFileInput: HTMLInputElement | null = null;
	private toastTimer: number | null = null;

	private showToast(t: { type: 'success' | 'error' | 'warn'; text: string }, ms = 2200) {
		if (this.toastTimer) window.clearTimeout(this.toastTimer);
		this.toast.set(t);
		this.toastTimer = window.setTimeout(() => this.toast.set(null), ms);
	}

	private refresh() {
		this.sheets.set(this.ls.listSheets());
	}

	readonly filtersActive = computed(
		() =>
			!!this.q().trim() ||
			this.categoryFilter() !== 'all' ||
			this.tagFilter() !== 'all' ||
			this.sourceFilter() !== 'all',
	);

	@HostListener('document:keydown.escape')
	onEscape() {
		if (this.importOpen()) {
			this.closeImport();
			return;
		}
		if (this.confirmModal()) {
			this.closeConfirmModal();
			return;
		}
		this.closeActionMenu();
	}

	toggleActionMenu(sheetId: string) {
		this.actionMenuSheetId.update((openId) => (openId === sheetId ? null : sheetId));
	}

	closeActionMenu() {
		this.actionMenuSheetId.set(null);
	}

	newSheet() {
		this.router.navigate(['/home/homebrew-builder']);
	}

	openImport() {
		this.importOpen.set(true);
		this.importText.set('');
		this.importPreview.set(null);
		this.importResolutions.set({});
		this.importResult.set(null);
	}

	closeImport() {
		this.importOpen.set(false);
		this.importPreview.set(null);
		this.importResult.set(null);
		if (this.importFileInput) this.importFileInput.value = '';
	}

	async onImportFile(event: Event) {
		const input = event.target as HTMLInputElement;
		this.importFileInput = input;
		const file = input.files?.[0];
		if (!file) return;
		try {
			this.importText.set(await file.text());
			this.previewImport();
		} catch {
			this.showToast({ type: 'error', text: 'Não foi possível ler o arquivo JSON.' });
		}
	}

	previewImport() {
		try {
			const preview = this.sheetImportService.parseText(this.importText());
			this.importPreview.set(preview);
			this.importResolutions.set(
				Object.fromEntries(preview.conflicts.map((conflict) => [conflict.index, conflict.resolution])),
			);
		} catch (error) {
			this.importPreview.set(null);
			this.showToast({
				type: 'error',
				text: error instanceof Error ? error.message : 'JSON incompatível.',
			});
		}
	}

	setImportResolution(index: number, resolution: HomebrewSheetConflictResolution) {
		this.importResolutions.update((current) => ({ ...current, [index]: resolution }));
	}

	importResolution(index: number): HomebrewSheetConflictResolution {
		return this.importResolutions()[index] ?? 'replace';
	}

	confirmImport() {
		const preview = this.importPreview();
		if (!preview) return;
		try {
			const result = this.sheetImportService.apply(preview, this.importResolutions());
			this.importResult.set(result);
			this.importPreview.set(null);
			this.importOpen.set(false);
			this.refresh();
			this.showToast({ type: 'success', text: 'Importação de fichas concluída.' });
		} catch (error) {
			this.showToast({
				type: 'error',
				text: error instanceof Error ? error.message : 'Não foi possível importar as fichas.',
			});
		}
	}

	edit(id: string) {
		this.router.navigate(['/home/homebrew-builder', id]);
	}

	duplicate(id: string) {
		this.ls.duplicateSheet(id);
		this.refresh();
		this.showToast({ type: 'success', text: 'Ficha duplicada.' });
	}

	remove(id: string) {
		const sheet = this.sheets().find((item) => item.id === id);
		if (!sheet) return;
		this.confirmModal.set({
			action: 'delete-sheet',
			sheetId: id,
			title: 'Deletar ficha?',
			description:
				'Esta ficha será removida da biblioteca. Encounters e batalhas que já usam uma cópia dela serão preservados.',
			confirmLabel: 'Deletar ficha',
		});
	}

	async addToFiveETools(id: string) {
		const sheet = this.sheets().find((item) => item.id === id);
		if (!sheet) return;

		try {
			this.fiveEToolsLoading.set(id);
			const file = await this.fiveEToolsService.loadLocalHomebrewJson();
			const monster = this.fiveEToolsService.convertSheetToMonster(sheet, this.fiveEToolsService.buildSummary(file).primarySource);
			const exists = (file.monster ?? []).some(
				(item) => item.name === monster.name && item.source === monster.source,
			);
			this.confirmModal.set({
				action: 'add-to-fiveetools',
				sheetId: id,
				title: exists ? 'Substituir monstro no 5etools?' : 'Adicionar monstro ao 5etools?',
				description: exists
					? `Já existe um monstro chamado ${monster.name} na origem ${monster.source}. Ele será substituído.`
					: `Um novo monstro chamado ${monster.name} será criado na origem ${monster.source}.`,
				confirmLabel: exists ? 'Substituir no 5etools' : 'Adicionar ao 5etools',
			});
		} catch (error) {
			this.showToast({
				type: 'error',
				text: error instanceof Error ? error.message : 'Erro ao adicionar ficha ao arquivo 5etools.',
			});
		} finally {
			this.fiveEToolsLoading.set(null);
		}
	}

	closeConfirmModal() {
		this.confirmModal.set(null);
	}

	confirmAction() {
		const modal = this.confirmModal();
		if (!modal) return;
		if (modal.action === 'delete-sheet') {
			this.ls.deleteSheet(modal.sheetId);
			this.closeConfirmModal();
			this.refresh();
			this.showToast({ type: 'success', text: 'Ficha removida.' });
			return;
		}
		this.closeConfirmModal();
		this.saveToFiveETools(modal.sheetId);
	}

	private async saveToFiveETools(id: string) {
		const sheet = this.sheets().find((item) => item.id === id);
		if (!sheet) return;
		try {
			this.fiveEToolsLoading.set(id);
			const file = await this.fiveEToolsService.loadLocalHomebrewJson();
			this.fiveEToolsService.createBackup(file, `Antes de adicionar ficha interna: ${sheet.title}`);
			const monster = this.fiveEToolsService.convertSheetToMonster(
				sheet,
				this.fiveEToolsService.buildSummary(file).primarySource,
			);
			this.fiveEToolsService.saveHomebrewFile(this.fiveEToolsService.upsertMonster(file, monster));
			this.showToast({ type: 'success', text: 'Ficha adicionada ao arquivo 5etools.' });
		} catch (error) {
			this.showToast({
				type: 'error',
				text: error instanceof Error ? error.message : 'Erro ao adicionar ficha ao arquivo 5etools.',
			});
		} finally {
			this.fiveEToolsLoading.set(null);
		}
	}

	// ---------- helpers ----------
	private norm(s: string) {
		return (s ?? '')
			.toString()
			.trim()
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '');
	}

	private downloadJson(obj: unknown, filename: string) {
		const json = JSON.stringify(obj, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();

		URL.revokeObjectURL(url);
	}

	// ---------- options p/ selects ----------
	CATEGORIES: { id: FilterAll<HomebrewCategory>; label: string }[] = [
		{ id: 'all', label: 'Todas' },
		{ id: 'monster', label: 'Monstros' },
		{ id: 'npc', label: 'NPCs' },
		{ id: 'pc', label: 'PCs' },
		{ id: 'other', label: 'Outros' },
	];

	allTags = computed(() => {
		const set = new Set<string>();
		for (const s of this.sheets()) {
			for (const t of s.tags ?? []) set.add(t);
		}
		return ['all', ...Array.from(set).sort()] as const;
	});

	allSources = computed(() => {
		const set = new Set<string>();
		for (const s of this.sheets()) {
			const src = (s.source ?? '').trim();
			if (src) set.add(src);
		}
		return ['all', ...Array.from(set).sort()] as const;
	});

	setTagQuickFilter(tag: string) {
		this.q.set(tag);
	}

	clearFilters() {
		this.q.set('');
		this.categoryFilter.set('all');
		this.tagFilter.set('all');
		this.sourceFilter.set('all');
	}

	// ---------- filtro principal ----------
	filtered = computed(() => {
		const q = this.norm(this.q());
		const cat = this.categoryFilter();
		const tag = this.tagFilter();
		const src = this.sourceFilter();

		return this.sheets().filter((s) => {
			// categoria
			if (cat !== 'all' && (s.category ?? 'monster') !== cat) return false;

			// tag
			if (tag !== 'all') {
				const tags = (s.tags ?? []).map((t) => this.norm(t));
				if (!tags.includes(this.norm(tag))) return false;
			}

			// source
			if (src !== 'all' && this.norm(s.source ?? '') !== this.norm(src)) return false;

			// search geral
			if (!q) return true;

			const hay = [
				s.title,
				s.data?.name ?? '',
				(s.tags ?? []).join(' '),
				s.source ?? '',
				s.category ?? '',
			]
				.map((x) => this.norm(x))
				.join(' ');

			return hay.includes(q);
		});
	});

	// ---------- export ----------
	exportOne(id: string) {
		const sheet = this.sheets().find((x) => x.id === id);
		if (!sheet) return;

		const payload = {
			app: 'dnd-dm-helper',
			type: 'homebrew-sheets',
			schemaVersion: 1,
			exportedAt: new Date().toISOString(),
			sheets: [
				{
					externalId: sheet.externalId,
					title: sheet.title,
					category: sheet.category ?? 'monster',
					tags: sheet.tags ?? [],
					source: sheet.source ?? '',
					data: sheet.data,
				},
			],
		};

		const safeName =
			this.norm(sheet.title)
				.replace(/[^a-z0-9]+/g, '-')
				.slice(0, 40) || 'homebrew';
		this.downloadJson(payload, `homebrew-${safeName}.json`);
		this.showToast({ type: 'success', text: 'Ficha exportada.' });
	}
}
