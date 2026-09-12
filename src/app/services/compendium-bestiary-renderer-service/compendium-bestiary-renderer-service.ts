import { Injectable } from '@angular/core';
import type { RawFiveEToolsEntry } from '../../models/compendium-bestiary-model';

export interface CompendiumTextToken {
	type:
		| 'text'
		| 'damage'
		| 'hit'
		| 'dc'
		| 'condition'
		| 'spell'
		| 'dice'
		| 'attack'
		| 'save'
		| 'label'
		| 'reference'
		| 'unknown';
	value: string;
}

@Injectable({ providedIn: 'root' })
export class CompendiumBestiaryRendererService {
	tokenize(text: string): CompendiumTextToken[] {
		const tokens: CompendiumTextToken[] = [];
		const pattern = /\{@([\w]+)(?:\s+([^}]*))?\}/gi;
		let cursor = 0;
		for (const match of text.matchAll(pattern)) {
			const index = match.index ?? 0;
			if (index > cursor) tokens.push({ type: 'text', value: text.slice(cursor, index) });
			const type = match[1].toLowerCase();
			const value = (match[2] ?? '').trim();
			tokens.push({
				type: this.tokenType(type),
				value: this.renderTag(type, value),
			});
			cursor = index + match[0].length;
		}
		if (cursor < text.length) tokens.push({ type: 'text', value: text.slice(cursor) });
		return tokens;
	}

	renderText(text: string): string {
		return this.tokenize(text)
			.map((token) => token.value)
			.join('')
			.replace(/[ \t]{2,}/g, ' ');
	}

	renderEntries(entries: RawFiveEToolsEntry[] | undefined): string {
		return (entries ?? []).map((entry) => this.renderEntry(entry)).filter(Boolean).join('\n');
	}

	spellReference(value: string): { name: string; source?: string } | null {
		const tag = value.match(/^\{@spell\s+([^|}]+)(?:\|([^|}]+))?(?:\|[^}]*)?\}$/i);
		if (!tag) return null;
		const name = tag[1].trim();
		return name ? { name, ...(tag[2]?.trim() ? { source: tag[2].trim() } : {}) } : null;
	}

	private renderEntry(entry: RawFiveEToolsEntry): string {
		if (typeof entry === 'string') return this.renderText(entry);
		if (entry.type === 'table') return this.renderTable(entry);
		const children = entry.type === 'list' ? entry.items : entry.entries;
		const content = this.renderEntries(children);
		const formattedContent = entry.type === 'list' && content ? content.split('\n').map((line) => `- ${line}`).join('\n') : content;
		return [entry.name?.trim(), formattedContent].filter(Boolean).join(': ');
	}

	private tokenType(type: string): CompendiumTextToken['type'] {
		if (['damage', 'hit', 'dc', 'condition', 'spell', 'dice'].includes(type)) return type as CompendiumTextToken['type'];
		if (type === 'atk') return 'attack';
		if (type === 'actsave') return 'save';
		if (['acttrigger', 'actresponse', 'actsavefail', 'actsavesuccess', 'h', 'recharge', 'chance'].includes(type)) return 'label';
		if (['creature', 'item', 'object', 'action', 'status', 'skill', 'link', 'note'].includes(type)) return 'reference';
		return 'unknown';
	}

	private renderTag(type: string, value: string): string {
		const [label] = value.split('|');
		switch (type) {
			case 'hit': {
				const numeric = Number(label);
				return Number.isFinite(numeric) && numeric >= 0 ? `+${numeric}` : label;
			}
			case 'dc':
				return `DC ${label}`;
			case 'damage':
			case 'dice':
			case 'condition':
			case 'spell':
				return label;
			case 'h':
				return 'Hit: ';
			case 'atk':
				return this.attackLabel(label);
			case 'actsave':
				return `${label.toUpperCase()} Save`;
			case 'acttrigger':
				return 'Trigger: ';
			case 'actresponse':
				return 'Response: ';
			case 'actsavefail':
				return 'Failure: ';
			case 'actsavesuccess':
				return 'Success: ';
			case 'recharge': {
				const numeric = Number(label);
				return Number.isInteger(numeric) && numeric >= 1 && numeric <= 6
					? `Recharge ${numeric}${numeric < 6 ? '-6' : ''}`
					: `Recharge ${label}`;
			}
			case 'chance':
				return `${label}% chance`;
			default:
				return label || value.replace(/\|/g, ' ');
		}
	}

	private renderTable(entry: Exclude<RawFiveEToolsEntry, string>): string {
		const lines: string[] = [];
		if (entry.name?.trim()) lines.push(entry.name.trim());
		if (entry.colLabels?.length) lines.push(entry.colLabels.map((label) => this.renderText(label)).join(' | '));
		for (const row of entry.rows ?? []) {
			lines.push(row.map((cell) => this.renderCell(cell)).filter(Boolean).join(' | '));
		}
		return lines.filter(Boolean).join('\n');
	}

	private renderCell(value: unknown): string {
		if (typeof value === 'string') return this.renderText(value);
		if (value && typeof value === 'object' && !Array.isArray(value)) return this.renderEntry(value as RawFiveEToolsEntry);
		return String(value ?? '');
	}

	private attackLabel(value: string): string {
		const labels: Record<string, string> = {
			mw: 'Melee Weapon Attack: ',
			rw: 'Ranged Weapon Attack: ',
			'mw,rw': 'Melee or Ranged Weapon Attack: ',
			ms: 'Melee Spell Attack: ',
			rs: 'Ranged Spell Attack: ',
			'ms,rs': 'Melee or Ranged Spell Attack: ',
		};
		return labels[value.toLowerCase()] ?? (value ? `Attack (${value}): ` : 'Attack: ');
	}
}
