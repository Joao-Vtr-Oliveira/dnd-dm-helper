import { Injectable } from '@angular/core';
import type {
	CreatureAbilityKey,
	CreatureCategory,
	CreatureDamageDefense,
	CreatureFeature,
	CreatureSheet,
	CreatureSkill,
	CreatureSpeed,
	CreatureSavingThrow,
} from '../../models/creature-sheet-model';
import { normalizeArmorClass } from '../../models/creature-sheet-model';
import type { SavedSheetInterface } from '../local-storage-service/local-storage-service';

@Injectable({ providedIn: 'root' })
export class CreatureTemplateService {
	createFromSavedSheet(sheet: SavedSheetInterface): CreatureSheet {
		return this.normalizeCreature(sheet.data);
	}

	createManualCreature(args: {
		name: string;
		hp?: number | null;
		armorClass?: unknown;
		category?: CreatureCategory;
	}): CreatureSheet {
		void args.category;
		const hp = this.toNonNegativeInt(args.hp);
		return {
			name: args.name.trim() || 'Creature',
			maxHp: hp,
			armorClass: normalizeArmorClass(args.armorClass),
			spellSlots: [],
			spells: [],
			specialAbilities: [],
			features: [],
		};
	}

	cloneCreature(sheet: CreatureSheet, overrides?: Partial<CreatureSheet>): CreatureSheet {
		return this.normalizeCreature({ ...structuredClone(sheet), ...overrides });
	}

	normalizeCreature(raw: Partial<CreatureSheet>): CreatureSheet {
		const normalized: CreatureSheet = {
			name: typeof raw.name === 'string' ? raw.name.trim() || 'Creature' : 'Creature',
			maxHp: this.toNonNegativeInt(raw.maxHp),
			armorClass: normalizeArmorClass(raw.armorClass),
			spellSlots: this.normalizeSlots(raw.spellSlots),
			spells: this.normalizeSpells(raw.spells),
			specialAbilities: this.normalizeAbilities(raw.specialAbilities),
			features: this.normalizeFeatures(raw.features),
			rawFiveETools:
				raw.rawFiveETools &&
				typeof raw.rawFiveETools === 'object' &&
				!Array.isArray(raw.rawFiveETools)
					? structuredClone(raw.rawFiveETools)
					: undefined,
			fiveEToolsIdentity: raw.fiveEToolsIdentity
				? structuredClone(raw.fiveEToolsIdentity)
				: undefined,
			officialOrigin: raw.officialOrigin ? structuredClone(raw.officialOrigin) : undefined,
			officialSnapshot: raw.officialSnapshot ? structuredClone(raw.officialSnapshot) : undefined,
		};
		return {
			...normalized,
			...this.optionalStringArray('aliases', raw.aliases),
			...this.optionalStringArray('groups', raw.groups),
			...this.optionalStringArray('tags', raw.tags),
			...this.optionalText('origin', raw.origin),
			...this.optionalText('source', raw.source),
			...this.optionalText('size', raw.size),
			...this.optionalText('creatureType', raw.creatureType),
			...this.optionalText('alignment', raw.alignment),
			...this.optionalText('challengeRating', raw.challengeRating),
			...this.optionalNonNegativeInteger('level', raw.level),
			...this.optionalText('armorClassNote', raw.armorClassNote),
			...this.optionalText('hitPointFormula', raw.hitPointFormula),
			...this.optionalValue('speed', this.normalizeSpeed(raw.speed)),
			...this.optionalValue('abilityScores', this.normalizeAbilityScores(raw.abilityScores)),
			...this.optionalValue('savingThrows', this.normalizeSavingThrows(raw.savingThrows)),
			...this.optionalValue('skills', this.normalizeSkills(raw.skills)),
			...this.optionalNonNegativeInteger('passivePerception', raw.passivePerception),
			...this.optionalValue(
				'damageVulnerabilities',
				this.normalizeDefenses(raw.damageVulnerabilities),
			),
			...this.optionalValue('damageResistances', this.normalizeDefenses(raw.damageResistances)),
			...this.optionalValue('damageImmunities', this.normalizeDefenses(raw.damageImmunities)),
			...this.optionalStringArray('conditionImmunities', raw.conditionImmunities),
			...this.optionalValue('senses', this.normalizeSenses(raw.senses)),
			...this.optionalStringArray('languages', raw.languages),
			...this.optionalValue('spellcasting', this.normalizeSpellcasting(raw.spellcasting)),
			...this.optionalValue(
				'legendaryActions',
				this.normalizeLegendaryActions(raw.legendaryActions),
			),
		};
	}

	private normalizeSlots(
		slots: CreatureSheet['spellSlots'] | undefined,
	): CreatureSheet['spellSlots'] {
		if (!Array.isArray(slots)) return [];
		return slots
			.filter((slot) => Number.isInteger(slot?.level) && slot.level >= 1 && slot.level <= 9)
			.map((slot) => ({ level: slot.level, max: this.toNonNegativeInt(slot.max) }))
			.sort((left, right) => left.level - right.level);
	}

