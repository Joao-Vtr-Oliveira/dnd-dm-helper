import { Injectable, inject } from '@angular/core';
import type {
	BattleCombatant,
	BattleCondition,
	BattleEncounter,
	BattleLairAction,
	BattleSpecialAbility,
	BattleTrap,
	BattleUpcomingEvent,
} from '../../models/battle-encounter-model';
import { BattleEncounterService } from '../battle-encounter-service/battle-encounter-service';

type TurnSlot = {
	combatant: BattleCombatant;
	round: number;
	turnIndex: number;
	turnNumber: number;
	label: 'Agora' | 'Depois';
	priority: number;
	sortOrder: number;
};

type RoundState = {
	round: number;
	combatants: BattleCombatant[];
	joinedCombatants: BattleCombatant[];
	firstEligibleTurnIndex: number;
};

type UpcomingEventCandidate = BattleUpcomingEvent & {
	sortOrder: number;
};

@Injectable({ providedIn: 'root' })
export class BattleUpcomingEventsService {
	private readonly battleService = inject(BattleEncounterService);

	buildUpcomingBattleEvents(battle: BattleEncounter, limit = 8): BattleUpcomingEvent[] {
		const horizonTurns = Math.max(limit + 4, 10);
		const horizonRounds = Math.max(3, Math.ceil(horizonTurns / Math.max(1, battle.combatants.length)) + 1);
		const roundStates = this.buildRoundStates(battle, horizonRounds);
		const turnSlots = this.buildTurnSlots(battle, roundStates, horizonTurns);
		const currentCombatant = this.battleService.getCurrentCombatant(battle);
		const currentInitiative = currentCombatant?.initiative ?? null;
		const firstTurnByRound = new Map<number, TurnSlot>();

		for (const slot of turnSlots) {
			if (!firstTurnByRound.has(slot.round)) firstTurnByRound.set(slot.round, slot);
		}

		const events: UpcomingEventCandidate[] = [
			...this.buildTurnEvents(turnSlots),
			...this.buildRoundStartEvents(battle, roundStates, firstTurnByRound),
			...this.buildPendingCombatantEvents(roundStates, firstTurnByRound),
			...this.buildConditionEvents(battle, turnSlots, firstTurnByRound),
			...this.buildAbilityRechargeEvents(battle, turnSlots, firstTurnByRound),
			...this.buildLairActionEvents(battle, roundStates, firstTurnByRound, currentInitiative),
			...this.buildTrapEvents(battle, roundStates, firstTurnByRound, currentInitiative),
		];

		return events
			.sort((left, right) => {
				if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
				if (left.round !== right.round) return left.round - right.round;
				return left.priority - right.priority;
			})
			.slice(0, limit)
			.map(({ sortOrder, ...event }) => event);
	}

	private buildTurnEvents(turnSlots: TurnSlot[]): UpcomingEventCandidate[] {
		return turnSlots.map((slot) => ({
			id: `turn-${slot.round}-${slot.turnIndex}-${slot.combatant.id}`,
			type: 'turn',
			label: `${slot.label}: ${slot.combatant.displayName?.trim() || slot.combatant.name}`,
			round: slot.round,
			turnIndex: slot.turnIndex,
			combatantId: slot.combatant.id,
			priority: slot.priority,
			actorType: 'combatant',
			sortOrder: slot.sortOrder,
		}));
	}

	private buildRoundStartEvents(
		battle: BattleEncounter,
		roundStates: RoundState[],
		firstTurnByRound: Map<number, TurnSlot>,
	): UpcomingEventCandidate[] {
		return roundStates
			.filter((state) => state.round > battle.round)
			.map((state) => ({
				id: `round-start-${state.round}`,
				type: 'round-start' as const,
				label: `Início do round ${state.round}`,
				round: state.round,
				turnIndex: state.firstEligibleTurnIndex >= 0 ? state.firstEligibleTurnIndex : undefined,
				priority: 20,
				actorType: 'environment' as const,
				sortOrder: (firstTurnByRound.get(state.round)?.sortOrder ?? state.round * 100) - 2,
			}));
	}

