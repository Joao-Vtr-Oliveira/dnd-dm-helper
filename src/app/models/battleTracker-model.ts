import type { FiveEToolsMonster } from './fiveetools-homebrew-model';

// TODO: Create the types, all here or in differents files.

export interface BattleTracker {
	creatures: CreatureInterface[];
	creatureIdCount: number;
	lairActions?: EncounterLairAction[];
	traps?: EncounterTrap[];
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
	rawFiveETools?: FiveEToolsMonster;
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

export type CreatureAbilityRechargeType =
	| 'manual'
	| 'turns'
	| 'rounds'
	| 'dice'
	| 'per-day'
	| 'short-rest'
	| 'long-rest';
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
	maxUses?: number;
	cooldownTurns?: number;
	cooldownRounds?: number;
	rechargeDice?: string;
	rechargeOn?: number[];
}

export type EncounterLairActionFrequency = 'every-round' | 'cooldown-rounds' | 'manual';
export type EncounterTrapTriggerType = 'initiative' | 'round-start' | 'round-end' | 'manual';
export type EncounterTrapFrequency = 'once' | 'every-round' | 'cooldown-rounds' | 'manual';

export interface EncounterLairAction {
	id: string;
	name: string;
	description?: string;
	initiative: number;
	active: boolean;
	frequency: EncounterLairActionFrequency;
	cooldownRounds?: number;
	currentCooldownRounds?: number;
	lastTriggeredAtRound?: number;
}

export interface EncounterTrap {
	id: string;
	name: string;
	description?: string;
	triggerType: EncounterTrapTriggerType;
	initiative?: number;
	active: boolean;
	frequency: EncounterTrapFrequency;
	cooldownRounds?: number;
	currentCooldownRounds?: number;
	lastTriggeredAtRound?: number;
}

export type SpellsByKey = Record<string, SpellInterface>;

export type SpellLevel = '1st' | '2nd' | '3rd' | '4th' | '5th' | '6th' | '7th' | '8th' | '9th';

export type SpellSlots = Partial<Record<SpellLevel, number>>;
