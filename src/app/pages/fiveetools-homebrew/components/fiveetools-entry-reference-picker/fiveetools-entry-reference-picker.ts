import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FiveEToolsHomebrewService } from '../../../../services/fiveetools-homebrew-service/fiveetools-homebrew-service';
import {
	FiveEToolsReferenceDataService,
	type FiveEToolsReferenceAction,
	type FiveEToolsReferenceFeat,
	type FiveEToolsReferenceImportable,
	type FiveEToolsReferenceItem,
	type FiveEToolsReferenceLanguage,
	type FiveEToolsReferenceOptionalFeature,
} from '../../../../services/fiveetools-reference-data-service/fiveetools-reference-data-service';

type ReferenceKind = 'action' | 'optionalfeature' | 'feat' | 'item' | 'condition' | 'status' | 'language';

@Component({
	selector: 'app-fiveetools-entry-reference-picker',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './fiveetools-entry-reference-picker.html',
})
export class FiveEToolsEntryReferencePickerComponent implements OnChanges {
	private readonly referenceData = inject(FiveEToolsReferenceDataService);
	private readonly fiveEToolsService = inject(FiveEToolsHomebrewService);

	@Input({ required: true }) kind!: ReferenceKind;
	@Input() targetSectionLabel = 'bloco atual';

	@Output() readonly close = new EventEmitter<void>();
	@Output() readonly selectReference = new EventEmitter<FiveEToolsReferenceImportable>();

	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly search = signal('');
	readonly sourceFilter = signal('all');
	readonly items = signal<FiveEToolsReferenceImportable[]>([]);
	readonly selectedItem = signal<FiveEToolsReferenceImportable | null>(null);

	readonly availableSources = computed(() =>
		Array.from(new Set(this.items().map((item) => item.source))).sort((left, right) =>
			left.localeCompare(right),
		),
	);

	readonly filteredItems = computed(() => {
		const query = this.normalize(this.search());
		const sourceFilter = this.sourceFilter();

		return this.items().filter((item) => {
			if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
			if (!query) return true;

			const text = [
				item.name,
				item.source,
				...this.metaLabels(item),
				this.renderEntries(item.entries).join(' '),
			].join(' ');

			return this.normalize(text).includes(query);
		});
	});

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['kind']) void this.load();
	}

	kindTitle(): string {
		if (this.kind === 'action') return 'Importar action';
		if (this.kind === 'optionalfeature') return 'Importar optional feature';
		if (this.kind === 'item') return 'Importar item';
		if (this.kind === 'condition') return 'Importar condição';
		if (this.kind === 'status') return 'Importar status';
		if (this.kind === 'language') return 'Importar idioma';
		return 'Importar feat';
	}

	kindDescription(): string {
		if (this.kind === 'action') return `Selecione uma action oficial para inserir em ${this.targetSectionLabel}.`;
		if (this.kind === 'optionalfeature') {
			return `Selecione uma optional feature oficial para reaproveitar em ${this.targetSectionLabel}.`;
		}
		if (this.kind === 'item') return `Selecione um item oficial para reaproveitar em ${this.targetSectionLabel}.`;
		if (this.kind === 'condition') return `Selecione uma condição oficial para usar em ${this.targetSectionLabel}.`;
		if (this.kind === 'status') return `Selecione um status oficial para usar em ${this.targetSectionLabel}.`;
		if (this.kind === 'language') return `Selecione um idioma oficial para adicionar a ${this.targetSectionLabel}.`;
		return `Selecione um feat oficial para transformar em bloco reutilizável em ${this.targetSectionLabel}.`;
	}

	renderEntries(entries: FiveEToolsReferenceImportable['entries']): string[] {
		return this.fiveEToolsService.renderEntries(entries);
	}

	select(item: FiveEToolsReferenceImportable) {
		this.selectedItem.set(item);
	}

	confirmSelection() {
		const item = this.selectedItem();
		if (!item) return;
		this.selectReference.emit(item);
	}

	metaLabels(item: FiveEToolsReferenceImportable): string[] {
		if (item.kind === 'action') {
			const action = item as FiveEToolsReferenceAction;
			return [action.fromVariant || '', this.actionTimeLabel(action)].filter(Boolean);
		}

		if (item.kind === 'optionalfeature') {
			const feature = item as FiveEToolsReferenceOptionalFeature;
			return [
				...(feature.featureType ?? []),
				feature.hasAdditionalSpells ? 'Spells associadas' : '',
			].filter(Boolean);
		}

		if (item.kind === 'item') {
			const refItem = item as FiveEToolsReferenceItem;
			return [
				refItem.type || '',
				refItem.rarity || '',
				refItem.hasAttachedSpells ? 'Spells anexadas' : '',
			].filter(Boolean);
		}

		if (item.kind === 'language') {
			const language = item as FiveEToolsReferenceLanguage;
			return [language.type || '', language.script || '', language.origin || ''].filter(Boolean);
		}

		const feat = item as FiveEToolsReferenceFeat;
		return [feat.category || '', feat.hasAdditionalSpells ? 'Spells associadas' : ''].filter(Boolean);
	}

	private async load() {
		if (!this.kind) return;
		this.loading.set(true);
		this.error.set(null);
		this.search.set('');
		this.sourceFilter.set('all');
		this.selectedItem.set(null);

		try {
			const items =
				this.kind === 'action'
					? await this.referenceData.getActions()
					: this.kind === 'item'
						? await this.referenceData.getItems()
						: this.kind === 'language'
							? await this.referenceData.getLanguages()
							: this.kind === 'condition' || this.kind === 'status'
								? (await this.referenceData.getConditionStatusReferences()).filter(
										(item) => item.kind === this.kind,
								  )
					: this.kind === 'optionalfeature'
						? await this.referenceData.getOptionalFeatures()
						: await this.referenceData.getFeats();
			this.items.set(items);
			this.selectedItem.set(items[0] ?? null);
		} catch (error) {
			this.items.set([]);
			this.error.set(this.getErrorMessage(error, 'Não foi possível carregar os dados de referência.'));
		} finally {
			this.loading.set(false);
		}
	}

	private actionTimeLabel(action: FiveEToolsReferenceAction): string {
		if (!action.time?.length) return '';
		return action.time
			.map((entry) => {
				if (typeof entry === 'string') return entry;
				if (entry.number && entry.unit) return `${entry.number} ${entry.unit}`;
				return entry.unit || '';
			})
			.filter(Boolean)
			.join(', ');
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
