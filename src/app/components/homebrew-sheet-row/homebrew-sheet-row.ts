import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { HomebrewSheetPresentation } from '../../models/homebrew-sheet-presentation-model';
import type { SavedSheetInterface } from '../../services/local-storage-service/local-storage-service';

@Component({
	selector: 'app-homebrew-sheet-row',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './homebrew-sheet-row.html',
})
export class HomebrewSheetRowComponent {
	@Input({ required: true }) sheet!: SavedSheetInterface;
	@Input({ required: true }) presentation!: HomebrewSheetPresentation;
	@Input() contextLabel = '';
	@Input() contextDetail = '';
	@Input() showUse = true;
	@Input() showAdd = true;

	@Output() readonly viewed = new EventEmitter<string>();
	@Output() readonly used = new EventEmitter<string>();
	@Output() readonly added = new EventEmitter<string>();

	categoryClass(): string {
		return {
			npc: 'border-sky-300/25 bg-sky-500/10 text-sky-100',
			monster: 'border-rose-300/25 bg-rose-500/10 text-rose-100',
			pc: 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100',
			other: 'border-slate-300/25 bg-slate-500/10 text-slate-100',
		}[this.presentation.categoryTone];
	}
}
