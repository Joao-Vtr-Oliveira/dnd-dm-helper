import type {
	CreatureCategory,
	CreatureDamageDefense,
	CreatureSheet,
	CreatureFeature,
	CreatureSpell,
} from './creature-sheet-model';

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
	| 'uses-per-combat'
	| 'short-rest'
	| 'long-rest'
	| 'dice-recharge';
export type BattlePendingActionType = 'dice-recharge' | 'concentration-check' | 'death-save';
export type BattleDeathSaveStatus = 'active' | 'stable' | 'dead';
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

export type BattleSpecialTurnType = 'lair-action' | 'trap';

export interface BattleSpecialTurn {
	type: BattleSpecialTurnType;
	eventId: string;
	round: number;
	initiative: number;
	anchorTurnIndex: number;
	triggerType?: BattleTrapTriggerType;
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
	lastRechargeAttemptAtRound?: number;
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

interface BattlePendingActionBase {
	id: string;
	type: BattlePendingActionType;
	combatantId: string;
	createdAtRound: number;
	createdAtTurnIndex: number;
	priority: number;
}

export interface BattleDiceRechargePendingAction extends BattlePendingActionBase {
	type: 'dice-recharge';
	abilityId: string;
	abilityName: string;
	rechargeOn: number[];
}

export interface BattleConcentrationCheckPendingAction extends BattlePendingActionBase {
	type: 'concentration-check';
	damage: number;
	difficultyClass: number;
}

export interface BattleDeathSavePendingAction extends BattlePendingActionBase {
	type: 'death-save';
}

export type BattlePendingAction =
	| BattleDiceRechargePendingAction
	| BattleConcentrationCheckPendingAction
	| BattleDeathSavePendingAction;

export interface BattleDeathSaveState {
	status: BattleDeathSaveStatus;
	successes: number;
	failures: number;
}

export interface BattleCombatant {
	id: string;
	sourceParticipantId?: string;
	sourceSheetId?: string;
	/** Links this runtime combatant to an immutable battle-local stat-block snapshot. */
	referenceSheetId?: string;
	name: string;
	displayName?: string;
	category?: CreatureCategory;
	side: BattleCombatantSide;
	initiative: number;
	nextRoundInitiative?: number;
	initiativeTieBreaker?: number;
	nextRoundInitiativeTieBreaker?: number | null;
	turnOrder: number;
	armorClass: number | null;
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
	deathSaves?: BattleDeathSaveState;
	specialAbilities: BattleSpecialAbility[];
	spellSlots: BattleSpellSlotLevel[];
	spells: CreatureSpell[];
	features: CreatureFeature[];
	damageVulnerabilities?: CreatureDamageDefense[];
	damageResistances?: CreatureDamageDefense[];
	damageImmunities?: CreatureDamageDefense[];
	conditionImmunities?: string[];
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

export interface BattleTurnSnapshotState {
	status: BattleEncounterStatus;
	round: number;
	activeTurnIndex: number;
	activeSpecialTurn?: BattleSpecialTurn;
	completedAt?: string;
	turnStartedAt?: string;
	currentTurnElapsedSeconds?: number;
	combatants: BattleCombatant[];
	pendingCombatants: BattleCombatant[];
	lairActions: BattleLairAction[];
	traps: BattleTrap[];
	turnHistory: BattleTurnLogEntry[];
	dmNotes?: string;
	pendingActions: BattlePendingAction[];
}

export interface BattleTurnSnapshot {
	id: string;
	createdAt: string;
	round: number;
	activeTurnIndex: number;
	combatantName?: string;
	state: BattleTurnSnapshotState;
}

/** Immutable stat-block data captured when a combatant joins a battle. */
export interface BattleReferenceSheet {
	id: string;
	sheet: CreatureSheet;
}

export interface BattleEncounter {
	id: string;
	/** Optional provenance. Historical battles remain valid after their encounter is deleted. */
	sourceEncounterId?: string;
	name: string;
	description?: string;
	status: BattleEncounterStatus;
	round: number;
	activeTurnIndex: number;
	activeSpecialTurn?: BattleSpecialTurn;
	createdAt: string;
	startedAt: string;
	updatedAt: string;
	completedAt?: string;
	turnStartedAt?: string;
	currentTurnElapsedSeconds?: number;
	/** Battle-local stat-block snapshots. Deliberately excluded from turn snapshots. */
	referenceSheets: BattleReferenceSheet[];
	combatants: BattleCombatant[];
	pendingCombatants: BattleCombatant[];
	lairActions: BattleLairAction[];
	traps: BattleTrap[];
	turnHistory: BattleTurnLogEntry[];
	dmNotes?: string;
	pendingActions: BattlePendingAction[];
	turnSnapshots: BattleTurnSnapshot[];
}

export interface BattleConditionPreset {
	name: string;
	label: string;
	description?: string;
}

export interface BattleEncounterCreateOptions {
	name?: string;
	combatantSides?: Record<string, BattleCombatantSide>;
	initiativeOverrides?: Record<string, number | null>;
	initiativeTieBreakerOverrides?: Record<string, number>;
}
