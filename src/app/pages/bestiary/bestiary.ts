import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideSearch, LucideX, LucideZoomIn } from '@lucide/angular';
import { AppSelectComponent, type AppSelectOption } from '../../components/app-select/app-select';
import { CreatureStatBlockComponent } from '../../components/creature-stat-block/creature-stat-block';
import { SpellQuickViewComponent } from '../../components/spell-quick-view/spell-quick-view';
import { DialogFocusDirective } from '../../directives/dialog-focus';
import type { CompendiumMonster } from '../../models/compendium-bestiary-model';
import type { CreatureSpell } from '../../models/creature-sheet-model';
import type { ResolvedSpellReference } from '../../models/spell-reference-model';
import { CompendiumBestiaryRepositoryService } from '../../services/compendium-bestiary-repository-service/compendium-bestiary-repository-service';
import { CompendiumCreatureAdapterService } from '../../services/compendium-creature-adapter-service/compendium-creature-adapter-service';
import { LocalStorageService } from '../../services/local-storage-service/local-storage-service';
import { SpellReferenceResolverService } from '../../services/spell-reference-resolver-service/spell-reference-resolver-service';

@Component({
	selector: 'app-bestiary',
	standalone: true,
	imports: [
		AppSelectComponent,
		CreatureStatBlockComponent,
		SpellQuickViewComponent,
		CommonModule,
		DialogFocusDirective,
		FormsModule,
		LucideSearch,
		LucideX,
		LucideZoomIn,
	],
	templateUrl: './bestiary.html',
})
export class BestiaryPage {
	private readonly repository = inject(CompendiumBestiaryRepositoryService);
	private readonly adapter = inject(CompendiumCreatureAdapterService);
	private readonly localStorage = inject(LocalStorageService);
	private readonly router = inject(Router);
	private readonly spellResolver = inject(SpellReferenceResolverService);

	readonly index = signal<Awaited<
		ReturnType<CompendiumBestiaryRepositoryService['getIndex']>
	> | null>(null);
	readonly selected = signal<CompendiumMonster | null>(null);
	readonly selectedCreatureSheet = computed(() => {
		const monster = this.selected();
		return monster ? this.adapter.toCreatureSheet(monster) : null;
	});
	readonly loading = signal(true);
	readonly detailLoading = signal(false);
	readonly imageLoading = signal(false);
	readonly imageFailed = signal(false);
	readonly imageLightboxOpen = signal(false);
	readonly quickSpell = signal<ResolvedSpellReference | null>(null);
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
	readonly challengeRatings = computed(() => {
		const values = this.unique(
			this.index()?.monsters.map((monster) => monster.challengeRating ?? '') ?? [],
		);
		return values.sort((left, right) => this.compareChallengeRatings(left, right));
	});
	readonly sourceOptions = computed(() => this.toSelectOptions(this.sources()));
	readonly typeOptions = computed(() => this.toSelectOptions(this.types()));
	readonly sizeOptions = computed(() => this.toSelectOptions(this.sizes()));
	readonly challengeRatingOptions = computed(() => this.toSelectOptions(this.challengeRatings()));
	readonly abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
	readonly abilityLabels = {
		str: 'FOR',
		dex: 'DES',
		con: 'CON',
		int: 'INT',
		wis: 'SAB',
		cha: 'CAR',
	};
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
			if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1279px)').matches) {
				setTimeout(() =>
					document
						.getElementById('bestiary-detail')
						?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
				);
			}
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

	async openSpell(spell: CreatureSpell) {
		const resolved = await this.spellResolver.resolveReference({
			name: spell.name,
			source: spell.source,
		});
		if (resolved) this.quickSpell.set(resolved);
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

	private toSelectOptions(values: readonly string[]): AppSelectOption[] {
		return values.map((value) => ({ value, label: value }));
	}

	private compareChallengeRatings(left: string, right: string) {
		const difference = this.challengeRatingValue(left) - this.challengeRatingValue(right);
		return difference || left.localeCompare(right);
	}

	private challengeRatingValue(value: string) {
		const fraction = value.trim().match(/^(\d+)\s*\/\s*(\d+)/);
		if (fraction) return Number(fraction[1]) / Number(fraction[2]);
		const numeric = Number(value);
		return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
	}
}
