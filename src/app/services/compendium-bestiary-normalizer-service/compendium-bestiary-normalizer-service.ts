import { Injectable } from '@angular/core';
import type {
	CompendiumBestiaryIndex,
	CompendiumBestiaryIndexEntry,
	CompendiumBestiaryIndexQuery,
	CompendiumBestiaryMonsterIndexEntry,
	CompendiumFeature,
	CompendiumLegendaryGroupSnapshot,
	CompendiumMonster,
	CompendiumSpellcasting,
	RawFiveEToolsBestiaryBundle,
	RawFiveEToolsEntry,
	RawFiveEToolsFeature,
	RawFiveEToolsLegendaryGroup,
	RawFiveEToolsMonster,
	RawFiveEToolsSpellcasting,
} from '../../models/compendium-bestiary-model';

@Injectable({ providedIn: 'root' })
export class CompendiumBestiaryNormalizerService {
	normalizeIndex(raw: unknown): CompendiumBestiaryIndex {
		const record = this.asRecord(raw);
		const candidates = record?.['sources'] ?? record?.['source'] ?? record;
		const sources = Array.isArray(candidates)
			? candidates.map((entry) => this.normalizeIndexEntry(entry)).filter(this.isIndexEntry)
			: Object.entries(candidates ?? {})
					.map(([source, path]) => this.normalizeIndexEntry({ source, path }))
					.filter(this.isIndexEntry);
		const monsters = Array.isArray(record?.['monsters'])
			? record['monsters']
					.map((entry) => this.normalizeMonsterIndexEntry(entry))
					.filter(this.isMonsterIndexEntry)
			: [];
		return {
			sources: sources.sort((left, right) => left.source.localeCompare(right.source)),
			monsters: monsters.sort(
				(left, right) => left.name.localeCompare(right.name) || left.source.localeCompare(right.source),
			),
		};
	}

	filterIndex(
		index: CompendiumBestiaryIndex,
		query: CompendiumBestiaryIndexQuery = {},
	): CompendiumBestiaryMonsterIndexEntry[] {
		const search = query.search?.trim().toLocaleLowerCase();
		const sources = this.normalizedSet(query.sources);
		const types = this.normalizedSet(query.types);
		const sizes = this.normalizedSet(query.sizes);
		const challengeRatings = this.normalizedSet(query.challengeRatings);
		return index.monsters.filter((monster) => {
			if (sources.size && !sources.has(monster.source.toLocaleLowerCase())) return false;
			if (types.size && !types.has(monster.type?.toLocaleLowerCase() ?? '')) return false;
			if (sizes.size && !sizes.has(monster.size?.toLocaleLowerCase() ?? '')) return false;
			if (
				challengeRatings.size &&
				!challengeRatings.has(monster.challengeRating?.toLocaleLowerCase() ?? '')
			)
				return false;
			if (!search) return true;
			return [monster.name, monster.source, monster.type, ...monster.aliases]
				.filter((value): value is string => !!value)
				.some((value) => value.toLocaleLowerCase().includes(search));
		});
	}

	normalizeBundle(raw: unknown): CompendiumMonster[] {
		const bundle = this.asRecord(raw) as RawFiveEToolsBestiaryBundle | null;
		const monsters = bundle?.monster ?? bundle?.monsters;
		if (!bundle || !Array.isArray(monsters)) return [];
		const groups = new Map(
			(Array.isArray(bundle.legendaryGroup) ? bundle.legendaryGroup : [])
				.filter((group) => !!group?.name && !!group?.source)
				.map((group) => [`${group.source}::${group.name}`, this.normalizeLegendaryGroup(group)]),
		);
		const images = new Map(
			(Array.isArray(bundle.images) ? bundle.images : [])
				.filter((image) => !!image?.name && !!image?.source && !!image?.url)
				.map((image) => [`${image.source}::${image.name}`, image.url as string]),
		);
		return monsters
			.filter((monster) => !!monster?.name && !!monster?.source)
			.map((monster) => this.normalizeMonsterWithGroups(monster, groups, images));
	}

	normalizeMonster(raw: RawFiveEToolsMonster): CompendiumMonster {
		return this.normalizeMonsterWithGroups(raw, new Map(), new Map());
	}

	private normalizeIndexEntry(raw: unknown): CompendiumBestiaryIndexEntry | null {
		if (typeof raw === 'string') return null;
		const entry = this.asRecord(raw);
		const source = this.string(entry?.['source'] ?? entry?.['s'] ?? entry?.['id'] ?? entry?.['json']);
		const path = this.string(entry?.['path'] ?? entry?.['f'] ?? entry?.['file'] ?? entry?.['url']);
		const count = this.optionalInteger(entry?.['count'] ?? entry?.['c']);
		return source && path ? { source, path, ...(count === undefined ? {} : { count }) } : null;
	}

