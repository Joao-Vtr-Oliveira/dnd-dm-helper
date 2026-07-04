import type {
	BattleTracker,
	CreatureCategory,
	CreatureFeature,
	SpellsByKey,
} from './battleTracker-model';

export type BattleEncounterStatus = 'active' | 'paused' | 'completed';
export type BattleCombatantSide = 'player' | 'ally' | 'enemy' | 'neutral';
export type BattleEventActorType = 'combatant' | 'lair-action' | 'trap' | 'environment';
export type BattleConditionDurationType =
	| 'manual'
	| 'turns'
	| 'rounds'
	| 'until-start-of-turn'
	| 'until-end-of-turn';
export type BattleConditionExpirationTiming = 'start' | 'end';
export type BattleAbilityRechargeType = 'manual' | 'turns' | 'rounds' | 'dice';
export type BattleAbilityRecoveryType =
	| 'manual'
	| 'turn-cooldown'
	| 'round-cooldown'
	| 'uses-per-day'
	| 'short-rest'
	| 'long-rest'
	| 'dice-recharge';
export type BattleLairActionFrequency = 'every-round' | 'cooldown-rounds' | 'manual';
export type BattleTrapTriggerType = 'initiative' | 'round-start' | 'round-end' | 'manual';
export type BattleTrapFrequency = 'once' | 'every-round' | 'cooldown-rounds' | 'manual';
export type BattleUpcomingEventType =
	| 'turn'
	| 'round-start'
	| 'condition-expire'
	| 'ability-recharge'
	| 'lair-action'
	| 'trap'
	| 'pending-combatant';

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
	recoveryType: BattleAbilityRecoveryType;
	rechargeType?: BattleAbilityRechargeType;
	maxUses?: number;
	usedCount?: number;
	cooldownTurns?: number;
	cooldownRounds?: number;
	currentCooldownTurns?: number;
	currentCooldownRounds?: number;
	rechargeDice?: 'd6';
	rechargeOn?: number[];
	isAvailable: boolean;
	lastUsedAtRound?: number;
	lastUsedAtTurnIndex?: number;
	lastUsedAt?: string;
	lastRechargeRoll?: number;
}

export interface BattleLairAction {
	id: string;
	name: string;
	description?: string;
	initiative: number;
	active: boolean;
	frequency: BattleLairActionFrequency;
	cooldownRounds?: number;
	currentCooldownRounds?: number;
	lastTriggeredAtRound?: number;
}

export interface BattleTrap {
	id: string;
	name: string;
	description?: string;
	triggerType: BattleTrapTriggerType;
	initiative?: number;
	active: boolean;
	frequency: BattleTrapFrequency;
	cooldownRounds?: number;
	currentCooldownRounds?: number;
	lastTriggeredAtRound?: number;
}

export interface BattleUpcomingEvent {
	id: string;
	type: BattleUpcomingEventType;
	label: string;
	round: number;
	turnIndex?: number;
	combatantId?: string;
	priority: number;
	actorType?: BattleEventActorType;
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
	inactiveUntilRound?: number;
	collapsed: boolean;
	spellSlotsCollapsed: boolean;
	pendingAdd: boolean;
	joinsAtRound?: number;
	conditions: BattleCondition[];
	specialAbilities: BattleSpecialAbility[];
	spellSlots: BattleSpellSlotLevel[];
	spells: SpellsByKey;
	sheetFeatures: CreatureFeature[];
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
	lairActions: BattleLairAction[];
	traps: BattleTrap[];
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
