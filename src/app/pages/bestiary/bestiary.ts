import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideSearch, LucideX, LucideZoomIn } from '@lucide/angular';
import { DialogFocusDirective } from '../../directives/dialog-focus';
import type { CompendiumMonster } from '../../models/compendium-bestiary-model';
import { CompendiumBestiaryRendererService } from '../../services/compendium-bestiary-renderer-service/compendium-bestiary-renderer-service';
import { CompendiumBestiaryRepositoryService } from '../../services/compendium-bestiary-repository-service/compendium-bestiary-repository-service';
import { CompendiumCreatureAdapterService } from '../../services/compendium-creature-adapter-service/compendium-creature-adapter-service';
import { LocalStorageService } from '../../services/local-storage-service/local-storage-service';

@Component({
	selector: 'app-bestiary',
	standalone: true,
	imports: [CommonModule, DialogFocusDirective, FormsModule, LucideSearch, LucideX, LucideZoomIn],
	templateUrl: './bestiary.html',
})
export class BestiaryPage {
	private readonly repository = inject(CompendiumBestiaryRepositoryService);
	private readonly adapter = inject(CompendiumCreatureAdapterService);
	private readonly renderer = inject(CompendiumBestiaryRendererService);
	private readonly localStorage = inject(LocalStorageService);
	private readonly router = inject(Router);

	readonly index = signal<Awaited<
		ReturnType<CompendiumBestiaryRepositoryService['getIndex']>
	> | null>(null);
	readonly selected = signal<CompendiumMonster | null>(null);
	readonly loading = signal(true);
	readonly detailLoading = signal(false);
	readonly imageLoading = signal(false);
	readonly imageFailed = signal(false);
	readonly imageLightboxOpen = signal(false);
	readonly error = signal<string | null>(null);
	readonly query = signal('');
	readonly source = signal('');
	readonly type = signal('');
	readonly size = signal('');
	readonly challengeRating = signal('');
	readonly spellcasterOnly = signal(false);
	readonly legendaryOnly = signal(false);

	readonly sources = computed(() =>
		this.unique(this.index()?.monsters.map((monster) => monster.source) ?? []),
	);
	readonly types = computed(() =>
		this.unique(this.index()?.monsters.map((monster) => monster.type ?? '') ?? []),
	);
	readonly sizes = computed(() =>
		this.unique(this.index()?.monsters.map((monster) => monster.size ?? '') ?? []),
	);
	readonly challengeRatings = computed(() =>
		this.unique(this.index()?.monsters.map((monster) => monster.challengeRating ?? '') ?? []),
	);
	readonly abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
	readonly monsters = computed(() => {
		const query = this.query().trim().toLocaleLowerCase();
		return (this.index()?.monsters ?? []).filter((monster) => {
			const searchable = [monster.name, ...monster.aliases].join(' ').toLocaleLowerCase();
			return (
				(!query || searchable.includes(query)) &&
				(!this.source() || monster.source === this.source()) &&
				(!this.type() || monster.type === this.type()) &&
				(!this.size() || monster.size === this.size()) &&
				(!this.challengeRating() || monster.challengeRating === this.challengeRating()) &&
				(!this.spellcasterOnly() || monster.hasSpellcasting) &&
				(!this.legendaryOnly() || monster.hasLegendaryActions || monster.hasLairActions)
			);
		});
	});

	constructor() {
		void this.loadIndex();
	}

	async select(source: string, name: string) {
		this.detailLoading.set(true);
		this.error.set(null);
		try {
			const monster = await this.repository.getMonster(source, name);
			if (!monster) throw new Error('Criatura não encontrada no arquivo local.');
			this.selected.set(monster);
			this.imageFailed.set(false);
			this.imageLoading.set(!!monster.imageUrl);
			this.imageLightboxOpen.set(false);
		} catch (error) {
			this.error.set(
				error instanceof Error ? error.message : 'Não foi possível carregar a criatura.',
			);
		} finally {
			this.detailLoading.set(false);
		}
	}

	onImageLoad() {
		this.imageLoading.set(false);
	}

	onImageError() {
		this.imageLoading.set(false);
		this.imageFailed.set(true);
	}

	openImageLightbox() {
		if (this.selected()?.imageUrl && !this.imageFailed()) this.imageLightboxOpen.set(true);
	}

	closeImageLightbox() {
		this.imageLightboxOpen.set(false);
	}

	isSelected(source: string, name: string) {
		const selected = this.selected();
		return selected?.source === source && selected.name === name;
	}

	toggleSpellcaster() {
		this.spellcasterOnly.update((value) => !value);
	}

	toggleLegendary() {
		this.legendaryOnly.update((value) => !value);
	}

	addToEncounter(monster: CompendiumMonster) {
		void this.router.navigate(['/home/encounter-builder'], {
			state: { compendiumMonster: { source: monster.source, name: monster.name } },
		});
	}

	createSheet(monster: CompendiumMonster) {
		const {
			officialOrigin: _origin,
			officialSnapshot: _snapshot,
			...sheet
		} = this.adapter.toCreatureSheet(monster);
		const saved = this.localStorage.createSheet({
			title: monster.name,
			data: sheet,
			category: 'monster',
			tags: [monster.type ?? 'monster', monster.source],
			source: `5eTools ${monster.source}`,
		});
		void this.router.navigate(['/home/homebrew-builder', saved.id]);
	}

	render(entries: CompendiumMonster['traits'][number]['entries']): string {
		return this.renderer.renderEntries(entries);
	}

	formatValues(values: unknown[]): string {
		return values
			.map((value) => {
				if (typeof value === 'string') return this.renderer.renderText(value);
				if (value && typeof value === 'object') {
					const record = value as Record<string, unknown>;
					return (
						[record['preNote'], record['note'], record['special']]
							.filter((part): part is string => typeof part === 'string')
							.join(' ') || JSON.stringify(value)
					);
				}
				return String(value);
			})
			.filter(Boolean)
			.join(', ');
	}

	formatRecord(value: Record<string, string>): string {
		return Object.entries(value)
			.map(([key, item]) => `${key.toUpperCase()} ${item}`)
			.join(' · ');
	}

	formatSpeed(speed: Record<string, unknown>): string {
		return Object.entries(speed)
			.map(([key, value]) => `${key} ${typeof value === 'number' ? `${value} ft.` : String(value)}`)
			.join(' · ');
	}

	private async loadIndex() {
		try {
			this.index.set(await this.repository.getIndex());
		} catch (error) {
			this.error.set(
				error instanceof Error ? error.message : 'Não foi possível carregar o bestiário local.',
			);
		} finally {
			this.loading.set(false);
		}
	}

	private unique(values: string[]): string[] {
		return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
	}
}
