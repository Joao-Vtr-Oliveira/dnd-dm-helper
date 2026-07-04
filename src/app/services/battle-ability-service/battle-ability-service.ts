import { Injectable } from '@angular/core';
import type {
	BattleAbilityRechargeType,
	BattleAbilityRecoveryType,
	BattleCombatant,
	BattleEncounter,
	BattleSpecialAbility,
} from '../../models/battle-encounter-model';

export type CreateBattleAbilityInput = {
	name: string;
	description?: string;
	recoveryType: BattleSpecialAbility['recoveryType'];
	maxUses?: number;
	cooldownTurns?: number;
	cooldownRounds?: number;
	rechargeDice?: 'd6';
	rechargeOn?: number[];
};

type CooldownAdvanceResult = {
	combatants: BattleCombatant[];
	messages: string[];
};

@Injectable({ providedIn: 'root' })
export class BattleAbilityService {
	createAbility(input: CreateBattleAbilityInput): BattleSpecialAbility {
		const recoveryType = this.normalizeRecoveryType(input.recoveryType);
		const maxUses = this.normalizeMaxUses(recoveryType, input.maxUses);

		return {
			id: this.createId(),
			name: input.name.trim() || 'Habilidade especial',
			description: (input.description || '').trim() || undefined,
			recoveryType,
			rechargeType: this.toLegacyRechargeType(recoveryType),
			maxUses,
			usedCount: 0,
			cooldownTurns: this.toPositiveIntOrUndefined(input.cooldownTurns),
			cooldownRounds: this.toPositiveIntOrUndefined(input.cooldownRounds),
			currentCooldownTurns: 0,
			currentCooldownRounds: 0,
			rechargeDice: recoveryType === 'dice-recharge' ? input.rechargeDice ?? 'd6' : undefined,
			rechargeOn: this.normalizeRechargeOn(input.rechargeOn),
			isAvailable: true,
		};
	}

	normalizeAbility(ability: Partial<BattleSpecialAbility>): BattleSpecialAbility {
		const recoveryType = this.normalizeRecoveryType(
			ability.recoveryType,
			ability.rechargeType,
		);
		const maxUses = this.normalizeMaxUses(recoveryType, ability.maxUses);
		const usedCount = this.normalizeUsedCount(ability.usedCount, maxUses);
		const currentCooldownTurns = this.toNonNegativeInt(ability.currentCooldownTurns);
		const currentCooldownRounds = this.toNonNegativeInt(ability.currentCooldownRounds);

		return {
			id: typeof ability.id === 'string' ? ability.id : this.createId(),
			name: typeof ability.name === 'string' ? ability.name : 'Habilidade especial',
			description: typeof ability.description === 'string' ? ability.description : undefined,
			recoveryType,
			rechargeType: this.toLegacyRechargeType(recoveryType),
			maxUses,
			usedCount,
			cooldownTurns: this.toPositiveIntOrUndefined(ability.cooldownTurns),
			cooldownRounds: this.toPositiveIntOrUndefined(ability.cooldownRounds),
			currentCooldownTurns,
			currentCooldownRounds,
			rechargeDice: recoveryType === 'dice-recharge' ? 'd6' : undefined,
			rechargeOn: this.normalizeRechargeOn(ability.rechargeOn),
			isAvailable: this.normalizeAvailability(
				recoveryType,
				ability.isAvailable,
				usedCount,
				maxUses,
				currentCooldownTurns,
				currentCooldownRounds,
			),
			lastUsedAtRound: this.toPositiveIntOrUndefined(ability.lastUsedAtRound),
			lastUsedAtTurnIndex:
				ability.lastUsedAtTurnIndex == null
					? undefined
					: Math.max(0, this.toNonNegativeInt(ability.lastUsedAtTurnIndex)),
			lastUsedAt: typeof ability.lastUsedAt === 'string' ? ability.lastUsedAt : undefined,
			lastRechargeRoll: this.toPositiveIntOrUndefined(ability.lastRechargeRoll),
		};
	}

	useAbility(ability: BattleSpecialAbility, battle: BattleEncounter): BattleSpecialAbility {
		const normalized = this.normalizeAbility(ability);
		if (!normalized.isAvailable && normalized.recoveryType !== 'manual') return normalized;

		const base = {
			...normalized,
			lastUsedAtRound: battle.round,
			lastUsedAtTurnIndex: battle.activeTurnIndex,
			lastUsedAt: new Date().toISOString(),
		};

		if (normalized.recoveryType === 'turn-cooldown') {
			return {
				...base,
				isAvailable: false,
				currentCooldownTurns: Math.max(1, normalized.cooldownTurns ?? 1),
				currentCooldownRounds: 0,
			};
		}

		if (normalized.recoveryType === 'round-cooldown') {
			return {
				...base,
				isAvailable: false,
				currentCooldownTurns: 0,
				currentCooldownRounds: Math.max(1, normalized.cooldownRounds ?? 1),
			};
		}

		if (
			normalized.recoveryType === 'uses-per-day' ||
			normalized.recoveryType === 'short-rest' ||
			normalized.recoveryType === 'long-rest'
		) {
			const maxUses = this.normalizeMaxUses(normalized.recoveryType, normalized.maxUses) ?? 1;
			const usedCount = Math.min(maxUses, (normalized.usedCount ?? 0) + 1);
			return {
				...base,
				maxUses,
				usedCount,
				isAvailable: usedCount < maxUses,
			};
		}

		if (normalized.recoveryType === 'dice-recharge') {
			return {
				...base,
				isAvailable: false,
			};
		}

		return {
			...base,
			isAvailable: false,
		};
	}

