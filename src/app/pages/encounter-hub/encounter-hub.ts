import { Component, computed, inject, NgModule, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { EncounterIoService } from '../../services/encounter-io-service/encounter-io-service';
import {
	LocalStorageService,
	SavedEncounter,
} from '../../services/local-storage-service/local-storage-service';
import { FormsModule } from '@angular/forms';

@Component({
	selector: 'app-encounter-hub',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './encounter-hub.html',
})
export class EncounterHub {
	private ls = inject(LocalStorageService);
	private io = inject(EncounterIoService);
	private router = inject(Router);

	q = signal('');
	importOpen = signal(false);
	importText = signal('');
	msg = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);

	encounters = signal<SavedEncounter[]>(this.ls.listEncounters());

	toast = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
	private toastTimer: number | null = null;

	private showToast(t: { type: 'success' | 'error' | 'warn'; text: string }, ms = 2200) {
		if (this.toastTimer) window.clearTimeout(this.toastTimer);
		this.toast.set(t);
		this.toastTimer = window.setTimeout(() => this.toast.set(null), ms);
	}

	filtered = computed(() => {
		const q = this.q().trim().toLowerCase();
		const all = this.encounters();
		if (!q) return all;
		return all.filter((e) => e.title.toLowerCase().includes(q));
	});

	private refresh() {
		this.encounters.set(this.ls.listEncounters());
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
		this.showToast({ type: 'success', text: 'Exported!' });
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

	importAndSave() {
		try {
			const { encounter, warnings } = this.io.fromJsonText(this.importText());
			const saved = this.ls.createEncounter('Imported Encounter', encounter);
			this.refresh();

			if (warnings.length) this.msg.set({ type: 'warn', text: warnings.join(' ') });
			else this.showToast({ type: 'success', text: 'Imported and saved' });

			this.router.navigate(['/home/encounter-builder', saved.id]);
		} catch (err: any) {
			this.showToast({ type: 'error', text: err?.message ?? 'Error importing.' });
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
			this.msg.set({ type: 'error', text: 'An error ocurred trying to read the file.' });
		} finally {
			input.value = '';
		}
	}
}
