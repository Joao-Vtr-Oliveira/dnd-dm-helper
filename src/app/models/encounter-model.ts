import type {
	CreatureCategory,
	CreatureSheet,
} from './creature-sheet-model';
import type {
	BattleCombatantSide,
	BattleLairActionFrequency,
	BattleTrapFrequency,
	BattleTrapTriggerType,
} from './battle-encounter-model';

export interface EncounterLairAction {
	id: string;
	name: string;
	description?: string;
	initiative: number;
	active: boolean;
	frequency: BattleLairActionFrequency;
	cooldownRounds?: number;
}

export interface EncounterTrap {
	id: string;
	name: string;
	description?: string;
	triggerType: BattleTrapTriggerType;
	initiative?: number;
	active: boolean;
	frequency: BattleTrapFrequency;
	cooldownRounds?: number;
}

export interface EncounterParticipant {
	id: string;
	sourceSheetId?: string;
	name: string;
	category: CreatureCategory;
	side?: BattleCombatantSide;
	/** null means this prepared participant has not received an initiative yet. */
	initiative: number | null;
	sheet: CreatureSheet;
	notes?: string;
}

export interface Encounter {
	schemaVersion: 1;
	type: 'dnd-dm-helper-encounter';
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	description?: string;
	tags: string[];
	notes?: string;
	participants: EncounterParticipant[];
	lairActions: EncounterLairAction[];
	traps: EncounterTrap[];
}