	private isIndexEntry(entry: CompendiumBestiaryIndexEntry | null): entry is CompendiumBestiaryIndexEntry {
		return entry !== null;
	}

	private normalizeMonsterIndexEntry(raw: unknown): CompendiumBestiaryMonsterIndexEntry | null {
		const entry = this.asRecord(raw);
		const id = this.string(entry?.['id'] ?? entry?.['i']);
		const name = this.string(entry?.['name'] ?? entry?.['n']);
		const source = this.string(entry?.['source'] ?? entry?.['s']);
		if (!id || !name || !source) return null;
		return {
			id,
			name,
			source,
			type: this.string(entry?.['type'] ?? entry?.['t']),
			size: this.string(entry?.['size'] ?? entry?.['z']),
			challengeRating: this.string(entry?.['challengeRating'] ?? entry?.['cr']),
			page: this.optionalInteger(entry?.['page'] ?? entry?.['p']),
			aliases: this.stringValues(entry?.['aliases'] ?? entry?.['alias'] ?? entry?.['a']),
			armorClass: this.optionalInteger(entry?.['armorClass'] ?? entry?.['ac']) ?? null,
			averageHp: this.optionalInteger(entry?.['averageHp'] ?? entry?.['hp']) ?? null,
			hasSpellcasting: entry?.['hasSpellcasting'] === true || entry?.['sc'] === true,
			hasLegendaryActions: entry?.['hasLegendaryActions'] === true || entry?.['lg'] === true,
			hasLairActions: entry?.['hasLairActions'] === true || entry?.['la'] === true,
		};
	}

	private isMonsterIndexEntry(
		entry: CompendiumBestiaryMonsterIndexEntry | null,
	): entry is CompendiumBestiaryMonsterIndexEntry {
		return entry !== null;
	}

	private normalizeMonsterWithGroups(
		raw: RawFiveEToolsMonster,
		groups: Map<string, CompendiumLegendaryGroupSnapshot>,
		images: Map<string, string>,
	): CompendiumMonster {
		const armorClass = this.armorClass(raw.ac);
		const groupReference =
			typeof raw.legendaryGroup === 'string'
				? { name: raw.legendaryGroup, source: raw.source }
				: raw.legendaryGroup;
		const group = groupReference?.name
			? groups.get(`${groupReference.source ?? raw.source}::${groupReference.name}`)
			: undefined;
		return {
			id: this.string(raw.id) ?? `${raw.source}::${raw.name}`,
			name: raw.name.trim(),
			source: raw.source.trim(),
			aliases: this.stringValues(raw.alias),
			page: this.optionalInteger(raw.page),
			sizes: this.stringValues(raw.size),
			type: this.monsterType(raw.type),
			subtypes: this.subtypes(raw.type),
			alignment: this.unknownValues(raw.alignment),
			speed: structuredClone(raw.speed ?? {}),
			abilities: this.abilities(raw),
			saves: structuredClone(raw.save ?? {}),
			skills: structuredClone(raw.skill ?? {}),
			vulnerable: this.unknownValues(raw.vulnerable),
			resist: this.unknownValues(raw.resist),
			immune: this.unknownValues(raw.immune),
			conditionImmune: this.unknownValues(raw.conditionImmune),
			senses: this.stringValues(raw.senses),
			passive: this.optionalInteger(raw.passive),
			languages: this.stringValues(raw.languages),
			proficiency: this.proficiency(raw),
			challengeRating: this.challengeRating(raw.cr),
			armorClass,
			hitPoints: this.integer(raw.hp?.average),
			hitPointFormula: this.string(raw.hp?.formula),
			traits: this.features(raw.trait),
			actions: this.features(raw.action),
			bonusActions: this.features(raw.bonus),
			reactions: this.features(raw.reaction),
			legendaryActions: this.features(raw.legendary),
			mythicActions: this.features(raw.mythic),
			spellcasting: (raw.spellcasting ?? []).map((block) => this.spellcasting(block)),
			legendaryGroup: group
				? structuredClone(group)
				: groupReference?.name
					? {
							name: groupReference.name,
							source: groupReference.source ?? raw.source,
							lairActions: [],
							regionalEffects: [],
							mythicEncounter: [],
						}
					: undefined,
			tags: this.tags(raw),
			imageUrl: images.get(`${raw.source}::${raw.name}`),
			raw: structuredClone(raw),
		};
	}

	private features(raw: RawFiveEToolsFeature[] | undefined): CompendiumFeature[] {
		return (raw ?? []).flatMap((feature) => {
			const name = this.string(feature.name);
			return name ? [{ name, entries: this.entries(feature.entries) }] : [];
		});
	}

