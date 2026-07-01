import { Injectable } from '@angular/core';
import type {
	BattleCombatant,
	BattleEncounter,
	BattleSpecialAbility,
} from '../../models/battle-encounter-model';

export type CreateBattleAbilityInput = {
	name: string;
	description?: string;
	rechargeType: BattleSpecialAbility['rechargeType'];
	cooldownTurns?: number;
	cooldownRounds?: number;
	rechargeDice?: string;
	rechargeOn?: number[];
};

type CooldownAdvanceResult = {
	combatants: BattleCombatant[];
	messages: string[];
};

@Injectable({ providedIn: 'root' })
export class BattleAbilityService {
	createAbility(input: CreateBattleAbilityInput): BattleSpecialAbility {
		return {
			id: this.createId(),
			name: input.name.trim() || 'Habilidade especial',
			description: (input.description || '').trim() || undefined,
			rechargeType: this.normalizeRechargeType(input.rechargeType),
			cooldownTurns: this.toPositiveIntOrUndefined(input.cooldownTurns),
			cooldownRounds: this.toPositiveIntOrUndefined(input.cooldownRounds),
			currentCooldownTurns: 0,
			currentCooldownRounds: 0,
			rechargeDice: input.rechargeDice || undefined,
			rechargeOn: this.normalizeRechargeOn(input.rechargeOn),
			isAvailable: true,
		};
	}

	normalizeAbility(ability: Partial<BattleSpecialAbility>): BattleSpecialAbility {
		const rechargeType = this.normalizeRechargeType(ability.rechargeType);

		return {
			id: typeof ability.id === 'string' ? ability.id : this.createId(),
			name: typeof ability.name === 'string' ? ability.name : 'Habilidade especial',
			description: typeof ability.description === 'string' ? ability.description : undefined,
			rechargeType,
			cooldownTurns: this.toPositiveIntOrUndefined(ability.cooldownTurns),
			cooldownRounds: this.toPositiveIntOrUndefined(ability.cooldownRounds),
			currentCooldownTurns: this.toNonNegativeInt(ability.currentCooldownTurns),
			currentCooldownRounds: this.toNonNegativeInt(ability.currentCooldownRounds),
			rechargeDice:
				typeof ability.rechargeDice === 'string' ? ability.rechargeDice : rechargeType === 'dice' ? 'd6' : undefined,
			rechargeOn: this.normalizeRechargeOn(ability.rechargeOn),
			isAvailable: ability.isAvailable !== false,
			lastUsedAtRound: this.toPositiveIntOrUndefined(ability.lastUsedAtRound),
			lastUsedAtTurnIndex:
				ability.lastUsedAtTurnIndex == null
					? undefined
					: Math.max(0, this.toNonNegativeInt(ability.lastUsedAtTurnIndex)),
		};
	}

	useAbility(
		ability: BattleSpecialAbility,
		battle: BattleEncounter
	): BattleSpecialAbility {
		if (ability.rechargeType === 'turns') {
			return {
				...ability,
				isAvailable: false,
				currentCooldownTurns: Math.max(1, ability.cooldownTurns ?? 1),
				currentCooldownRounds: 0,
				lastUsedAtRound: battle.round,
				lastUsedAtTurnIndex: battle.activeTurnIndex,
			};
		}

		if (ability.rechargeType === 'rounds') {
			return {
				...ability,
				isAvailable: false,
				currentCooldownTurns: 0,
				currentCooldownRounds: Math.max(1, ability.cooldownRounds ?? 1),
				lastUsedAtRound: battle.round,
				lastUsedAtTurnIndex: battle.activeTurnIndex,
			};
		}

		if (ability.rechargeType === 'dice') {
			return {
				...ability,
				isAvailable: false,
				lastUsedAtRound: battle.round,
				lastUsedAtTurnIndex: battle.activeTurnIndex,
			};
		}

		return {
			...ability,
			isAvailable: false,
			lastUsedAtRound: battle.round,
			lastUsedAtTurnIndex: battle.activeTurnIndex,
		};
	}

