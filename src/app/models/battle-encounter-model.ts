import type { BattleTracker, CreatureCategory } from './battleTracker-model';

export type BattleEncounterStatus = 'active' | 'paused' | 'completed';
export type BattleCombatantSide = 'player' | 'ally' | 'enemy' | 'neutral';
export type BattleConditionDurationType =
	| 'manual'
	| 'turns'
	| 'rounds'
	| 'until-start-of-turn'
	| 'until-end-of-turn';
export type BattleConditionExpirationTiming = 'start' | 'end';
export type BattleAbilityRechargeType = 'manual' | 'turns' | 'rounds' | 'dice';

export interface EncounterTemplate {
	id: string;
	name: string;
	description?: string;
	data: BattleTracker;
}

export interface BattleCondition {
	id: string;
	name: string;
	label: string;
	description?: string;
	appliedAtRound: number;
	appliedAtTurnIndex: number;
	appliedAtCombatantId?: string;
	durationType: BattleConditionDurationType;
	durationTurns?: number;
	durationRounds?: number;
	expiresAtRound?: number;
	expiresAtTurnIndex?: number;
	expiresAtTiming?: BattleConditionExpirationTiming;
	sourceCombatantId?: string;
}

export interface BattleSpecialAbility {
	id: string;
	name: string;
	description?: string;
	rechargeType: BattleAbilityRechargeType;
	cooldownTurns?: number;
	cooldownRounds?: number;
	currentCooldownTurns?: number;
	currentCooldownRounds?: number;
	rechargeDice?: string;
	rechargeOn?: number[];
	isAvailable: boolean;
	lastUsedAtRound?: number;
	lastUsedAtTurnIndex?: number;
}

export interface BattleSpellSlotLevel {
	level: number;
	max: number;
	used: number;
}

export interface BattleCombatant {
	id: string;
	sourceCreatureId?: number;
	sourceSheetId?: string;
	name: string;
	displayName?: string;
	category?: CreatureCategory;
	side: BattleCombatantSide;
	initiative: number;
	nextRoundInitiative?: number;
	initiativeTieBreaker?: number;
	turnOrder: number;
	armorClass?: number;
	maxHp: number;
	currentHp: number;
	temporaryHp: number;
	defeated: boolean;
	hidden: boolean;
	collapsed: boolean;
	spellSlotsCollapsed: boolean;
	pendingAdd: boolean;
	joinsAtRound?: number;
	conditions: BattleCondition[];
	specialAbilities: BattleSpecialAbility[];
	spellSlots: BattleSpellSlotLevel[];
	privateNotes?: string;
}

export interface BattleTurnLogEntry {
	id: string;
	round: number;
	turnIndex: number;
	combatantId: string;
	combatantName: string;
	startedAt: string;
	endedAt?: string;
	durationSeconds?: number;
	notes?: string;
}

export interface BattleEncounter {
	id: string;
	sourceEncounterId: string;
	name: string;
	description?: string;
	status: BattleEncounterStatus;
	round: number;
	activeTurnIndex: number;
	createdAt: string;
	startedAt: string;
	updatedAt: string;
	completedAt?: string;
	turnStartedAt?: string;
	currentTurnElapsedSeconds?: number;
	combatants: BattleCombatant[];
	pendingCombatants: BattleCombatant[];
	turnHistory: BattleTurnLogEntry[];
	dmNotes?: string;
}

export interface BattleConditionPreset {
	name: string;
	label: string;
	description?: string;
}

export interface BattleEncounterCreateOptions {
	name?: string;
	combatantSides?: Record<number, BattleCombatantSide>;
	initiativeOverrides?: Record<number, number>;
}
