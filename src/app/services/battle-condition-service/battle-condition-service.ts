import { Injectable } from '@angular/core';
import type {
	BattleCombatant,
	BattleCondition,
	BattleConditionDurationType,
	BattleConditionExpirationTiming,
	BattleEncounter,
} from '../../models/battle-encounter-model';

export type CreateBattleConditionInput = {
	name: string;
	label: string;
	description?: string;
	durationType: BattleConditionDurationType;
	durationTurns?: number;
	durationRounds?: number;
	appliedAtCombatantId?: string;
	sourceCombatantId?: string;
	expiresAtRound?: number;
	expiresAtTurnIndex?: number;
	expiresAtTiming?: BattleConditionExpirationTiming;
};

type ExpireConditionsResult = {
	combatants: BattleCombatant[];
	messages: string[];
};

@Injectable({ providedIn: 'root' })
export class BattleConditionService {
	createCondition(
		battle: BattleEncounter,
		input: CreateBattleConditionInput
	): BattleCondition {
		const totalCombatants = Math.max(1, battle.combatants.length);
		const nowPosition = {
			round: battle.round,
			turnIndex: Math.max(0, battle.activeTurnIndex),
		};

		const base: BattleCondition = {
			id: this.createId(),
			name: input.name,
			label: input.label,
			description: input.description,
			appliedAtRound: nowPosition.round,
			appliedAtTurnIndex: nowPosition.turnIndex,
			appliedAtCombatantId: input.appliedAtCombatantId,
			durationType: input.durationType,
			durationTurns: this.toPositiveIntOrUndefined(input.durationTurns),
			durationRounds: this.toPositiveIntOrUndefined(input.durationRounds),
			sourceCombatantId: input.sourceCombatantId,
		};

		if (input.expiresAtRound != null) {
			base.expiresAtRound = input.expiresAtRound;
			base.expiresAtTurnIndex = input.expiresAtTurnIndex ?? 0;
			base.expiresAtTiming = input.expiresAtTiming ?? 'start';
			return base;
		}

		if (input.durationType === 'turns') {
			const target = this.advancePosition(
				nowPosition.round,
				nowPosition.turnIndex,
				Math.max(1, input.durationTurns ?? 1),
				totalCombatants
			);
			base.expiresAtRound = target.round;
			base.expiresAtTurnIndex = target.turnIndex;
			base.expiresAtTiming = 'start';
			return base;
		}

		if (input.durationType === 'rounds') {
			base.expiresAtRound = nowPosition.round + Math.max(1, input.durationRounds ?? 1);
			base.expiresAtTurnIndex = nowPosition.turnIndex;
			base.expiresAtTiming = 'start';
			return base;
		}

		if (input.durationType === 'until-start-of-turn') {
			base.expiresAtRound = nowPosition.round;
			base.expiresAtTurnIndex = nowPosition.turnIndex;
			base.expiresAtTiming = 'start';
			return base;
		}

		if (input.durationType === 'until-end-of-turn') {
			base.expiresAtRound = nowPosition.round;
			base.expiresAtTurnIndex = nowPosition.turnIndex;
			base.expiresAtTiming = 'end';
		}

		return base;
	}

	normalizeCondition(condition: Partial<BattleCondition>): BattleCondition {
		const durationType = this.normalizeDurationType(condition.durationType);
		const normalized: BattleCondition = {
			id: typeof condition.id === 'string' ? condition.id : this.createId(),
			name: typeof condition.name === 'string' ? condition.name : 'custom',
			label: typeof condition.label === 'string' ? condition.label : 'Condicao',
			description: typeof condition.description === 'string' ? condition.description : undefined,
			appliedAtRound: Math.max(1, this.toNonNegativeInt(condition.appliedAtRound) || 1),
			appliedAtTurnIndex: Math.max(0, this.toNonNegativeInt(condition.appliedAtTurnIndex)),
			appliedAtCombatantId:
				typeof condition.appliedAtCombatantId === 'string'
					? condition.appliedAtCombatantId
					: undefined,
			durationType,
			durationTurns: this.toPositiveIntOrUndefined(condition.durationTurns),
			durationRounds: this.toPositiveIntOrUndefined(condition.durationRounds),
			expiresAtRound: this.toPositiveIntOrUndefined(condition.expiresAtRound),
			expiresAtTurnIndex:
				condition.expiresAtTurnIndex == null
					? undefined
					: Math.max(0, this.toNonNegativeInt(condition.expiresAtTurnIndex)),
			expiresAtTiming: this.normalizeTiming(condition.expiresAtTiming),
			sourceCombatantId:
				typeof condition.sourceCombatantId === 'string' ? condition.sourceCombatantId : undefined,
		};

		if (normalized.durationType === 'manual') {
			normalized.durationTurns = undefined;
			normalized.durationRounds = undefined;
		}

		return normalized;
	}

