import type { FiveEToolsMonster } from './fiveetools-homebrew-model';

export type CreatureCategory = 'monster' | 'npc' | 'pc' | 'other';
export type ArmorClass = number | null;
export type CreatureFeatureKind =
	| 'trait'
	| 'action'
	| 'bonus'
	| 'reaction'
	| 'legendary'
	| 'spellcasting'
	| 'note';
export type CreatureAbilityRecoveryType =
	| 'manual'
	| 'turn-cooldown'
	| 'round-cooldown'
	| 'uses-per-day'
	| 'short-rest'
	| 'long-rest'
	| 'dice-recharge';

export interface CreatureSpell {
	id: string;
	name: string;
	source?: string;
	level?: number;
	uses?: number;
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
}

export interface CreatureSpecialAbility {
	id: string;
	name: string;
	description?: string;
	recoveryType: CreatureAbilityRecoveryType;
	maxUses?: number;
	cooldownTurns?: number;
	cooldownRounds?: number;
	rechargeDice?: 'd6';
	rechargeOn?: number[];
}

export interface FiveEToolsIdentity {
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
	rawFiveETools?: FiveEToolsMonster;
	fiveEToolsIdentity?: FiveEToolsIdentity;
}

/** Converts UI/import values into the internal AC contract. */
export function normalizeArmorClass(value: unknown): ArmorClass {
	if (value == null || value === '') return null;
	const numeric = typeof value === 'number' ? value : Number(String(value).trim());
	return Number.isFinite(numeric) ? numeric : null;
}
