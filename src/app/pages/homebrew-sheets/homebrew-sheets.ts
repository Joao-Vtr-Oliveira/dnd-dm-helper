import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
	LocalStorageService,
	SavedEncounter,
	SavedSheetInterface,
} from '../../services/local-storage-service/local-storage-service';

@Component({
	selector: 'app-homebrew-sheets',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './homebrew-sheets.html',
})
export class HomebrewSheets {
	private router = inject(Router);
	private ls = inject(LocalStorageService);

	q = signal('');

	toast = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
	private toastTimer: number | null = null;

	private showToast(t: { type: 'success' | 'error' | 'warn'; text: string }, ms = 2200) {
		if (this.toastTimer) window.clearTimeout(this.toastTimer);
		this.toast.set(t);
		this.toastTimer = window.setTimeout(() => this.toast.set(null), ms);
	}

	newSheet() {
		this.router.navigate(['/home/homebrew-builder']);
	}

	sheets = signal<SavedSheetInterface[]>(this.ls.listSheets());

	filtered = computed(() => {
		const q = this.q().trim().toLowerCase();
		const all = this.sheets();
		if (!q) return all;
		return all.filter((e) => e.title.toLowerCase().includes(q));
	});

	private refresh() {
		this.sheets.set(this.ls.listSheets());
	}

	edit(id: string) {
		this.router.navigate(['/home/encounter-builder', id]);
	}

	duplicate(id: string) {
		this.ls.duplicateEncounter(id);
		this.refresh();
		this.showToast({ type: 'success', text: 'Duplicated!' });
	}

	remove(id: string) {
		this.ls.deleteEncounter(id);
		this.refresh();
		this.showToast({ type: 'success', text: 'Deleted' });
	}
}
