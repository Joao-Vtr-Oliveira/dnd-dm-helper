import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppSelectComponent } from '../../../../components/app-select/app-select';
import type { FiveEToolsHomebrewSummary } from '../../../../models/fiveetools-homebrew-model';

type CollectionTab = 'all' | 'monster' | 'trap' | 'extras';

@Component({
	selector: 'app-fiveetools-filters',
	standalone: true,
	imports: [AppSelectComponent, CommonModule, FormsModule],
	host: {
		class: 'block',
	},
	templateUrl: './fiveetools-filters.html',
})
export class FiveEToolsFiltersComponent {
	@Input({ required: true }) summary!: FiveEToolsHomebrewSummary;
	@Input({ required: true }) search = '';
	@Input({ required: true }) collectionTab: CollectionTab = 'all';
	@Input({ required: true }) sourceFilter = 'all';
	@Input({ required: true }) groupFilter = 'all';
	@Input({ required: true }) creatureTypeFilter = 'all';
	@Input({ required: true }) crFilter: 'all' | '0-1' | '2-4' | '5-10' | '11+' = 'all';
	@Input({ required: true }) advancedOpen = false;
	@Input({ required: true }) monsterCount = 0;
	@Input({ required: true }) trapCount = 0;
	@Input({ required: true }) extraCount = 0;
	@Input({ required: true }) resultCount = 0;

	@Output() readonly searchChange = new EventEmitter<string>();
	@Output() readonly collectionTabChange = new EventEmitter<CollectionTab>();
	@Output() readonly sourceFilterChange = new EventEmitter<string>();
	@Output() readonly groupFilterChange = new EventEmitter<string>();
	@Output() readonly creatureTypeFilterChange = new EventEmitter<string>();
	@Output() readonly crFilterChange = new EventEmitter<'all' | '0-1' | '2-4' | '5-10' | '11+'>();
	@Output() readonly advancedToggle = new EventEmitter<void>();
	@Output() readonly clearFilters = new EventEmitter<void>();

	readonly tabs: Array<{ key: CollectionTab; label: string }> = [
		{ key: 'all', label: 'Todos' },
		{ key: 'monster', label: 'Monstros' },
		{ key: 'trap', label: 'Traps/Hazards' },
		{ key: 'extras', label: 'Outros' },
	];

	countForTab(tab: CollectionTab): number {
		if (tab === 'monster') return this.monsterCount;
		if (tab === 'trap') return this.trapCount;
		if (tab === 'extras') return this.extraCount;
		return this.resultCount;
	}
}
