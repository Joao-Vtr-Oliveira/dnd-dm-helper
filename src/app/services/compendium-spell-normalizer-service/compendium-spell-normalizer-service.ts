import { Injectable } from '@angular/core';
import type { RawFiveEToolsEntry } from '../../models/compendium-entry-model';
import type {
	CompendiumSpell,
	CompendiumSpellComponents,
	CompendiumSpellIndex,
	CompendiumSpellIndexEntry,
	CompendiumSpellIndexQuery,
	CompendiumSpellListEntry,
	RawFiveEToolsSpell,
	RawFiveEToolsSpellBundle,
} from '../../models/compendium-spell-model';

@Injectable({ providedIn: 'root' })
export class CompendiumSpellNormalizerService {
	normalizeIndex(raw: unknown): CompendiumSpellIndex {
		const record = this.record(raw);
		const sources = Array.isArray(record?.['sources'])
			? record!['sources'].map((entry) => this.indexEntry(entry)).filter(this.notNull)
			: [];
		const spells = Array.isArray(record?.['spells'])
			? record!['spells'].map((entry) => this.listEntry(entry)).filter(this.notNull)
			: [];
		return {
			sources: sources.sort((left, right) => left.source.localeCompare(right.source)),
			spells: spells.sort(
				(left, right) =>
					left.name.localeCompare(right.name) || left.source.localeCompare(right.source),
			),
		};
	}

	filterIndex(index: CompendiumSpellIndex, query: CompendiumSpellIndexQuery = {}) {
		const search = query.search?.trim().toLocaleLowerCase();
		const sources = this.normalizedSet(query.sources);
		const schools = this.normalizedSet(query.schools);
		const levels = new Set(query.levels ?? []);
		return index.spells.filter((spell) => {
			if (sources.size && !sources.has(spell.source.toLocaleLowerCase())) return false;
			if (schools.size && !schools.has(spell.school.toLocaleLowerCase())) return false;
			if (levels.size && !levels.has(spell.level)) return false;
			if (query.concentration === true && !spell.concentration) return false;
			if (query.ritual === true && !spell.ritual) return false;
			return (
				!search ||
				[spell.name, ...spell.aliases].some((value) => value.toLocaleLowerCase().includes(search))
			);
		});
	}

	normalizeBundle(raw: unknown): CompendiumSpell[] {
		const bundle = this.record(raw) as RawFiveEToolsSpellBundle | null;
		const spells = bundle?.spells ?? bundle?.spell;
		if (!Array.isArray(spells)) return [];
		const classes = this.record(bundle?.classes) ?? {};
		return spells
			.filter(
				(spell): spell is RawFiveEToolsSpell =>
					!!spell && !!this.string(spell.name) && !!this.string(spell.source),
			)
			.map((spell) => this.normalizeSpell(spell, classes));
	}

	normalizeSpell(
		raw: RawFiveEToolsSpell,
		classSources: Record<string, unknown> = {},
	): CompendiumSpell {
		const duration = this.duration(raw.duration);
		return {
			id:
				this.string(raw.id) ?? `${raw.source}:${encodeURIComponent(raw.name.toLocaleLowerCase())}`,
			name: raw.name.trim(),
			source: raw.source.trim(),
			aliases: this.strings(raw.alias),
			page: this.integer(raw.page),
			level: this.integer(raw.level) ?? 0,
			school: this.string(raw.school) ?? '',
			castingTime: this.castingTime(raw.time),
			range: this.range(raw.range),
			components: this.components(raw.components),
			duration: duration.text,
			concentration: duration.concentration,
			ritual: raw.meta?.ritual === true,
			entries: this.entries(raw.entries),
			entriesHigherLevel: this.entries(raw.entriesHigherLevel),
			damageTypes: this.strings(raw.damageInflict),
			savingThrows: this.strings(raw.savingThrow),
			attackTypes: this.strings(raw.spellAttack),
			conditions: this.strings(raw.conditionInflict),
			classes: this.classNames(classSources[raw.name]),
			raw: structuredClone(raw),
		};
	}

	private indexEntry(raw: unknown): CompendiumSpellIndexEntry | null {
		const record = this.record(raw);
		const source = this.string(record?.['source'] ?? record?.['s']);
		const path = this.string(record?.['path'] ?? record?.['f']);
		return source && path
			? {
					source,
					path,
					...(this.integer(record?.['count'] ?? record?.['c']) === undefined
						? {}
						: { count: this.integer(record?.['count'] ?? record?.['c']) }),
				}
			: null;
	}

