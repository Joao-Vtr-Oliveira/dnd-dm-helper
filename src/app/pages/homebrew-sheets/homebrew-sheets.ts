import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {
	LocalStorageService,
	SavedSheetInterface,
	HomebrewCategory,
} from '../../services/local-storage-service/local-storage-service';

type FilterAll<T extends string> = 'all' | T;

@Component({
	selector: 'app-homebrew-sheets',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './homebrew-sheets.html',
})
export class HomebrewSheets {
	private router = inject(Router);
	private ls = inject(LocalStorageService);

	sheets = signal<SavedSheetInterface[]>(this.ls.listSheets());

	q = signal('');

	categoryFilter = signal<FilterAll<HomebrewCategory>>('all');
	tagFilter = signal<FilterAll<string>>('all');
	sourceFilter = signal<FilterAll<string>>('all');

	toast = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
	private toastTimer: number | null = null;

	private showToast(t: { type: 'success' | 'error' | 'warn'; text: string }, ms = 2200) {
		if (this.toastTimer) window.clearTimeout(this.toastTimer);
		this.toast.set(t);
		this.toastTimer = window.setTimeout(() => this.toast.set(null), ms);
	}

	private refresh() {
		this.sheets.set(this.ls.listSheets());
	}

	newSheet() {
		this.router.navigate(['/home/homebrew-builder']);
	}

	edit(id: string) {
		this.router.navigate(['/home/homebrew-builder', id]);
	}

	duplicate(id: string) {
		this.ls.duplicateSheet(id);
		this.refresh();
		this.showToast({ type: 'success', text: 'Duplicated!' });
	}

	remove(id: string) {
		this.ls.deleteSheet(id);
		this.refresh();
		this.showToast({ type: 'success', text: 'Deleted' });
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
		{ id: 'PC', label: 'PCs' },
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
			version: 1,
			exportedAt: Date.now(),
			sheets: [
				{
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
		this.showToast({ type: 'success', text: 'Exported!' });
	}

	exportAllFiltered() {
		const list = this.filtered();
		if (!list.length) {
			this.showToast({ type: 'warn', text: 'Nada para exportar.' });
			return;
		}

		const payload = {
			version: 1,
			exportedAt: Date.now(),
			sheets: list.map((sheet) => ({
				title: sheet.title,
				category: sheet.category ?? 'monster',
				tags: sheet.tags ?? [],
				source: sheet.source ?? '',
				data: sheet.data,
			})),
		};

		this.downloadJson(payload, `homebrew-sheets-${list.length}.json`);
		this.showToast({ type: 'success', text: `Exported ${list.length} sheet(s)!` });
	}
}