	private buildPendingCombatantEvents(
		roundStates: RoundState[],
		firstTurnByRound: Map<number, TurnSlot>,
	): UpcomingEventCandidate[] {
		return roundStates
			.filter((state) => state.joinedCombatants.length > 0)
			.map((state) => {
				const names = state.joinedCombatants.map(
					(combatant) => combatant.displayName?.trim() || combatant.name,
				);
				const joinedLabel =
					names.length === 1 ? `${names[0]} entra na iniciativa` : `${names.join(', ')} entram na iniciativa`;

				return {
					id: `pending-${state.round}-${names.join('-')}`,
					type: 'pending-combatant' as const,
					label: `Início do próximo round: ${joinedLabel}`,
					round: state.round,
					turnIndex: state.firstEligibleTurnIndex >= 0 ? state.firstEligibleTurnIndex : undefined,
					priority: 15,
					actorType: 'combatant' as const,
					sortOrder: (firstTurnByRound.get(state.round)?.sortOrder ?? state.round * 100) - 1,
				};
			});
	}

	private buildConditionEvents(
		battle: BattleEncounter,
		turnSlots: TurnSlot[],
		firstTurnByRound: Map<number, TurnSlot>,
	): UpcomingEventCandidate[] {
		const events: UpcomingEventCandidate[] = [];
		const slotsByKey = new Map(turnSlots.map((slot) => [`${slot.round}:${slot.turnIndex}`, slot]));

		for (const combatant of battle.combatants) {
			for (const condition of combatant.conditions) {
				const event = this.buildConditionEvent(
					battle,
					combatant,
					condition,
					slotsByKey,
					firstTurnByRound,
				);
				if (event) events.push(event);
			}
		}

		return events;
	}

	private buildConditionEvent(
		battle: BattleEncounter,
		combatant: BattleCombatant,
		condition: BattleCondition,
		slotsByKey: Map<string, TurnSlot>,
		firstTurnByRound: Map<number, TurnSlot>,
	): UpcomingEventCandidate | null {
		if (condition.expiresAtRound == null || condition.expiresAtTurnIndex == null) return null;

		const slot = slotsByKey.get(`${condition.expiresAtRound}:${condition.expiresAtTurnIndex}`);
		if (!slot) return null;

		const prefix = this.describeTurnRelativePrefix(battle, slot, condition.expiresAtTiming);
		const name = combatant.displayName?.trim() || combatant.name;
		return {
			id: `condition-${combatant.id}-${condition.id}`,
			type: 'condition-expire',
			label: `${prefix}: ${condition.label} expira em ${name}`,
			round: slot.round,
			turnIndex: slot.turnIndex,
			combatantId: combatant.id,
			priority: 30,
			actorType: 'combatant',
			sortOrder:
				(slot.sortOrder ?? firstTurnByRound.get(slot.round)?.sortOrder ?? slot.round * 100) +
				(condition.expiresAtTiming === 'end' ? 1 : 0),
		};
	}

	private buildAbilityRechargeEvents(
		battle: BattleEncounter,
		turnSlots: TurnSlot[],
		firstTurnByRound: Map<number, TurnSlot>,
	): UpcomingEventCandidate[] {
		const events: UpcomingEventCandidate[] = [];
		const turnSlotByNumber = new Map(turnSlots.map((slot) => [slot.turnNumber, slot]));

		for (const combatant of battle.combatants) {
			for (const ability of combatant.specialAbilities) {
				const event = this.buildAbilityRechargeEvent(
					battle,
					combatant,
					ability,
					turnSlotByNumber,
					firstTurnByRound,
				);
				if (event) events.push(event);
			}
		}

		return events;
	}

	private buildAbilityRechargeEvent(
		battle: BattleEncounter,
		combatant: BattleCombatant,
		ability: BattleSpecialAbility,
		turnSlotByNumber: Map<number, TurnSlot>,
		firstTurnByRound: Map<number, TurnSlot>,
	): UpcomingEventCandidate | null {
		if (ability.isAvailable) return null;
		const name = combatant.displayName?.trim() || combatant.name;

		if (ability.recoveryType === 'turn-cooldown' && (ability.currentCooldownTurns ?? 0) > 0) {
			const slot = turnSlotByNumber.get(Math.max(1, ability.currentCooldownTurns ?? 1));
			if (!slot) return null;
			const prefix =
				slot.turnNumber === 1 ? 'No próximo turno' : `Em ${slot.turnNumber} turnos`;
			return {
				id: `ability-turn-${combatant.id}-${ability.id}`,
				type: 'ability-recharge',
				label: `${prefix}: ${ability.name} disponível novamente para ${name}`,
				round: slot.round,
				turnIndex: slot.turnIndex,
				combatantId: combatant.id,
				priority: 35,
				actorType: 'combatant',
				sortOrder: slot.sortOrder + 1,
			};
		}

		if (ability.recoveryType === 'round-cooldown' && (ability.currentCooldownRounds ?? 0) > 0) {
			const targetRound = battle.round + Math.max(1, ability.currentCooldownRounds ?? 1);
			const slot = firstTurnByRound.get(targetRound);
			if (!slot) return null;
			const prefix = targetRound === battle.round + 1 ? 'No próximo round' : `Início do round ${targetRound}`;
			return {
				id: `ability-round-${combatant.id}-${ability.id}`,
				type: 'ability-recharge',
				label: `${prefix}: ${ability.name} disponível novamente para ${name}`,
				round: targetRound,
				turnIndex: slot.turnIndex,
				combatantId: combatant.id,
				priority: 35,
				actorType: 'combatant',
				sortOrder: slot.sortOrder - 1,
			};
		}

		return null;
	}