	private listEntry(raw: unknown): CompendiumSpellListEntry | null {
		const record = this.record(raw);
		const id = this.string(record?.['id'] ?? record?.['i']);
		const name = this.string(record?.['name'] ?? record?.['n']);
		const source = this.string(record?.['source'] ?? record?.['s']);
		const level = this.integer(record?.['level'] ?? record?.['l']);
		const school = this.string(record?.['school'] ?? record?.['h']);
		if (!id || !name || !source || level === undefined || !school) return null;
		return {
			id,
			name,
			source,
			level,
			school,
			page: this.integer(record?.['page'] ?? record?.['p']),
			ritual: record?.['ritual'] === true || record?.['rt'] === true,
			concentration: record?.['concentration'] === true || record?.['ct'] === true,
			castingTime: this.string(record?.['castingTime'] ?? record?.['tm']),
			range: this.string(record?.['range'] ?? record?.['rg']),
			aliases: this.strings(record?.['aliases'] ?? record?.['a']),
			classes: this.strings(record?.['classes'] ?? record?.['cl']),
		};
	}

	private castingTime(value: unknown) {
		const first = Array.isArray(value) ? this.record(value[0]) : null;
		const number = this.integer(first?.['number']);
		const unit = this.string(first?.['unit']);
		if (number === undefined || !unit) return undefined;
		return [`${number} ${number === 1 ? unit : `${unit}s`}`, this.string(first?.['condition'])]
			.filter(Boolean)
			.join(', ');
	}

	private range(value: unknown) {
		const range = this.record(value);
		if (!range) return undefined;
		if (range['type'] === 'special') return 'Special';
		const distance = this.record(range['distance']);
		const type = this.string(distance?.['type']);
		if (!type) return this.string(range['type']);
		if (['self', 'touch', 'sight', 'unlimited'].includes(type))
			return type[0].toUpperCase() + type.slice(1);
		const amount = typeof distance?.['amount'] === 'number' ? `${distance['amount']} ` : '';
		return `${amount}${type === 'feet' ? 'ft.' : type}`.trim();
	}

	private components(value: unknown): CompendiumSpellComponents {
		const components = this.record(value) ?? {};
		const material = components['m'];
		return {
			verbal: components['v'] === true,
			somatic: components['s'] === true,
			material:
				typeof material === 'string' ? material : this.string(this.record(material)?.['text']),
		};
	}

	private duration(value: unknown) {
		const first = Array.isArray(value) ? this.record(value[0]) : null;
		if (!first) return { text: undefined, concentration: false };
		const concentration = first['concentration'] === true;
		if (first['type'] === 'instant') return { text: 'Instantaneous', concentration };
		if (first['type'] === 'special') return { text: 'Special', concentration };
		if (first['type'] === 'permanent') return { text: 'Permanent', concentration };
		const timed = this.record(first['duration']);
		const amount = this.integer(timed?.['amount']);
		const type = this.string(timed?.['type']);
		if (amount === undefined || !type) return { text: undefined, concentration };
		const text = `${amount} ${amount === 1 ? type : `${type}s`}`;
		return { text: first['upTo'] === true ? `Up to ${text}` : text, concentration };
	}

	private classNames(value: unknown) {
		const record = this.record(value);
		const candidates = [
			...(Array.isArray(record?.['class']) ? record!['class'] : []),
			...(Array.isArray(record?.['classVariant']) ? record!['classVariant'] : []),
		];
		return [
			...new Set(
				candidates
					.map((entry) => this.string(this.record(entry)?.['name']))
					.filter((name): name is string => !!name),
			),
		];
	}

	private entries(value: unknown): RawFiveEToolsEntry[] {
		return Array.isArray(value) ? structuredClone(value) : [];
	}
	private record(value: unknown): Record<string, unknown> | null {
		return value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: null;
	}
	private string(value: unknown) {
		return typeof value === 'string' && value.trim() ? value.trim() : undefined;
	}
	private strings(value: unknown) {
		return Array.isArray(value) ? value.flatMap((item) => this.string(item) ?? []) : [];
	}
	private integer(value: unknown) {
		return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
	}
	private normalizedSet(values: readonly string[] | undefined) {
		return new Set((values ?? []).map((value) => value.toLocaleLowerCase()));
	}
	private notNull<T>(value: T | null): value is T {
		return value !== null;
	}
}