	resetAbility(ability: BattleSpecialAbility): BattleSpecialAbility {
		const normalized = this.normalizeAbility(ability);
		return {
			...normalized,
			isAvailable: true,
			usedCount: this.usesRecovery(normalized.recoveryType) ? 0 : normalized.usedCount,
			currentCooldownTurns: 0,
			currentCooldownRounds: 0,
		};
	}

	advanceCooldowns(combatants: BattleCombatant[], roundAdvanced: boolean): CooldownAdvanceResult {
		const messages: string[] = [];

		const nextCombatants = combatants.map((combatant) => {
			let changed = false;
			const specialAbilities = combatant.specialAbilities.map((ability) => {
				const normalized = this.normalizeAbility(ability);
				let nextAbility = normalized;

				if (
					normalized.recoveryType === 'turn-cooldown' &&
					!normalized.isAvailable &&
					(normalized.currentCooldownTurns ?? 0) > 0
				) {
					const remaining = Math.max(0, (normalized.currentCooldownTurns ?? 0) - 1);
					nextAbility = {
						...normalized,
						currentCooldownTurns: remaining,
						isAvailable: remaining === 0,
					};
					changed = true;
				}

				if (
					normalized.recoveryType === 'round-cooldown' &&
					!normalized.isAvailable &&
					roundAdvanced &&
					(normalized.currentCooldownRounds ?? 0) > 0
				) {
					const remaining = Math.max(0, (normalized.currentCooldownRounds ?? 0) - 1);
					nextAbility = {
						...normalized,
						currentCooldownRounds: remaining,
						isAvailable: remaining === 0,
					};
					changed = true;
				}

				if (!normalized.isAvailable && nextAbility.isAvailable) {
					messages.push(
						`Habilidade disponível novamente: ${nextAbility.name} (${combatant.displayName?.trim() || combatant.name}).`,
					);
				}

				return nextAbility;
			});

			if (!changed) return combatant;
			return { ...combatant, specialAbilities };
		});

		return { combatants: nextCombatants, messages };
	}

	rollRecharge(ability: BattleSpecialAbility): {
		ability: BattleSpecialAbility;
		roll: number;
		success: boolean;
	} {
		const normalized = this.normalizeAbility(ability);
		const roll = this.rollDie(6);
		const targets = normalized.rechargeOn?.length ? normalized.rechargeOn : [5, 6];
		const success = normalized.recoveryType === 'dice-recharge' && targets.includes(roll);
		const nextAbility = success ? this.resetAbility(normalized) : normalized;

		return {
			roll,
			success,
			ability: {
				...nextAbility,
				lastRechargeRoll: roll,
			},
		};
	}

	describeAbilityStatus(ability: BattleSpecialAbility): string {
		const normalized = this.normalizeAbility(ability);
		if (normalized.isAvailable) return 'Disponível';
		if (
			normalized.recoveryType === 'turn-cooldown' ||
			normalized.recoveryType === 'round-cooldown'
		) {
			return 'Em cooldown';
		}
		if (normalized.recoveryType === 'uses-per-day') return 'Esgotada';
		if (normalized.recoveryType === 'short-rest' || normalized.recoveryType === 'long-rest') {
			return 'Usada';
		}
		if (normalized.recoveryType === 'dice-recharge') return 'Indisponível';
		return 'Usada';
	}

	describeAbilityUsage(ability: BattleSpecialAbility): string | null {
		const normalized = this.normalizeAbility(ability);
		if (!this.usesRecovery(normalized.recoveryType)) return null;

		const maxUses = this.normalizeMaxUses(normalized.recoveryType, normalized.maxUses) ?? 1;
		const usedCount = Math.min(maxUses, normalized.usedCount ?? 0);
		const label = normalized.recoveryType === 'uses-per-day' ? 'Usos por dia' : 'Usos';
		return `${label}: ${usedCount}/${maxUses}`;
	}

