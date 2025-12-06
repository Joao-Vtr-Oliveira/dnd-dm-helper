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
	}

	duplicate(id: string) {
		this.ls.duplicateEncounter(id);
		this.refresh();
	}

	remove(id: string) {
		this.ls.deleteEncounter(id);
		this.refresh();
	}

	importAndSave() {
		try {
			const { encounter, warnings } = this.io.fromJsonText(this.importText());
			const saved = this.ls.createEncounter('Imported Encounter', encounter);
			this.refresh();

			if (warnings.length) this.msg.set({ type: 'warn', text: warnings.join(' ') });
			else this.msg.set({ type: 'success', text: 'Importado e salvo.' });

			this.router.navigate(['/home/encounter-builder', saved.id]);
		} catch (err: any) {
			this.msg.set({ type: 'error', text: err?.message ?? 'Erro ao importar.' });
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
			this.msg.set({ type: 'error', text: 'Não consegui ler o arquivo.' });
		} finally {
			input.value = '';
		}
	}
}
