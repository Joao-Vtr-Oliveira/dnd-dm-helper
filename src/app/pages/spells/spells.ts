import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideSearch, LucideSparkles } from '@lucide/angular';
import { AppSelectComponent, type AppSelectOption } from '../../components/app-select/app-select';
import type {
	CompendiumSpell,
	CompendiumSpellListEntry,
} from '../../models/compendium-spell-model';
import { CompendiumRendererService } from '../../services/compendium-renderer-service/compendium-renderer-service';
import { CompendiumSpellRepositoryService } from '../../services/compendium-spell-repository-service/compendium-spell-repository-service';

@Component({
	selector: 'app-spells',
	standalone: true,
	imports: [AppSelectComponent, CommonModule, FormsModule, LucideSearch, LucideSparkles],
	templateUrl: './spells.html',
})
export class SpellsPage {
	private readonly repository = inject(CompendiumSpellRepositoryService);
	private readonly renderer = inject(CompendiumRendererService);
	private selectionRequest = 0;

	readonly index = signal<Awaited<ReturnType<CompendiumSpellRepositoryService['getIndex']>> | null>(
		null,
	);
	readonly selected = signal<CompendiumSpell | null>(null);
	readonly loading = signal(true);
	readonly detailLoading = signal(false);
	readonly error = signal<string | null>(null);
	readonly query = signal('');
	readonly source = signal('');
	readonly level = signal('');
	readonly school = signal('');
	readonly spellClass = signal('');
	readonly concentrationOnly = signal(false);
	readonly ritualOnly = signal(false);

	readonly sources = computed(() =>
		this.unique(this.index()?.spells.map((spell) => spell.source) ?? []),
	);
	readonly levels = computed(() =>
		[...new Set(this.index()?.spells.map((spell) => spell.level) ?? [])].sort(
			(left, right) => left - right,
		),
	);
	readonly schools = computed(() =>
		this.unique(this.index()?.spells.map((spell) => spell.school) ?? []),
	);
	readonly classes = computed(() =>
		this.unique(this.index()?.spells.flatMap((spell) => spell.classes) ?? []),
	);
	readonly sourceOptions = computed(() => this.toSelectOptions(this.sources()));
	readonly levelOptions = computed(() =>
		this.levels().map((value) => ({ value: String(value), label: this.levelLabel(value) })),
	);
	readonly schoolOptions = computed(() =>
		this.schools().map((value) => ({ value, label: this.schoolLabel(value) })),
	);
	readonly classOptions = computed(() => this.toSelectOptions(this.classes()));
	readonly spells = computed(() => {
		const query = this.query().trim().toLocaleLowerCase();
		return (this.index()?.spells ?? []).filter((spell) => {
			const searchable = [spell.name, ...spell.aliases].join(' ').toLocaleLowerCase();
			return (
				(!query || searchable.includes(query)) &&
				(!this.source() || spell.source === this.source()) &&
				(!this.level() || spell.level === Number(this.level())) &&
				(!this.school() || spell.school === this.school()) &&
				(!this.spellClass() || spell.classes.includes(this.spellClass())) &&
				(!this.concentrationOnly() || spell.concentration) &&
				(!this.ritualOnly() || spell.ritual)
			);
		});
	});

	constructor() {
		void this.loadIndex();
	}

	async select(spell: CompendiumSpellListEntry) {
		const request = ++this.selectionRequest;
		this.detailLoading.set(true);
		this.error.set(null);
		try {
			const selected = await this.repository.getSpell(spell.source, spell.name);
			if (!selected) throw new Error('Magia não encontrada no arquivo local.');
			if (request === this.selectionRequest) this.selected.set(selected);
		} catch (error) {
			if (request === this.selectionRequest) {
				this.error.set(
					error instanceof Error ? error.message : 'Não foi possível carregar a magia.',
				);
			}
		} finally {
			if (request === this.selectionRequest) this.detailLoading.set(false);
		}
	}

	isSelected(spell: CompendiumSpellListEntry) {
		const selected = this.selected();
		return selected?.source === spell.source && selected.name === spell.name;
	}

	toggleConcentration() {
		this.concentrationOnly.update((value) => !value);
	}

	toggleRitual() {
		this.ritualOnly.update((value) => !value);
	}

	levelLabel(level: number) {
		return level === 0 ? 'Truque' : `${level}º nível`;
	}

	schoolLabel(school: string) {
		const labels: Record<string, string> = {
			A: 'Abjuração',
			C: 'Conjuração',
			D: 'Adivinhação',
			E: 'Encantamento',
			EV: 'Evocação',
			V: 'Evocação',
			I: 'Ilusão',
			N: 'Necromancia',
			T: 'Transmutação',
		};
		return labels[school.toUpperCase()] ?? school;
	}

	componentsLabel(components: CompendiumSpell['components']) {
		const values = [
			components.verbal && 'V',
			components.somatic && 'S',
			components.material && 'M',
		].filter(Boolean);
		return values.join(', ') || '-';
	}

	render(entries: CompendiumSpell['entries']) {
		return this.renderer.renderEntries(entries);
	}

	private async loadIndex() {
		try {
			this.index.set(await this.repository.getIndex());
		} catch (error) {
			this.error.set(
				error instanceof Error ? error.message : 'Não foi possível carregar o índice de magias.',
			);
		} finally {
			this.loading.set(false);
		}
	}

	private unique(values: string[]) {
		return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
	}

	private toSelectOptions(values: readonly string[]): AppSelectOption[] {
		return values.map((value) => ({ value, label: value }));
	}
}