	private buildLairActionEvents(
		battle: BattleEncounter,
		roundStates: RoundState[],
		firstTurnByRound: Map<number, TurnSlot>,
		currentInitiative: number | null,
	): UpcomingEventCandidate[] {
		const events: UpcomingEventCandidate[] = [];

		for (const action of battle.lairActions ?? []) {
			const targetRound = this.getNextLairActionRound(battle, action, currentInitiative);
			if (targetRound == null) continue;
			if (!roundStates.some((state) => state.round === targetRound)) continue;

			events.push({
				id: `lair-${action.id}-${targetRound}`,
				type: 'lair-action',
				label: `Round ${targetRound} / iniciativa ${action.initiative}: ${action.name}`,
				round: targetRound,
				priority: 45,
				actorType: 'lair-action',
				sortOrder: (firstTurnByRound.get(targetRound)?.sortOrder ?? targetRound * 100) - 1,
			});
		}

		return events;
	}

	private buildTrapEvents(
		battle: BattleEncounter,
		roundStates: RoundState[],
		firstTurnByRound: Map<number, TurnSlot>,
		currentInitiative: number | null,
	): UpcomingEventCandidate[] {
		const events: UpcomingEventCandidate[] = [];

		for (const trap of battle.traps ?? []) {
			const targetRound = this.getNextTrapRound(battle, trap, currentInitiative);
			if (targetRound == null) continue;
			if (!roundStates.some((state) => state.round === targetRound)) continue;

			let label = `Round ${targetRound}: ${trap.name}`;
			if (trap.triggerType === 'initiative' && trap.initiative != null) {
				label = `Round ${targetRound} / iniciativa ${trap.initiative}: ${trap.name}`;
			}
			if (trap.triggerType === 'round-start') label = `Início do round ${targetRound}: ${trap.name}`;
			if (trap.triggerType === 'round-end') label = `Fim do round ${targetRound}: ${trap.name}`;

			events.push({
				id: `trap-${trap.id}-${targetRound}`,
				type: 'trap',
				label,
				round: targetRound,
				priority: 50,
				actorType: 'trap',
				sortOrder:
					(firstTurnByRound.get(targetRound)?.sortOrder ?? targetRound * 100) +
					(trap.triggerType === 'round-end' ? 2 : -1),
			});
		}

		return events;
	}

	private buildRoundStates(battle: BattleEncounter, horizonRounds: number): RoundState[] {
		const states: RoundState[] = [];
		let combatants = battle.combatants.map((combatant) => structuredClone(combatant));
		let pendingCombatants = battle.pendingCombatants.map((combatant) => structuredClone(combatant));

		for (let offset = 0; offset < horizonRounds; offset += 1) {
			const round = battle.round + offset;
			if (offset > 0) {
				const next = this.resolveRoundStartPreview(round, combatants, pendingCombatants);
				combatants = next.combatants;
				pendingCombatants = [];
				states.push(next);
				continue;
			}

			states.push({
				round,
				combatants,
				joinedCombatants: [],
				firstEligibleTurnIndex: this.findFirstEligibleTurnIndex(combatants, round),
			});
		}

		return states;
	}

