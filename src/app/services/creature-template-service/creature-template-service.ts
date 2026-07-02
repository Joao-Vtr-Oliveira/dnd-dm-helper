import { Injectable, inject } from '@angular/core';
import type {
	CreatureCategory,
	CreatureFeature,
	CreatureInterface,
} from '../../models/battleTracker-model';
import { Dnd5eApiService, type ApiMonster } from '../dnd-api/dnd-api';
import type { SavedSheetInterface } from '../local-storage-service/local-storage-service';

@Injectable({ providedIn: 'root' })
export class CreatureTemplateService {
	private readonly dndApi = inject(Dnd5eApiService);

	createFromSavedSheet(
		sheet: SavedSheetInterface,
		args: { id: number; quantityIndex?: number }
	): CreatureInterface {
		const creature = this.normalizeCreature({
			...structuredClone(sheet.data),
			id: args.id,
			category: sheet.category ?? sheet.data.category ?? 'monster',
			sourceSheetId: sheet.id,
		});

		if ((args.quantityIndex ?? 0) > 0) {
			creature.name = `${creature.name} #${args.quantityIndex! + 1}`;
		}

		return creature;
	}

	createFromApiMonster(
		monster: ApiMonster,
		args: { id: number; initiative?: number | null; quantityIndex?: number }
	): CreatureInterface {
		const creature = this.normalizeCreature({
			...this.dndApi.toCreature(monster, {
				id: args.id,
				initiative: args.initiative ?? null,
			}),
			category: 'monster',
		});

		if ((args.quantityIndex ?? 0) > 0) {
			creature.name = `${creature.name} #${args.quantityIndex! + 1}`;
		}

		return creature;
	}

	createManualCreature(args: {
		id: number;
		name: string;
		initiative?: number | null;
		hp?: number | null;
		armorClass?: string | number;
		category?: CreatureCategory;
	}): CreatureInterface {
		const hp = this.toNonNegativeInt(args.hp);
		return this.normalizeCreature({
			name: args.name.trim() || `Creature #${args.id + 1}`,
			initiative: args.initiative ?? null,
			healthPoints: hp,
			maxHealthPoints: hp,
			armorClass: args.armorClass ?? '',
			temporaryHealthPoints: null,
			id: args.id,
			alive: true,
			conditions: [],
			notes: [],
			shared: true,
			hitPointsShared: true,
			totalSpellSlots: null,
			usedSpellSlots: null,
			spells: {},
			specialAbilities: [],
			sheetFeatures: [],
			category: args.category ?? 'monster',
		});
	}

	cloneCreature(creature: CreatureInterface, overrides?: Partial<CreatureInterface>): CreatureInterface {
		return this.normalizeCreature({
			...structuredClone(creature),
			...overrides,
		});
	}

	normalizeCreature(raw: Partial<CreatureInterface>): CreatureInterface {
		return {
			name: typeof raw.name === 'string' ? raw.name : 'Creature',
			initiative: raw.initiative == null ? null : this.toFiniteNumber(raw.initiative),
			healthPoints: this.toNonNegativeInt(raw.healthPoints),
			maxHealthPoints: this.toNonNegativeInt(raw.maxHealthPoints ?? raw.healthPoints),
			armorClass:
				raw.armorClass == null || raw.armorClass === ''
					? ''
					: typeof raw.armorClass === 'number'
						? raw.armorClass
						: String(raw.armorClass),
			temporaryHealthPoints:
				raw.temporaryHealthPoints == null ? null : this.toNonNegativeInt(raw.temporaryHealthPoints),
			id: typeof raw.id === 'number' ? raw.id : Date.now(),
			alive: raw.alive !== false,
			conditions: Array.isArray(raw.conditions) ? raw.conditions : [],
			notes: Array.isArray(raw.notes) ? raw.notes : [],
			shared: raw.shared !== false,
			hitPointsShared: raw.hitPointsShared !== false,
			totalSpellSlots: raw.totalSpellSlots ?? null,
			usedSpellSlots: raw.usedSpellSlots ?? null,
			spells: raw.spells ?? {},
			specialAbilities: Array.isArray(raw.specialAbilities) ? raw.specialAbilities : [],
			sheetFeatures: this.normalizeFeatures(raw.sheetFeatures),
			category: this.normalizeCategory(raw.category),
			sourceSheetId: typeof raw.sourceSheetId === 'string' ? raw.sourceSheetId : undefined,
		};
	}

	private normalizeCategory(value: unknown): CreatureCategory {
		if (value === 'pc') return 'pc';
		if (value === 'npc') return 'npc';
		if (value === 'other') return 'other';
		return 'monster';
	}

	private normalizeFeatures(features: unknown): CreatureFeature[] {
		if (!Array.isArray(features)) return [];
		const normalized = features
			.map((feature, index) => {
				const candidate = feature as Partial<CreatureFeature>;
				const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
				if (!name) return null;
				return {
					id: typeof candidate.id === 'string' ? candidate.id : `feature-${index + 1}`,
					name,
					description:
						typeof candidate.description === 'string' ? candidate.description.trim() : undefined,
					kind: this.normalizeFeatureKind(candidate.kind),
				};
			})
			.filter((feature) => feature !== null);
		return normalized as CreatureFeature[];
	}

	private normalizeFeatureKind(value: unknown): CreatureFeature['kind'] {
		if (
			value === 'trait' ||
			value === 'action' ||
			value === 'reaction' ||
			value === 'legendary' ||
			value === 'spellcasting' ||
			value === 'note'
		) {
			return value;
		}
		return 'note';
	}

	private toNonNegativeInt(value: unknown): number {
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) return 0;
		return Math.max(0, Math.floor(numeric));
	}

	private toFiniteNumber(value: unknown): number {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? numeric : 0;
	}
}