	private spellcasting(raw: RawFiveEToolsSpellcasting): CompendiumSpellcasting {
		return {
			name: this.string(raw.name) ?? 'Spellcasting',
			type: this.string(raw.type),
			headerEntries: this.entries(raw.headerEntries),
			footerEntries: this.entries(raw.footerEntries),
			spells: structuredClone(raw.spells ?? {}),
			spellLists: this.spellLists(raw),
		};
	}

	private normalizeLegendaryGroup(raw: RawFiveEToolsLegendaryGroup): CompendiumLegendaryGroupSnapshot {
		return {
			name: raw.name.trim(),
			source: raw.source.trim(),
			lairActions: this.entries(raw.lairActions),
			regionalEffects: this.entries(raw.regionalEffects),
			mythicEncounter: this.entries(raw.mythicEncounter),
		};
	}

	private armorClass(values: unknown[] | undefined): number | null {
		const first = values?.[0];
		if (typeof first === 'number' && Number.isFinite(first)) return Math.floor(first);
		const record = this.asRecord(first);
		const armorClass = record?.['ac'];
		return typeof armorClass === 'number' && Number.isFinite(armorClass)
			? Math.floor(armorClass)
			: null;
	}

	private monsterType(value: RawFiveEToolsMonster['type']): string | undefined {
		return typeof value === 'string' ? this.string(value) : this.string(value?.type);
	}

	private subtypes(value: RawFiveEToolsMonster['type']): string[] {
		return typeof value === 'object' && value !== null ? this.stringValues(value.tags) : [];
	}

	private challengeRating(value: RawFiveEToolsMonster['cr']): string | undefined {
		if (typeof value === 'string' || typeof value === 'number') return String(value);
		return value?.cr == null ? undefined : String(value.cr);
	}

	private entries(value: RawFiveEToolsEntry[] | undefined): RawFiveEToolsEntry[] {
		return Array.isArray(value) ? structuredClone(value) : [];
	}

	private abilities(raw: RawFiveEToolsMonster): CompendiumMonster['abilities'] {
		return {
			str: this.optionalInteger(raw.str),
			dex: this.optionalInteger(raw.dex),
			con: this.optionalInteger(raw.con),
			int: this.optionalInteger(raw.int),
			wis: this.optionalInteger(raw.wis),
			cha: this.optionalInteger(raw.cha),
		};
	}

	private proficiency(raw: RawFiveEToolsMonster): string | number | undefined {
		if (typeof raw.pbNote === 'string' && raw.pbNote.trim()) return raw.pbNote.trim();
		return this.optionalInteger(raw.pb);
	}

	private tags(raw: RawFiveEToolsMonster): Record<string, string[]> {
		const keys = [
			'damageTags',
			'damageTagsLegendary',
			'damageTagsSpell',
			'conditionInflict',
			'conditionInflictLegendary',
			'conditionInflictSpell',
			'traitTags',
			'actionTags',
			'languageTags',
			'senseTags',
			'spellcastingTags',
			'miscTags',
		];
		return Object.fromEntries(
			keys.flatMap((key) => {
				const values = this.stringValues(raw[key]);
				return values.length ? [[key, values]] : [];
			}),
		);
	}

	private spellLists(raw: RawFiveEToolsSpellcasting): Record<string, string[]> {
		const lists: Record<string, string[]> = {};
		for (const key of ['will', 'constant'] as const) {
			const spells = this.stringValues(raw[key]);
			if (spells.length) lists[key] = spells;
		}
		for (const category of ['daily', 'rest', 'weekly'] as const) {
			for (const [uses, spells] of Object.entries(raw[category] ?? {})) {
				const normalized = this.stringValues(spells);
				if (normalized.length) lists[`${category}:${uses}`] = normalized;
			}
		}
		return lists;
	}

	private integer(value: unknown): number {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
	}

	private optionalInteger(value: unknown): number | undefined {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? Math.floor(numeric) : undefined;
	}

	private stringValues(value: unknown): string[] {
		return Array.isArray(value)
			? value.filter((item): item is string => typeof item === 'string' && !!item.trim()).map((item) => item.trim())
			: [];
	}

	private unknownValues(value: unknown): unknown[] {
		return Array.isArray(value) ? structuredClone(value) : [];
	}

	private normalizedSet(values: string[] | undefined): Set<string> {
		return new Set((values ?? []).map((value) => value.trim().toLocaleLowerCase()).filter(Boolean));
	}

	private string(value: unknown): string | undefined {
		return typeof value === 'string' && value.trim() ? value.trim() : undefined;
	}

	private asRecord(value: unknown): Record<string, unknown> | null {
		return value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: null;
	}
}
