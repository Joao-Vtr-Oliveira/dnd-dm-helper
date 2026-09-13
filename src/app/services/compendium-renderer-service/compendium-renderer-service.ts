import { Injectable } from '@angular/core';
import type { RawFiveEToolsEntry, RawFiveEToolsEntryObject } from '../../models/compendium-entry-model';

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
export class CompendiumRendererService {
	tokenize(text: string): CompendiumTextToken[] {
		const tokens: CompendiumTextToken[] = [];
		let cursor = 0;
		while (cursor < text.length) {
			const tag = this.nextTag(text, cursor);
			if (!tag) {
				if (cursor < text.length) tokens.push({ type: 'text', value: text.slice(cursor) });
				break;
			}
			if (tag.start > cursor) tokens.push({ type: 'text', value: text.slice(cursor, tag.start) });
			tokens.push({ type: this.tokenType(tag.type), value: this.renderTag(tag.type, tag.value) });
			cursor = tag.end;
		}
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

	private nextTag(text: string, cursor: number): { start: number; end: number; type: string; value: string } | null {
		const start = text.indexOf('{@', cursor);
		if (start < 0) return null;
		let depth = 1;
		for (let index = start + 2; index < text.length; index++) {
			if (text.startsWith('{@', index)) {
				depth++;
				index++;
				continue;
			}
			if (text[index] !== '}') continue;
			depth--;
			if (depth) continue;
			const content = text.slice(start + 2, index);
			const separator = content.search(/\s/);
			return {
				start,
				end: index + 1,
				type: (separator < 0 ? content : content.slice(0, separator)).toLowerCase(),
				value: (separator < 0 ? '' : content.slice(separator).trim()),
			};
		}
		return null;
	}

	private renderEntry(entry: RawFiveEToolsEntry): string {
		if (typeof entry === 'string') return this.renderText(entry);
		if (entry.type === 'table') return this.renderTable(entry);
		if (entry.type === 'cell') return this.renderCell(entry);
		if (entry.type === 'list') {
			return (entry.items ?? []).map((item) => this.renderEntry(item)).filter(Boolean).map((item) => `- ${item}`).join('\n');
		}
		const content = this.renderEntries(entry.entries);
		if (entry.type === 'quote') {
			return [content && `"${content}"`, this.renderText(entry.by?.trim() ?? '')].filter(Boolean).join(' - ');
		}
		const title = this.renderText((entry.name ?? entry.caption ?? '').trim());
		return [title, content].filter(Boolean).join(': ') || this.renderUnknownEntry(entry);
	}

	private tokenType(type: string): CompendiumTextToken['type'] {
		if (['damage', 'hit', 'dc', 'condition', 'spell', 'dice', 'd20', 'scaledice', 'scaledamage'].includes(type)) {
			return type === 'd20' || type.startsWith('scale') ? 'dice' : (type as CompendiumTextToken['type']);
		}
		if (type === 'atk') return 'attack';
		if (type === 'actsave') return 'save';
		if (['acttrigger', 'actresponse', 'actsavefail', 'actsavesuccess', 'h', 'recharge', 'chance'].includes(type)) return 'label';
		if (['creature', 'item', 'object', 'action', 'status', 'skill', 'link', 'note'].includes(type)) return 'reference';
		return 'unknown';
	}

	private renderTag(type: string, value: string): string {
		const values = this.tagValues(value);
		const label = this.renderText(values[0]?.trim() ?? '');
		switch (type) {
			case 'hit':
			case 'd20':
				return this.formatModifier(label);
			case 'dc':
				return `DC ${label}`;
			case 'damage':
			case 'dice':
			case 'scaledice':
			case 'scaledamage':
			case 'condition':
				return label;
			case 'spell':
				return this.displayLabel(type, values);
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
				return this.displayLabel(type, values);
		}
	}

	private displayLabel(type: string, values: string[]): string {
		const referenceTypes = new Set([
			'book', 'class', 'condition', 'creature', 'deity', 'disease', 'feat', 'hazard', 'item', 'object',
			'optionalfeature', 'race', 'sense', 'skill', 'spell', 'status', 'subclass', 'table', 'trap',
			'variantrule', 'vehicle', 'quickref',
		]);
		const display = referenceTypes.has(type) && values.length > 2 ? values.at(-1)?.trim() : undefined;
		return this.renderText(display || values[0]?.trim() || values.filter(Boolean).join(' '));
	}

	private tagValues(value: string): string[] {
		const values: string[] = [];
		let start = 0;
		let depth = 0;
		for (let index = 0; index < value.length; index++) {
			if (value.startsWith('{@', index)) {
				depth++;
				index++;
				continue;
			}
			if (value[index] === '}' && depth) {
				depth--;
				continue;
			}
			if (value[index] !== '|' || depth) continue;
			values.push(value.slice(start, index));
			start = index + 1;
		}
		values.push(value.slice(start));
		return values;
	}

	private renderTable(entry: RawFiveEToolsEntryObject): string {
		const lines: string[] = [];
		const caption = entry.caption?.trim() || entry.name?.trim();
		if (caption) lines.push(this.renderText(caption));
		if (entry.colLabels?.length) lines.push(entry.colLabels.map((label) => this.renderText(label)).join(' | '));
		for (const row of entry.rows ?? []) {
			lines.push(row.map((cell) => this.renderCell(cell)).filter(Boolean).join(' | '));
		}
		return lines.filter(Boolean).join('\n');
	}

	private renderCell(value: unknown): string {
		if (typeof value === 'string') return this.renderText(value);
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		if (Array.isArray(value)) return value.map((entry) => this.renderCell(entry)).filter(Boolean).join(' ');
		if (!value || typeof value !== 'object') return '';
		const cell = value as RawFiveEToolsEntryObject;
		const roll = this.renderRoll(cell.roll);
		const content = cell.entry ? this.renderEntry(cell.entry) : this.renderEntries(cell.entries);
		return [roll, content].filter(Boolean).join(' ') || this.renderUnknownEntry(cell);
	}

	private renderRoll(roll: RawFiveEToolsEntryObject['roll']): string {
		if (!roll) return '';
		if (roll.exact !== undefined) return String(roll.exact);
		if (roll.min !== undefined && roll.max !== undefined) return roll.min === roll.max ? String(roll.min) : `${roll.min}-${roll.max}`;
		if (roll.min !== undefined) return `${roll.min}+`;
		return roll.max === undefined ? '' : `<= ${roll.max}`;
	}

	private renderUnknownEntry(entry: RawFiveEToolsEntryObject): string {
		return Object.values(entry)
			.filter((value): value is string => typeof value === 'string' && !!value.trim())
			.map((value) => this.renderText(value))
			.join(' ');
	}

	private formatModifier(value: string): string {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? `${numeric >= 0 ? '+' : ''}${numeric}` : value;
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
