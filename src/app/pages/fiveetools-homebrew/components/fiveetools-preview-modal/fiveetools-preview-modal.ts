import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';
import { LucideX } from '@lucide/angular';
import type {
	FiveEToolsEntitySummary,
	FiveEToolsMonster,
	FiveEToolsTrap,
	FiveEToolsValidationIssue,
} from '../../../../models/fiveetools-homebrew-model';
import { FiveEToolsHomebrewService } from '../../../../services/fiveetools-homebrew-service/fiveetools-homebrew-service';

type MonsterSectionKey = 'trait' | 'action' | 'bonus' | 'reaction' | 'legendary';

@Component({
	selector: 'app-fiveetools-preview-modal',
	standalone: true,
	imports: [CommonModule, LucideX],
	templateUrl: './fiveetools-preview-modal.html',
})
export class FiveEToolsPreviewModalComponent {
	private readonly fiveEToolsService = inject(FiveEToolsHomebrewService);

	@Input({ required: true }) previewType!: 'monster' | 'trap';
	@Input({ required: true }) summary!: FiveEToolsEntitySummary;
	@Input() monster: FiveEToolsMonster | null = null;
	@Input() trap: FiveEToolsTrap | null = null;
	@Input() warnings: FiveEToolsValidationIssue[] = [];

	@Output() readonly close = new EventEmitter<void>();
	@Output() readonly edit = new EventEmitter<void>();

	@HostListener('window:keydown.escape')
	onEscape() {
		this.close.emit();
	}

	readonly monsterSections: Array<{ key: MonsterSectionKey; label: string }> = [
		{ key: 'trait', label: 'Traits' },
		{ key: 'action', label: 'Actions' },
		{ key: 'bonus', label: 'Bonus Actions' },
		{ key: 'reaction', label: 'Reactions' },
		{ key: 'legendary', label: 'Legendary Actions' },
	];

	renderText(value: string): string {
		return this.fiveEToolsService.renderText(value);
	}

	monsterSectionPreview(section: MonsterSectionKey): Array<{ title: string; lines: string[] }> {
		const blocks = (this.monster?.[section] as Array<{ name?: string; entries?: unknown[] }> | undefined) ?? [];
		return blocks.map((block) => ({
			title: block.name?.trim() || 'Bloco sem nome',
			lines: this.fiveEToolsService.renderEntries(block.entries as any),
		}));
	}

	monsterSpellPreview(): Array<{ title: string; lines: string[] }> {
		return (this.monster?.spellcasting ?? []).map((block) => ({
			title: block.name?.trim() || 'Spellcasting',
			lines: [
				...this.fiveEToolsService.renderEntries(block.headerEntries),
				...this.renderSpellLevelLines(block.spells ?? {}),
				...this.fiveEToolsService.renderEntries(block.footerEntries),
			],
		}));
	}

	trapPreviewLines(): Array<{ title?: string; lines: string[] }> {
		return (this.trap?.entries ?? []).map((entry) => {
			if (typeof entry === 'string') return { lines: [this.fiveEToolsService.renderText(entry)] };
			return {
				title: entry.name?.trim() || undefined,
				lines: this.fiveEToolsService.renderEntries(entry.entries),
			};
		});
	}

	abilityValue(ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'): string {
		const value = this.monster?.[ability];
		return typeof value === 'number' ? String(value) : '-';
	}

	jsonPreview(value: unknown): string {
		if (value == null) return '-';
		if (typeof value === 'string') return value;
		return JSON.stringify(value);
	}

	private renderSpellLevelLines(spells: Record<string, { spells?: string[]; slots?: number }>): string[] {
		return Object.entries(spells)
			.sort((left, right) => Number(left[0]) - Number(right[0]))
			.flatMap(([level, data]) => {
				const label = level === '0' ? 'Cantrips' : `${level}o nivel${data.slots != null ? ` (${data.slots} slots)` : ''}`;
				return [label, ...(data.spells ?? []).map((spell) => this.fiveEToolsService.renderText(spell))];
			});
	}
}