	resetAbility(ability: BattleSpecialAbility): BattleSpecialAbility {
		return {
			...ability,
			isAvailable: true,
			currentCooldownTurns: 0,
			currentCooldownRounds: 0,
		};
	}

	advanceCooldowns(
		combatants: BattleCombatant[],
		roundAdvanced: boolean
	): CooldownAdvanceResult {
		const messages: string[] = [];

		const nextCombatants = combatants.map((combatant) => {
			let changed = false;
			const specialAbilities = combatant.specialAbilities.map((ability) => {
				let nextAbility = ability;

				if (!ability.isAvailable && ability.rechargeType === 'turns' && (ability.currentCooldownTurns ?? 0) > 0) {
					const remaining = Math.max(0, (ability.currentCooldownTurns ?? 0) - 1);
					nextAbility = {
						...nextAbility,
						currentCooldownTurns: remaining,
						isAvailable: remaining === 0,
					};
					changed = true;
				}

				if (
					!nextAbility.isAvailable &&
					nextAbility.rechargeType === 'rounds' &&
					roundAdvanced &&
					(nextAbility.currentCooldownRounds ?? 0) > 0
				) {
					const remaining = Math.max(0, (nextAbility.currentCooldownRounds ?? 0) - 1);
					nextAbility = {
						...nextAbility,
						currentCooldownRounds: remaining,
						isAvailable: remaining === 0,
					};
					changed = true;
				}

				if (!ability.isAvailable && nextAbility.isAvailable) {
					messages.push(`${nextAbility.name} está disponível novamente para ${combatant.name}.`);
				}

				return nextAbility;
			});

			if (!changed) return combatant;
			return { ...combatant, specialAbilities };
		});

		return { combatants: nextCombatants, messages };
	}

	rollRecharge(ability: BattleSpecialAbility): { ability: BattleSpecialAbility; roll: number; success: boolean } {
		const roll = this.rollDie(6);
		const targets = ability.rechargeOn?.length ? ability.rechargeOn : [5, 6];
		const success = targets.includes(roll);

		return {
			roll,
			success,
			ability: success ? this.resetAbility(ability) : ability,
		};
	}

	describeAbility(ability: BattleSpecialAbility): string {
		if (ability.isAvailable) return 'Disponível';
		if (ability.rechargeType === 'turns') {
			const remaining = Math.max(0, ability.currentCooldownTurns ?? 0);
			return remaining === 1 ? 'Volta em 1 turno' : `Volta em ${remaining} turnos`;
		}
		if (ability.rechargeType === 'rounds') {
			const remaining = Math.max(0, ability.currentCooldownRounds ?? 0);
			return remaining === 1 ? 'Volta em 1 round' : `Volta em ${remaining} rounds`;
		}
		if (ability.rechargeType === 'dice') {
			const targets = (ability.rechargeOn?.length ? ability.rechargeOn : [5, 6]).join('–');
			return `Recharge ${targets} — role no início do turno`;
		}
		return 'Recarga manual';
	}

	private normalizeRechargeType(value: unknown): BattleSpecialAbility['rechargeType'] {
		if (value === 'manual' || value === 'turns' || value === 'rounds' || value === 'dice') {
			return value;
		}
		return 'manual';
	}

	private normalizeRechargeOn(value: unknown): number[] | undefined {
		if (!Array.isArray(value)) return undefined;
		const normalized = value
			.map((item) => this.toNonNegativeInt(item))
			.filter((item) => item >= 1 && item <= 20);
		return normalized.length ? normalized : undefined;
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

	private rollDie(sides: number): number {
		return Math.floor(Math.random() * sides) + 1;
	}

	private createId(): string {
		return globalThis.crypto?.randomUUID?.() ?? `ability-${Math.random().toString(36).slice(2, 10)}`;
	}
}