	private normalizeSpells(spells: CreatureSheet['spells'] | undefined): CreatureSheet['spells'] {
		if (!Array.isArray(spells)) return [];
		return spells.flatMap((spell, index) => {
			const name = typeof spell?.name === 'string' ? spell.name.trim() : '';
			if (!name) return [];
			return [
				{
					id: typeof spell.id === 'string' && spell.id.trim() ? spell.id : `spell-${index + 1}`,
					name,
					...(typeof spell.source === 'string' && spell.source.trim()
						? { source: spell.source.trim() }
						: {}),
					...(Number.isInteger(spell.level) ? { level: spell.level } : {}),
					...(Number.isFinite(spell.uses) ? { uses: this.toNonNegativeInt(spell.uses) } : {}),
					...(['slot', 'at-will', 'constant', 'daily', 'rest', 'weekly'].includes(
						String(spell.castingGroup),
					)
						? { castingGroup: spell.castingGroup }
						: {}),
					...(spell.each === true ? { each: true } : {}),
				},
			];
		});
	}

	private normalizeAbilities(
		abilities: CreatureSheet['specialAbilities'] | undefined,
	): CreatureSheet['specialAbilities'] {
		if (!Array.isArray(abilities)) return [];
		return abilities.flatMap((ability, index) => {
			const featureId = typeof ability?.featureId === 'string' ? ability.featureId.trim() : '';
			const name = typeof ability?.name === 'string' ? ability.name.trim() : '';
			if (!featureId && !name) return [];
			return [
				{
					...structuredClone(ability),
					id:
						typeof ability.id === 'string' && ability.id.trim()
							? ability.id
							: `ability-${index + 1}`,
					...(featureId ? { featureId } : {}),
					...(name ? { name } : {}),
					...(typeof ability.description === 'string' && ability.description.trim()
						? { description: ability.description.trim() }
						: {}),
				},
			];
		});
	}

	private normalizeFeatures(features: CreatureFeature[] | undefined): CreatureFeature[] {
		if (!Array.isArray(features)) return [];
		return features.flatMap((feature, index) => {
			const name = typeof feature?.name === 'string' ? feature.name.trim() : '';
			if (!name) return [];
			const kind = this.featureKind(feature.kind);
			return [
				{
					id: typeof feature.id === 'string' && feature.id ? feature.id : `feature-${index + 1}`,
					name,
					description:
						typeof feature.description === 'string'
							? feature.description.trim() || undefined
							: undefined,
					kind,
					...this.optionalPositiveInteger('legendaryCost', feature.legendaryCost),
				},
			];
		});
	}

	private normalizeSpeed(speed: CreatureSheet['speed'] | undefined): CreatureSpeed[] | undefined {
		if (!Array.isArray(speed)) return undefined;
		const unique = new Set<string>();
		const normalized = speed.flatMap((entry) => {
			const type = typeof entry?.type === 'string' ? entry.type.trim() : '';
			if (!type || unique.has(type.toLocaleLowerCase())) return [];
			unique.add(type.toLocaleLowerCase());
			const distance = typeof entry.distance === 'string' ? entry.distance.trim() : '';
			return [{ type, ...(distance ? { distance } : {}), ...(entry.hover ? { hover: true } : {}) }];
		});
		return normalized.length ? normalized : undefined;
	}

	private normalizeAbilityScores(
		abilities: CreatureSheet['abilityScores'] | undefined,
	): CreatureSheet['abilityScores'] | undefined {
		if (!abilities || typeof abilities !== 'object' || Array.isArray(abilities)) return undefined;
		const normalized = Object.fromEntries(
			this.abilityKeys.flatMap((ability) => {
				const value = abilities[ability];
				return Number.isFinite(value) ? [[ability, Math.floor(value as number)]] : [];
			}),
		) as Partial<Record<CreatureAbilityKey, number>>;
		return Object.keys(normalized).length ? normalized : undefined;
	}

	private normalizeSavingThrows(
		values: CreatureSheet['savingThrows'] | undefined,
	): CreatureSavingThrow[] | undefined {
		if (!Array.isArray(values)) return undefined;
		const unique = new Set<CreatureAbilityKey>();
		const normalized = values.flatMap((entry) => {
			if (
				!this.isAbilityKey(entry?.ability) ||
				unique.has(entry.ability) ||
				!Number.isFinite(entry.bonus)
			)
				return [];
			unique.add(entry.ability);
			return [{ ability: entry.ability, bonus: Math.floor(entry.bonus) }];
		});
		return normalized.length ? normalized : undefined;
	}

