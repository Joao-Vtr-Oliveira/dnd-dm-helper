import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import type { FiveEToolsEntitySummary } from '../../../../models/fiveetools-homebrew-model';

@Component({
	selector: 'app-fiveetools-entity-card',
	standalone: true,
	imports: [CommonModule],
	host: {
		class: 'block',
	},
	templateUrl: './fiveetools-entity-card.html',
})
export class FiveEToolsEntityCardComponent {
	@Input({ required: true }) entity!: FiveEToolsEntitySummary;

	@Output() readonly preview = new EventEmitter<void>();
	@Output() readonly edit = new EventEmitter<void>();
	@Output() readonly addToEncounter = new EventEmitter<void>();
	@Output() readonly createInternalSheet = new EventEmitter<void>();
	@Output() readonly exportItem = new EventEmitter<void>();
	@Output() readonly duplicate = new EventEmitter<void>();
	@Output() readonly remove = new EventEmitter<void>();

	readonly menuOpen = signal(false);

	badgeLabel(): string {
		if (this.entity.type === 'monster') return 'Monster';
		const trapType = (this.entity.trapHazType || '').trim().toLowerCase();
		return trapType.includes('haz') || trapType.includes('hazard') ? 'Hazard' : 'Trap';
	}

	metaChips(): string[] {
		if (this.entity.type === 'monster') {
			return [
				this.entity.source,
				this.entity.creatureType || '',
				this.entity.cr ? `CR ${this.entity.cr}` : '',
				this.entity.acLabel ? `CA ${this.entity.acLabel}` : '',
				this.entity.hpAverage != null ? `HP ${this.entity.hpAverage}` : '',
			].filter(Boolean);
		}

		return [
			this.entity.source,
			this.entity.trapHazType || '',
			this.entity.initiativeHint || '',
		].filter(Boolean);
	}

	excerpt(text: string | undefined, max = 180): string {
		const clean = (text || '').trim().replace(/\s+/g, ' ');
		if (!clean) return '';
		if (clean.length <= max) return clean;
		return `${clean.slice(0, max).trimEnd()}...`;
	}

	toggleMenu() {
		this.menuOpen.update((open) => !open);
	}

	closeMenu() {
		this.menuOpen.set(false);
	}

	onMenuAction(action: EventEmitter<void>) {
		action.emit();
		this.closeMenu();
	}
}