	expireConditionsAtTiming(
		combatants: BattleCombatant[],
		position: { round: number; turnIndex: number },
		timing: BattleConditionExpirationTiming
	): ExpireConditionsResult {
		const messages: string[] = [];

		const nextCombatants = combatants.map((combatant) => {
			const active = combatant.conditions.filter((condition) => {
				const isExpired =
					condition.expiresAtTiming === timing &&
					condition.expiresAtRound === position.round &&
					condition.expiresAtTurnIndex === position.turnIndex;

				if (isExpired) {
					messages.push(`A condicao ${condition.label} expirou em ${combatant.name}.`);
				}

				return !isExpired;
			});

			if (active.length === combatant.conditions.length) return combatant;
			return {
				...combatant,
				conditions: active,
			};
		});

		return { combatants: nextCombatants, messages };
	}

	describeConditionDuration(condition: BattleCondition, battle: BattleEncounter): string {
		if (condition.durationType === 'manual') return 'Sem duração';
		if (
			condition.durationType === 'until-end-of-turn' &&
			condition.expiresAtRound != null &&
			condition.expiresAtTurnIndex != null
		) {
			if (
				condition.expiresAtRound === battle.round &&
				condition.expiresAtTurnIndex === battle.activeTurnIndex
			) {
				return 'Expira no fim do turno atual';
			}
			return 'Expira no fim do turno marcado';
		}
		if (
			condition.durationType === 'until-start-of-turn' &&
			condition.expiresAtRound != null &&
			condition.expiresAtTurnIndex != null
		) {
			if (
				condition.expiresAtRound === battle.round &&
				condition.expiresAtTurnIndex === battle.activeTurnIndex
			) {
				return 'Expira no início do turno atual';
			}
			return 'Expira no início do turno marcado';
		}

		if (
			condition.durationType === 'turns' &&
			condition.expiresAtRound != null &&
			condition.expiresAtTurnIndex != null
		) {
			const remaining = this.getRemainingTurns(condition, battle);
			if (remaining <= 1) return 'Resta 1 turno';
			return `Restam ${remaining} turnos`;
		}

		if (
			condition.durationType === 'rounds' &&
			condition.expiresAtRound != null &&
			condition.expiresAtTurnIndex != null
		) {
			const remaining = Math.max(0, condition.expiresAtRound - battle.round);
			if (remaining <= 0) return 'Expira neste round';
			if (remaining === 1) return 'Resta 1 round';
			return `Restam ${remaining} rounds`;
		}

		return 'Sem duração';
	}

	getRemainingTurns(condition: BattleCondition, battle: BattleEncounter): number {
		if (condition.expiresAtRound == null || condition.expiresAtTurnIndex == null) return 0;
		return Math.max(
			0,
			this.turnDistance(
				battle.round,
				Math.max(0, battle.activeTurnIndex),
				condition.expiresAtRound,
				condition.expiresAtTurnIndex,
				Math.max(1, battle.combatants.length)
			)
		);
	}

	advancePosition(round: number, turnIndex: number, steps: number, totalCombatants: number) {
		const normalizedSteps = Math.max(0, steps);
		const total = Math.max(1, totalCombatants);
		const absoluteIndex = (round - 1) * total + turnIndex + normalizedSteps;

		return {
			round: Math.floor(absoluteIndex / total) + 1,
			turnIndex: absoluteIndex % total,
		};
	}

	private turnDistance(
		fromRound: number,
		fromTurnIndex: number,
		toRound: number,
		toTurnIndex: number,
		totalCombatants: number
	): number {
		const total = Math.max(1, totalCombatants);
		return (toRound - fromRound) * total + (toTurnIndex - fromTurnIndex);
	}

	private normalizeDurationType(value: unknown): BattleConditionDurationType {
		if (
			value === 'manual' ||
			value === 'turns' ||
			value === 'rounds' ||
			value === 'until-start-of-turn' ||
			value === 'until-end-of-turn'
		) {
			return value;
		}

		return 'manual';
	}

	private normalizeTiming(value: unknown): BattleConditionExpirationTiming | undefined {
		if (value === 'start' || value === 'end') return value;
		return undefined;
	}

	private toNonNegativeInt(value: unknown): number {
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) return 0;
		return Math.max(0, Math.floor(numeric));
	}

	private toPositiveIntOrUndefined(value: unknown): number | undefined {
		const numeric = this.toNonNegativeInt(value);
		return numeric > 0 ? numeric : undefined;
	}

	private createId(): string {
		return globalThis.crypto?.randomUUID?.() ?? `cond-${Math.random().toString(36).slice(2, 10)}`;
	}
}
