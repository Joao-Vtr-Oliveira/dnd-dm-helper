import type { BattleTracker } from './battleTracker-model';

export type BattleEncounterStatus = 'active' | 'paused' | 'completed';
export type BattleCombatantSide = 'player' | 'ally' | 'enemy' | 'neutral';

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
	durationRounds?: number;
	durationTurns?: number;
	sourceCombatantId?: string;
}

export interface BattleCombatant {
	id: string;
	name: string;
	displayName?: string;
	side: BattleCombatantSide;
	initiative: number;
	initiativeTieBreaker?: number;
	turnOrder: number;
	armorClass?: number;
	maxHp: number;
	currentHp: number;
	temporaryHp: number;
	defeated: boolean;
	hidden: boolean;
	conditions: BattleCondition[];
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
	turnHistory: BattleTurnLogEntry[];
	dmNotes?: string;
}

export interface BattleConditionPreset {
	name: string;
	label: string;
	description?: string;
}
