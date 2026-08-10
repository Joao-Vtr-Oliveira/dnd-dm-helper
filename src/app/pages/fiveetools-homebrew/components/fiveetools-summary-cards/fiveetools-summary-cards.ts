import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { FiveEToolsHomebrewSummary } from '../../../../models/fiveetools-homebrew-model';

@Component({
	selector: 'app-fiveetools-summary-cards',
	standalone: true,
	imports: [CommonModule],
	host: {
		class: 'block',
	},
	templateUrl: './fiveetools-summary-cards.html',
})
export class FiveEToolsSummaryCardsComponent {
	@Input({ required: true }) summary!: FiveEToolsHomebrewSummary;

	formatDate(value: number | null | undefined): string {
		if (typeof value !== 'number') return 'Nao informado';
		return new Intl.DateTimeFormat('pt-BR', {
			dateStyle: 'short',
			timeStyle: 'short',
		}).format(new Date(value * 1000));
	}
}
