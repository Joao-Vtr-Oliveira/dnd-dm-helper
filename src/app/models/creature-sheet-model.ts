import type { FiveEToolsMonster } from './fiveetools-homebrew-model';
import type { CompendiumMonster } from './compendium-bestiary-model';
import type { SpellReference } from './spell-reference-model';

export type CreatureCategory = 'monster' | 'npc' | 'pc' | 'other';
export type ArmorClass = number | null;
export type CreatureAbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type CreatureSpeedType = 'walk' | 'fly' | 'swim' | 'climb' | 'burrow';
export type CreatureFeatureKind =
	'trait' | 'action' | 'bonus' | 'reaction' | 'legendary' | 'spellcasting' | 'note';
export type CreatureAbilityRecoveryType =
	| 'manual'
	| 'turn-cooldown'
	| 'round-cooldown'
	| 'uses-per-day'
	| 'short-rest'
	| 'long-rest'
	| 'dice-recharge';

export interface CreatureSpell extends SpellReference {
	id: string;
	level?: number;
	uses?: number;
	/** Optional stat-block grouping. Absent values retain the legacy level-based behavior. */
	castingGroup?: 'slot' | 'at-will' | 'constant' | 'daily' | 'rest' | 'weekly';
	each?: boolean;
}

export interface CreatureSpellSlot {
	level: number;
	max: number;
}

export interface CreatureFeature {
	id: string;
	name: string;
	description?: string;
	kind: CreatureFeatureKind;
	legendaryCost?: number;
}

export interface CreatureSpecialAbility {
	id: string;
	/** Links new operational data to a stat-block feature without duplicating it. */
	featureId?: string;
	/** Legacy abilities have their own name and description. */
	name?: string;
	description?: string;
	recoveryType: CreatureAbilityRecoveryType;
	maxUses?: number;
	cooldownTurns?: number;
	cooldownRounds?: number;
	rechargeDice?: 'd6';
	rechargeOn?: number[];
}

export interface CreatureSpeed {
	type: CreatureSpeedType | string;
	distance?: string;
	hover?: boolean;
}

export interface CreatureSavingThrow {
	ability: CreatureAbilityKey;
	bonus: number;
}

export interface CreatureSkill {
	name: string;
	bonus: number;
}

/** A single line in a damage defense section, optionally with a condition/note. */
export interface CreatureDamageDefense {
	types: string[];
	note?: string;
}

export interface CreatureSense {
	name: string;
	detail?: string;
}

export interface CreatureSpellcastingMetadata {
	ability?: CreatureAbilityKey;
	spellSaveDc?: number;
	spellAttackBonus?: number;
	header?: string;
	slotRecovery?: string;
}

export interface CreatureLegendaryActionsMetadata {
	count?: number;
	intro?: string;
}

export interface FiveEToolsIdentity {
	name: string;
	source: string;
}

export interface CreatureOfficialOrigin {
	provider: '5etools';
	name: string;
	source: string;
}

/** Reusable, immutable combat-sheet data. Runtime state belongs to BattleCombatant. */
export interface CreatureSheet {
	name: string;
	armorClass: ArmorClass;
	maxHp: number;
	spellSlots: CreatureSpellSlot[];
	spells: CreatureSpell[];
	specialAbilities: CreatureSpecialAbility[];
	features: CreatureFeature[];
	aliases?: string[];
	groups?: string[];
	source?: string;
	size?: string;
	creatureType?: string;
	alignment?: string;
	challengeRating?: string;
	level?: number;
	armorClassNote?: string;
	hitPointFormula?: string;
	speed?: CreatureSpeed[];
	abilityScores?: Partial<Record<CreatureAbilityKey, number>>;
	savingThrows?: CreatureSavingThrow[];
	skills?: CreatureSkill[];
	passivePerception?: number;
	damageVulnerabilities?: CreatureDamageDefense[];
	damageResistances?: CreatureDamageDefense[];
	damageImmunities?: CreatureDamageDefense[];
	conditionImmunities?: string[];
	senses?: CreatureSense[];
	languages?: string[];
	spellcasting?: CreatureSpellcastingMetadata;
	legendaryActions?: CreatureLegendaryActionsMetadata;
	rawFiveETools?: FiveEToolsMonster;
	fiveEToolsIdentity?: FiveEToolsIdentity;
	officialOrigin?: CreatureOfficialOrigin;
	officialSnapshot?: CompendiumMonster;
}

/** Converts UI/import values into the internal AC contract. */
export function normalizeArmorClass(value: unknown): ArmorClass {
	if (value == null || value === '') return null;
	const numeric = typeof value === 'number' ? value : Number(String(value).trim());
	return Number.isFinite(numeric) ? numeric : null;
}