	describeAbilityRecovery(ability: BattleSpecialAbility): string {
		const normalized = this.normalizeAbility(ability);
		if (normalized.recoveryType === 'turn-cooldown') {
			const remaining = Math.max(0, normalized.currentCooldownTurns ?? 0);
			if (remaining === 0) return 'Disponível novamente';
			return remaining === 1 ? 'Volta em 1 turno' : `Volta em ${remaining} turnos`;
		}
		if (normalized.recoveryType === 'round-cooldown') {
			const remaining = Math.max(0, normalized.currentCooldownRounds ?? 0);
			if (remaining === 0) return 'Disponível novamente';
			return remaining === 1 ? 'Volta em 1 round' : `Volta em ${remaining} rounds`;
		}
		if (normalized.recoveryType === 'uses-per-day') {
			return normalized.isAvailable ? 'Recupera no próximo dia' : 'Esgotado até o próximo dia';
		}
		if (normalized.recoveryType === 'short-rest') return 'Recupera no descanso curto';
		if (normalized.recoveryType === 'long-rest') return 'Recupera no descanso longo';
		if (normalized.recoveryType === 'dice-recharge') {
			const targets = (normalized.rechargeOn?.length ? normalized.rechargeOn : [5, 6]).join('–');
			return normalized.isAvailable
				? `Recharge ${targets}`
				: `Recharge ${targets} - role recharge para recuperar`;
		}
		return normalized.isAvailable ? 'Controle manual' : 'Marque como disponível manualmente';
	}

	describeAbilityRule(ability: BattleSpecialAbility): string | null {
		const normalized = this.normalizeAbility(ability);
		if (normalized.recoveryType === 'turn-cooldown' && normalized.cooldownTurns) {
			return normalized.cooldownTurns === 1
				? 'Cooldown de 1 turno'
				: `Cooldown de ${normalized.cooldownTurns} turnos`;
		}
		if (normalized.recoveryType === 'round-cooldown' && normalized.cooldownRounds) {
			return normalized.cooldownRounds === 1
				? 'Cooldown de 1 round'
				: `Cooldown de ${normalized.cooldownRounds} rounds`;
		}
		if (normalized.recoveryType === 'uses-per-day' && normalized.maxUses) {
			return normalized.maxUses === 1 ? '1 por dia' : `${normalized.maxUses} por dia`;
		}
		if (normalized.recoveryType === 'dice-recharge') {
			const targets = (normalized.rechargeOn?.length ? normalized.rechargeOn : [5, 6]).join('–');
			return `Recharge ${targets}`;
		}
		return null;
	}

	describeAbilityLastUsed(ability: BattleSpecialAbility): string | null {
		const normalized = this.normalizeAbility(ability);
		if (normalized.lastUsedAtRound == null) return null;
		if (normalized.lastUsedAtTurnIndex == null) {
			return `Usada no round ${normalized.lastUsedAtRound}`;
		}
		return `Usada no round ${normalized.lastUsedAtRound}, turno ${normalized.lastUsedAtTurnIndex + 1}`;
	}

	private normalizeRecoveryType(
		recoveryType: unknown,
		legacyRechargeType?: unknown,
	): BattleAbilityRecoveryType {
		if (
			recoveryType === 'manual' ||
			recoveryType === 'turn-cooldown' ||
			recoveryType === 'round-cooldown' ||
			recoveryType === 'uses-per-day' ||
			recoveryType === 'short-rest' ||
			recoveryType === 'long-rest' ||
			recoveryType === 'dice-recharge'
		) {
			return recoveryType;
		}

		if (legacyRechargeType === 'turns') return 'turn-cooldown';
		if (legacyRechargeType === 'rounds') return 'round-cooldown';
		if (legacyRechargeType === 'dice') return 'dice-recharge';
		return 'manual';
	}

	private toLegacyRechargeType(
		recoveryType: BattleAbilityRecoveryType,
	): BattleAbilityRechargeType {
		if (recoveryType === 'turn-cooldown') return 'turns';
		if (recoveryType === 'round-cooldown') return 'rounds';
		if (recoveryType === 'dice-recharge') return 'dice';
		return 'manual';
	}

	private normalizeAvailability(
		recoveryType: BattleAbilityRecoveryType,
		isAvailable: unknown,
		usedCount: number,
		maxUses: number | undefined,
		currentCooldownTurns: number,
		currentCooldownRounds: number,
	): boolean {
		if (recoveryType === 'turn-cooldown') return currentCooldownTurns <= 0 && isAvailable !== false;
		if (recoveryType === 'round-cooldown') return currentCooldownRounds <= 0 && isAvailable !== false;
		if (this.usesRecovery(recoveryType)) return usedCount < (maxUses ?? 1);
		return isAvailable !== false;
	}

	private usesRecovery(recoveryType: BattleAbilityRecoveryType): boolean {
		return (
			recoveryType === 'uses-per-day' ||
			recoveryType === 'short-rest' ||
			recoveryType === 'long-rest'
		);
	}

	private normalizeMaxUses(
		recoveryType: BattleAbilityRecoveryType,
		value: unknown,
	): number | undefined {
		const numeric = this.toPositiveIntOrUndefined(value);
		if (this.usesRecovery(recoveryType)) return numeric ?? 1;
		return numeric;
	}

	private normalizeUsedCount(value: unknown, maxUses?: number): number {
		const numeric = this.toNonNegativeInt(value);
		if (maxUses == null) return numeric;
		return Math.min(maxUses, numeric);
	}

	private normalizeRechargeOn(value: unknown): number[] | undefined {
		if (!Array.isArray(value)) return undefined;
		const normalized = value
			.map((item) => this.toNonNegativeInt(item))
			.filter((item) => item >= 1 && item <= 6);
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
