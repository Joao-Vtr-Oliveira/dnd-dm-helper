import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
	LucideHeartPulse,
	LucideSearch,
	LucideShield,
	LucideX,
	LucideZoomIn,
} from '@lucide/angular';
import { AppSelectComponent, type AppSelectOption } from '../../components/app-select/app-select';
import { DialogFocusDirective } from '../../directives/dialog-focus';
import type { CompendiumMonster } from '../../models/compendium-bestiary-model';
import { CompendiumRendererService } from '../../services/compendium-renderer-service/compendium-renderer-service';
import { CompendiumBestiaryRepositoryService } from '../../services/compendium-bestiary-repository-service/compendium-bestiary-repository-service';
import { CompendiumCreatureAdapterService } from '../../services/compendium-creature-adapter-service/compendium-creature-adapter-service';
import { LocalStorageService } from '../../services/local-storage-service/local-storage-service';

@Component({
	selector: 'app-bestiary',
	standalone: true,
	imports: [
		AppSelectComponent,
		CommonModule,
		DialogFocusDirective,
		FormsModule,
		LucideHeartPulse,
		LucideSearch,
		LucideShield,
		LucideX,
		LucideZoomIn,
	],
	templateUrl: './bestiary.html',
})
export class BestiaryPage {
	private readonly repository = inject(CompendiumBestiaryRepositoryService);
	private readonly adapter = inject(CompendiumCreatureAdapterService);
	private readonly renderer = inject(CompendiumRendererService);
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

	abilityModifier(score: number | undefined) {
		if (typeof score !== 'number') return '-';
		const modifier = Math.floor((score - 10) / 2);
		return modifier >= 0 ? `+${modifier}` : String(modifier);
	}

	formatCreatureMetadata(monster: CompendiumMonster) {
		const sizes: Record<string, string> = {
			T: 'Tiny',
			S: 'Small',
			M: 'Medium',
			L: 'Large',
			H: 'Huge',
			G: 'Gargantuan',
		};
		const alignments: Record<string, string> = {
			LG: 'Lawful Good',
			NG: 'Neutral Good',
			CG: 'Chaotic Good',
			LN: 'Lawful Neutral',
			N: 'Neutral',
			CN: 'Chaotic Neutral',
			LE: 'Lawful Evil',
			NE: 'Neutral Evil',
			CE: 'Chaotic Evil',
			U: 'Unaligned',
		};
		const size = monster.sizes.map((value) => sizes[value] ?? value).join('/');
		const type = monster.type ? this.toDisplayText(monster.type) : 'Creature';
		const subtype = monster.subtypes.length
			? ` (${monster.subtypes.map((value) => this.toDisplayText(value)).join(', ')})`
			: '';
		const alignmentValue = monster.alignment
			.filter((value): value is string => typeof value === 'string')
			.join('');
		const alignment =
			alignments[alignmentValue.toUpperCase()] ?? this.toDisplayText(alignmentValue);
		return `${size} ${type}${subtype} · ${alignment || 'alignment not specified'}`;
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

	private toDisplayText(value: string) {
		return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
	}
}