	private normalizeSkills(
		values: CreatureSheet['skills'] | undefined,
	): CreatureSkill[] | undefined {
		if (!Array.isArray(values)) return undefined;
		const unique = new Set<string>();
		const normalized = values.flatMap((entry) => {
			const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
			const key = name.toLocaleLowerCase();
			if (!name || unique.has(key) || !Number.isFinite(entry.bonus)) return [];
			unique.add(key);
			return [{ name, bonus: Math.floor(entry.bonus) }];
		});
		return normalized.length ? normalized : undefined;
	}

	private normalizeDefenses(
		values: CreatureSheet['damageResistances'] | undefined,
	): CreatureDamageDefense[] | undefined {
		if (!Array.isArray(values)) return undefined;
		const normalized = values.flatMap((entry) => {
			const types = this.uniqueStrings(entry?.types);
			const note = typeof entry?.note === 'string' ? entry.note.trim() : '';
			return types.length ? [{ types, ...(note ? { note } : {}) }] : [];
		});
		return normalized.length ? normalized : undefined;
	}

	private normalizeSenses(
		values: CreatureSheet['senses'] | undefined,
	): CreatureSheet['senses'] | undefined {
		if (!Array.isArray(values)) return undefined;
		const normalized = values.flatMap((entry) => {
			const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
			const detail = typeof entry?.detail === 'string' ? entry.detail.trim() : '';
			return name ? [{ name, ...(detail ? { detail } : {}) }] : [];
		});
		return normalized.length ? normalized : undefined;
	}

	private normalizeSpellcasting(
		value: CreatureSheet['spellcasting'] | undefined,
	): CreatureSheet['spellcasting'] | undefined {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
		const normalized = {
			...(this.isAbilityKey(value.ability) ? { ability: value.ability } : {}),
			...this.optionalNonNegativeInteger('spellSaveDc', value.spellSaveDc),
			...(Number.isFinite(value.spellAttackBonus)
				? { spellAttackBonus: Math.floor(value.spellAttackBonus as number) }
				: {}),
			...this.optionalText('header', value.header),
			...this.optionalText('slotRecovery', value.slotRecovery),
		};
		return Object.keys(normalized).length ? normalized : undefined;
	}

	private normalizeLegendaryActions(
		value: CreatureSheet['legendaryActions'] | undefined,
	): CreatureSheet['legendaryActions'] | undefined {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
		const normalized = {
			...this.optionalPositiveInteger('count', value.count),
			...this.optionalText('intro', value.intro),
		};
		return Object.keys(normalized).length ? normalized : undefined;
	}

	private optionalText<Key extends string>(key: Key, value: unknown): Partial<Record<Key, string>> {
		const text = typeof value === 'string' ? value.trim() : '';
		return text ? ({ [key]: text } as Partial<Record<Key, string>>) : {};
	}

	private optionalStringArray<Key extends string>(
		key: Key,
		value: unknown,
	): Partial<Record<Key, string[]>> {
		const values = this.uniqueStrings(value);
		return values.length ? ({ [key]: values } as Partial<Record<Key, string[]>>) : {};
	}

	private optionalValue<Key extends string, Value>(
		key: Key,
		value: Value | undefined,
	): Partial<Record<Key, Value>> {
		return value === undefined ? {} : ({ [key]: value } as Partial<Record<Key, Value>>);
	}

	private optionalNonNegativeInteger<Key extends string>(
		key: Key,
		value: unknown,
	): Partial<Record<Key, number>> {
		const numeric = Number(value);
		return Number.isFinite(numeric) && numeric >= 0
			? ({ [key]: Math.floor(numeric) } as Partial<Record<Key, number>>)
			: {};
	}

	private optionalPositiveInteger<Key extends string>(
		key: Key,
		value: unknown,
	): Partial<Record<Key, number>> {
		const numeric = Number(value);
		return Number.isFinite(numeric) && numeric > 0
			? ({ [key]: Math.floor(numeric) } as Partial<Record<Key, number>>)
			: {};
	}

	private uniqueStrings(value: unknown): string[] {
		if (!Array.isArray(value)) return [];
		const values = new Map<string, string>();
		for (const item of value) {
			if (typeof item !== 'string' || !item.trim()) continue;
			values.set(item.trim().toLocaleLowerCase(), item.trim());
		}
		return [...values.values()];
	}

	private featureKind(value: unknown): CreatureFeature['kind'] {
		return ['trait', 'action', 'bonus', 'reaction', 'legendary', 'spellcasting', 'note'].includes(
			String(value),
		)
			? (value as CreatureFeature['kind'])
			: 'note';
	}

	private isAbilityKey(value: unknown): value is CreatureAbilityKey {
		return this.abilityKeys.includes(value as CreatureAbilityKey);
	}

	private readonly abilityKeys: CreatureAbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

	private toNonNegativeInt(value: unknown): number {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
	}
}
