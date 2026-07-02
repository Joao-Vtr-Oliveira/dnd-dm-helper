// TODO: Create the types, all here or in differents files.

export interface BattleTracker {
	creatures: CreatureInterface[];
	creatureIdCount: number;
	round: number;
	battleCreated: boolean;
	shareEnabled: false;
	battleTrackerVersion: '5.123.0';
	sharedTimestamp: null;
	loaded: boolean;
}


export interface CreatureInterface {
	name: string;
	initiative: number | null;
	healthPoints: number;
	maxHealthPoints: number;
	armorClass: string | number;
	temporaryHealthPoints: number | null;
	id: number;
	alive: boolean;
	conditions: ConditionInterface[];
	notes: NoteInterface[];
	shared: boolean;
	hitPointsShared: boolean;
	totalSpellSlots: SpellSlots | null;
	usedSpellSlots: SpellSlots | null;
	spells: SpellsByKey;
	specialAbilities: CreatureSpecialAbility[];
	sheetFeatures?: CreatureFeature[];
	category?: CreatureCategory;
	sourceSheetId?: string;
}

export interface NoteInterface {
	text: string;
	appliedAtRound: number | 0;
	appliedAtSeconds: number | 0;
	id: number;
}

export interface ConditionInterface {
	text: string;
	appliedAtRound: number;
	appliedAtSeconds: number;
	url: string;
	id: string;
}

export interface SpellInterface {
	label: string;
	total: number;
}

export type CreatureAbilityRechargeType = 'manual' | 'turns' | 'rounds' | 'dice';
export type CreatureCategory = 'monster' | 'npc' | 'pc' | 'other';
export type CreatureFeatureKind =
	| 'trait'
	| 'action'
	| 'reaction'
	| 'legendary'
	| 'spellcasting'
	| 'note';

export interface CreatureFeature {
	id: string;
	name: string;
	description?: string;
	kind: CreatureFeatureKind;
}

export interface CreatureSpecialAbility {
	id: string;
	name: string;
	description?: string;
	rechargeType: CreatureAbilityRechargeType;
	cooldownTurns?: number;
	cooldownRounds?: number;
	rechargeDice?: string;
	rechargeOn?: number[];
}

export type SpellsByKey = Record<string, SpellInterface>;

export type SpellLevel = '1st' | '2nd' | '3rd' | '4th' | '5th' | '6th' | '7th' | '8th' | '9th';

export type SpellSlots = Partial<Record<SpellLevel, number>>;