	private buildTurnSlots(
		battle: BattleEncounter,
		roundStates: RoundState[],
		horizonTurns: number,
	): TurnSlot[] {
		const slots: TurnSlot[] = [];
		let turnNumber = 0;

		for (const state of roundStates) {
			if (turnNumber >= horizonTurns) break;

			const startIndex =
				state.round === battle.round ? Math.max(0, battle.activeTurnIndex) : state.firstEligibleTurnIndex;
			if (startIndex < 0) continue;

			for (let index = startIndex; index < state.combatants.length; index += 1) {
				const combatant = state.combatants[index];
				if (!this.isEligibleCombatant(combatant, state.round)) continue;
				if (state.round === battle.round && index < Math.max(0, battle.activeTurnIndex)) continue;

				slots.push({
					combatant,
					round: state.round,
					turnIndex: index,
					turnNumber,
					label: turnNumber === 0 ? 'Agora' : 'Depois',
					priority: turnNumber === 0 ? 0 : 10,
					sortOrder: turnNumber * 10,
				});
				turnNumber += 1;
				if (turnNumber >= horizonTurns) break;
			}
		}

		return slots;
	}

	private resolveRoundStartPreview(
		round: number,
		combatants: BattleCombatant[],
		pendingCombatants: BattleCombatant[],
	): RoundState {
		const joinedCombatants = pendingCombatants.map((combatant) => ({
			...combatant,
			pendingAdd: false,
			joinsAtRound: undefined,
			nextRoundInitiative: undefined,
			inactiveUntilRound: undefined,
		}));

		const updatedCombatants = combatants.map((combatant) => ({
			...combatant,
			initiative: combatant.nextRoundInitiative ?? combatant.initiative,
			nextRoundInitiative: undefined,
			inactiveUntilRound:
				combatant.inactiveUntilRound != null && combatant.inactiveUntilRound <= round
					? undefined
					: combatant.inactiveUntilRound,
		}));

		const nextCombatants = this.battleService.orderCombatants([...updatedCombatants, ...joinedCombatants]);
		return {
			round,
			combatants: nextCombatants,
			joinedCombatants,
			firstEligibleTurnIndex: this.findFirstEligibleTurnIndex(nextCombatants, round),
		};
	}

	private describeTurnRelativePrefix(
		battle: BattleEncounter,
		slot: TurnSlot,
		timing?: BattleCondition['expiresAtTiming'],
	): string {
		if (slot.turnNumber === 0) {
			if (timing === 'end') return 'Fim do turno atual';
			return 'Início do turno atual';
		}

		if (slot.round === battle.round + 1 && slot.turnIndex === 0 && timing === 'start') {
			return 'Início do próximo round';
		}

		if (slot.turnNumber === 1) return 'Em 1 turno';
		return `Em ${slot.turnNumber} turnos`;
	}

	private getNextLairActionRound(
		battle: BattleEncounter,
		action: BattleLairAction,
		currentInitiative: number | null,
	): number | null {
		if (!action.active) return null;
		if (action.frequency === 'manual') return null;
		if (action.frequency === 'cooldown-rounds' && (action.currentCooldownRounds ?? 0) > 0) {
			return battle.round + (action.currentCooldownRounds ?? 0);
		}

		if (currentInitiative == null) return battle.round + 1;
		return currentInitiative > action.initiative ? battle.round : battle.round + 1;
	}

	private getNextTrapRound(
		battle: BattleEncounter,
		trap: BattleTrap,
		currentInitiative: number | null,
	): number | null {
		if (!trap.active || trap.triggerType === 'manual') return null;
		if (trap.frequency === 'cooldown-rounds' && (trap.currentCooldownRounds ?? 0) > 0) {
			return battle.round + (trap.currentCooldownRounds ?? 0);
		}
		if (trap.frequency === 'once' && trap.lastTriggeredAtRound != null) return null;

		if (trap.triggerType === 'round-start') return battle.round + 1;
		if (trap.triggerType === 'round-end') return battle.round;
		if (trap.triggerType === 'initiative') {
			if (currentInitiative == null || trap.initiative == null) return battle.round + 1;
			return currentInitiative > trap.initiative ? battle.round : battle.round + 1;
		}

		return null;
	}

	private isEligibleCombatant(combatant: BattleCombatant, round: number): boolean {
		return (
			combatant.defeated !== true &&
			combatant.pendingAdd !== true &&
			(combatant.inactiveUntilRound == null || combatant.inactiveUntilRound <= round)
		);
	}

	private findFirstEligibleTurnIndex(combatants: BattleCombatant[], round: number): number {
		return combatants.findIndex((combatant) => this.isEligibleCombatant(combatant, round));
	}
}
