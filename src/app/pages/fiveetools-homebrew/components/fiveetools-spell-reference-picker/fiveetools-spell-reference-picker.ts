import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppSelectComponent } from '../../../../components/app-select/app-select';
import { FiveEToolsHomebrewService } from '../../../../services/fiveetools-homebrew-service/fiveetools-homebrew-service';
import {
	FiveEToolsReferenceDataService,
	type FiveEToolsReferenceSpell,
} from '../../../../services/fiveetools-reference-data-service/fiveetools-reference-data-service';

@Component({
	selector: 'app-fiveetools-spell-reference-picker',
	standalone: true,
	imports: [AppSelectComponent, CommonModule, FormsModule],
	templateUrl: './fiveetools-spell-reference-picker.html',
})
export class FiveEToolsSpellReferencePickerComponent {
	private readonly referenceData = inject(FiveEToolsReferenceDataService);
	private readonly fiveEToolsService = inject(FiveEToolsHomebrewService);

	@Input() targetLevelLabel = 'nível atual';

	@Output() readonly close = new EventEmitter<void>();
	@Output() readonly selectSpell = new EventEmitter<FiveEToolsReferenceSpell>();

	readonly loading = signal(true);
	readonly sourceLoading = signal(false);
	readonly error = signal<string | null>(null);
	readonly sources = signal<string[]>([]);
	readonly selectedSource = signal('XPHB');
	readonly search = signal('');
	readonly levelFilter = signal<'all' | string>('all');
	readonly schoolFilter = signal<'all' | string>('all');
	readonly spells = signal<FiveEToolsReferenceSpell[]>([]);
	readonly selectedSpell = signal<FiveEToolsReferenceSpell | null>(null);

	readonly filteredSpells = computed(() => {
		const query = this.normalize(this.search());
		const level = this.levelFilter();
		const school = this.schoolFilter();

		return this.spells().filter((spell) => {
			if (level !== 'all' && String(spell.level) !== level) return false;
			if (school !== 'all' && spell.school !== school) return false;
			if (!query) return true;

			return this.normalize(
				`${spell.name} ${spell.source} ${this.referenceData.schoolLabel(spell.school)}`,
			).includes(query);
		});
	});

	readonly availableSchools = computed(() =>
		Array.from(
			new Set(
				this.spells()
					.map((spell) => spell.school)
					.filter(Boolean),
			),
		).sort((left, right) =>
			this.referenceData.schoolLabel(left).localeCompare(this.referenceData.schoolLabel(right)),
		),
	);

	constructor() {
		void this.loadSources();
	}

	async onChangeSource(source: string) {
		this.selectedSource.set(source);
		await this.loadSpellsForSource(source);
	}

	schoolLabel(code: string): string {
		return this.referenceData.schoolLabel(code);
	}

	spellTag(spell: FiveEToolsReferenceSpell): string {
		return this.referenceData.spellTag(spell);
	}

	levelLabel(level: number): string {
		if (level === 0) return 'Cantrip';
		if (level === 1) return '1º nível';
		return `${level}º nível`;
	}

	renderEntries(entries: FiveEToolsReferenceSpell['entries'] | undefined): string[] {
		return this.fiveEToolsService.renderEntries(entries);
	}

	rangeLabel(spell: FiveEToolsReferenceSpell): string {
		const distance = spell.range?.distance;
		if (!distance?.type) return 'Alcance não informado';
		if (distance.type === 'self') return 'Pessoal';
		if (distance.type === 'touch') return 'Toque';
		if (distance.type === 'sight') return 'À vista';
		if (distance.type === 'unlimited') return 'Ilimitado';
		if (distance.amount != null) return `${distance.amount} ${distance.type}`;
		return distance.type;
	}

	select(spell: FiveEToolsReferenceSpell) {
		this.selectedSpell.set(spell);
	}

	confirmSelection() {
		const spell = this.selectedSpell();
		if (!spell) return;
		this.selectSpell.emit(spell);
	}

	private async loadSources() {
		this.loading.set(true);
		this.error.set(null);
		try {
			const sources = await this.referenceData.listSpellSources();
			this.sources.set(sources);
			const preferred = sources.includes('XPHB') ? 'XPHB' : (sources[0] ?? 'XPHB');
			this.selectedSource.set(preferred);
			await this.loadSpellsForSource(preferred, false);
		} catch (error) {
			this.error.set(
				this.getErrorMessage(error, 'Não foi possível carregar as fontes de magia do 5etools.'),
			);
		} finally {
			this.loading.set(false);
		}
	}

	private async loadSpellsForSource(source: string, toggleLoading = true) {
		if (toggleLoading) this.sourceLoading.set(true);
		this.error.set(null);
		try {
			const spells = await this.referenceData.getSpellsBySource(source);
			this.spells.set(spells);
			this.schoolFilter.set('all');
			this.levelFilter.set('all');
			this.selectedSpell.set(spells[0] ?? null);
		} catch (error) {
			this.spells.set([]);
			this.selectedSpell.set(null);
			this.error.set(
				this.getErrorMessage(error, 'Não foi possível carregar as magias dessa fonte.'),
			);
		} finally {
			if (toggleLoading) this.sourceLoading.set(false);
		}
	}

	private normalize(value: string): string {
		return (value || '')
			.trim()
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '');
	}

	private getErrorMessage(error: unknown, fallback: string): string {
		return error instanceof Error && error.message ? error.message : fallback;
	}
}
