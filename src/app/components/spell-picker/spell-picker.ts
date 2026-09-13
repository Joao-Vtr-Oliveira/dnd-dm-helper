import { CommonModule } from '@angular/common';
import {
	Component,
	EventEmitter,
	Input,
	OnChanges,
	Output,
	SimpleChanges,
	computed,
	inject,
	signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideSearch, LucideX } from '@lucide/angular';
import { AppSelectComponent, type AppSelectOption } from '../app-select/app-select';
import { DialogFocusDirective } from '../../directives/dialog-focus';
import type {
	CompendiumSpellIndex,
	CompendiumSpellListEntry,
} from '../../models/compendium-spell-model';
import { CompendiumSpellNormalizerService } from '../../services/compendium-spell-normalizer-service/compendium-spell-normalizer-service';
import { CompendiumSpellRepositoryService } from '../../services/compendium-spell-repository-service/compendium-spell-repository-service';

@Component({
	selector: 'app-spell-picker',
	standalone: true,
	imports: [
		AppSelectComponent,
		CommonModule,
		DialogFocusDirective,
		FormsModule,
		LucideSearch,
		LucideX,
	],
	templateUrl: './spell-picker.html',
})
export class SpellPickerComponent implements OnChanges {
	private readonly repository = inject(CompendiumSpellRepositoryService);
	private readonly normalizer = inject(CompendiumSpellNormalizerService);

	@Input() open = false;
	@Output() closed = new EventEmitter<void>();
	@Output() selected = new EventEmitter<CompendiumSpellListEntry>();

	readonly index = signal<CompendiumSpellIndex | null>(null);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly query = signal('');
	readonly source = signal('');
	readonly level = signal('');
	readonly school = signal('');
	readonly spellClass = signal('');

	readonly sources = computed(() => this.unique(this.index()?.spells.map((spell) => spell.source) ?? []));
	readonly levels = computed(() =>
		[...new Set(this.index()?.spells.map((spell) => spell.level) ?? [])].sort(
			(left, right) => left - right,
		),
	);
	readonly schools = computed(() => this.unique(this.index()?.spells.map((spell) => spell.school) ?? []));
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
		const index = this.index();
		if (!index) return [];
		const spells = this.normalizer.filterIndex(index, {
			search: this.query(),
			sources: this.source() ? [this.source()] : undefined,
			levels: this.level() ? [Number(this.level())] : undefined,
			schools: this.school() ? [this.school()] : undefined,
		});
		return this.spellClass()
			? spells.filter((spell) => spell.classes.includes(this.spellClass()))
			: spells;
	});

	ngOnChanges(changes: SimpleChanges) {
		if (changes['open'] && this.open && !this.index() && !this.loading()) void this.loadIndex();
	}

	close() {
		this.closed.emit();
	}

	select(spell: CompendiumSpellListEntry) {
		this.selected.emit(spell);
		this.close();
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

	private async loadIndex() {
		this.loading.set(true);
		this.error.set(null);
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
