import { Injectable, inject } from '@angular/core';
import type {
	CreatureCategory,
	CreatureFeature,
	CreatureSheet,
} from '../../models/creature-sheet-model';
import { normalizeArmorClass } from '../../models/creature-sheet-model';
import { Dnd5eApiService, type ApiMonster } from '../dnd-api/dnd-api';
import type { SavedSheetInterface } from '../local-storage-service/local-storage-service';

@Injectable({ providedIn: 'root' })
export class CreatureTemplateService {
	private readonly dndApi = inject(Dnd5eApiService);

	createFromSavedSheet(sheet: SavedSheetInterface): CreatureSheet {
		return this.normalizeCreature(sheet.data);
	}

	createFromApiMonster(monster: ApiMonster): CreatureSheet {
		return this.normalizeCreature(this.dndApi.toCreatureSheet(monster));
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
		return {
			name: typeof raw.name === 'string' ? raw.name.trim() || 'Creature' : 'Creature',
			maxHp: this.toNonNegativeInt(raw.maxHp),
			armorClass: normalizeArmorClass(raw.armorClass),
			spellSlots: this.normalizeSlots(raw.spellSlots),
			spells: this.normalizeSpells(raw.spells),
			specialAbilities: this.normalizeAbilities(raw.specialAbilities),
			features: this.normalizeFeatures(raw.features),
			rawFiveETools:
				raw.rawFiveETools && typeof raw.rawFiveETools === 'object' && !Array.isArray(raw.rawFiveETools)
					? structuredClone(raw.rawFiveETools)
					: undefined,
			fiveEToolsIdentity: raw.fiveEToolsIdentity
				? structuredClone(raw.fiveEToolsIdentity)
				: undefined,
		};
	}

	private normalizeSlots(slots: CreatureSheet['spellSlots'] | undefined): CreatureSheet['spellSlots'] {
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
			return [{
				id: typeof spell.id === 'string' && spell.id.trim() ? spell.id : `spell-${index + 1}`,
				name,
				...(typeof spell.source === 'string' && spell.source.trim() ? { source: spell.source.trim() } : {}),
				...(Number.isInteger(spell.level) ? { level: spell.level } : {}),
				...(Number.isFinite(spell.uses) ? { uses: this.toNonNegativeInt(spell.uses) } : {}),
			}];
		});
	}

	private normalizeAbilities(
		abilities: CreatureSheet['specialAbilities'] | undefined,
	): CreatureSheet['specialAbilities'] {
		if (!Array.isArray(abilities)) return [];
		return abilities.filter((ability) => typeof ability?.name === 'string' && ability.name.trim());
	}

	private normalizeFeatures(features: CreatureFeature[] | undefined): CreatureFeature[] {
		if (!Array.isArray(features)) return [];
		return features.flatMap((feature, index) => {
			const name = typeof feature?.name === 'string' ? feature.name.trim() : '';
			if (!name) return [];
			return [{
				id: typeof feature.id === 'string' && feature.id ? feature.id : `feature-${index + 1}`,
				name,
				description: typeof feature.description === 'string' ? feature.description.trim() || undefined : undefined,
				kind: feature.kind,
			}];
		});
	}

	private toNonNegativeInt(value: unknown): number {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
	}
}
