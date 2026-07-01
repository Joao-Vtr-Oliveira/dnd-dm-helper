import { Injectable } from '@angular/core';
import type {
	BattleCombatant,
	BattleCombatantSide,
	BattleCondition,
	BattleConditionPreset,
	BattleEncounter,
	BattleTurnLogEntry,
	EncounterTemplate,
} from '../../models/battle-encounter-model';
import type { ConditionInterface, CreatureInterface } from '../../models/battleTracker-model';

const DEFAULT_SIDE: BattleCombatantSide = 'enemy';

export const DEFAULT_BATTLE_CONDITIONS: BattleConditionPreset[] = [
	{ name: 'prone', label: 'Caido / Prone' },
	{ name: 'grappled', label: 'Agarrado / Grappled' },
	{ name: 'restrained', label: 'Contido / Restrained' },
	{ name: 'poisoned', label: 'Envenenado / Poisoned' },
	{ name: 'stunned', label: 'Atordoado / Stunned' },
	{ name: 'unconscious', label: 'Inconsciente / Unconscious' },
	{ name: 'frightened', label: 'Amedrontado / Frightened' },
	{ name: 'invisible', label: 'Invisivel / Invisible' },
	{ name: 'concentrating', label: 'Concentrando / Concentrating' },
	{ name: 'blessed', label: 'Abencoado / Blessed' },
	{ name: 'custom', label: 'Personalizado / Custom' },
];

@Injectable({ providedIn: 'root' })
export class BattleEncounterService {
	createBattleFromEncounter(template: EncounterTemplate, now = new Date()): BattleEncounter {
		const timestamp = this.toIso(now);
		const combatants = this.orderCombatants(
			(template.data.creatures ?? []).map((creature, index) =>
				this.createCombatantFromCreature(creature, index)
			)
		);

		return {
			id: this.createId(),
			sourceEncounterId: template.id,
			name: template.name,
			description: template.description,
			status: 'active',
			round: 1,
			activeTurnIndex: combatants.length ? 0 : -1,
			createdAt: timestamp,
			startedAt: timestamp,
			updatedAt: timestamp,
			turnStartedAt: combatants.length ? timestamp : undefined,
			currentTurnElapsedSeconds: 0,
			combatants,
			turnHistory: [],
			dmNotes: '',
		};
	}

	orderCombatants(combatants: BattleCombatant[]): BattleCombatant[] {
		return [...combatants]
			.map((combatant, index) => ({ combatant, index }))
			.sort((left, right) => {
				if (right.combatant.initiative !== left.combatant.initiative) {
					return right.combatant.initiative - left.combatant.initiative;
				}

				const leftTie = left.combatant.initiativeTieBreaker;
				const rightTie = right.combatant.initiativeTieBreaker;
				if (leftTie != null || rightTie != null) {
					return (rightTie ?? Number.NEGATIVE_INFINITY) - (leftTie ?? Number.NEGATIVE_INFINITY);
				}

				return left.index - right.index;
			})
			.map(({ combatant }, turnOrder) => ({ ...combatant, turnOrder }));
	}

	getCurrentCombatant(battle: BattleEncounter): BattleCombatant | null {
		if (!battle.combatants.length || battle.activeTurnIndex < 0) return null;
		return battle.combatants[battle.activeTurnIndex] ?? null;
	}

	getCurrentTurnElapsedSeconds(battle: BattleEncounter, now = new Date()): number {
		const base = this.toNonNegativeInt(battle.currentTurnElapsedSeconds);
		if (battle.status !== 'active' || !battle.turnStartedAt) return base;

		const startedAt = Date.parse(battle.turnStartedAt);
		if (Number.isNaN(startedAt)) return base;

		return base + Math.max(0, Math.floor((now.getTime() - startedAt) / 1000));
	}

	advanceTurn(battle: BattleEncounter, now = new Date(), notes?: string): BattleEncounter {
		if (!battle.combatants.length) {
			return this.touchBattle(battle, now);
		}

		const timestamp = this.toIso(now);
		const currentCombatant = this.getCurrentCombatant(battle);
		const durationSeconds = this.getCurrentTurnElapsedSeconds(battle, now);
		const turnHistory = currentCombatant
			? [
					...battle.turnHistory,
					this.createTurnHistoryEntry(battle, currentCombatant, timestamp, durationSeconds, notes),
			  ]
			: battle.turnHistory;

		let nextTurnIndex = battle.activeTurnIndex + 1;
		let nextRound = battle.round;

		if (nextTurnIndex >= battle.combatants.length) {
			nextTurnIndex = 0;
			nextRound += 1;
		}

		return {
			...battle,
			round: nextRound,
			activeTurnIndex: nextTurnIndex,
			updatedAt: timestamp,
			turnStartedAt: timestamp,
			currentTurnElapsedSeconds: 0,
			turnHistory,
		};
	}

	rewindTurn(battle: BattleEncounter, now = new Date()): BattleEncounter {
		if (!battle.turnHistory.length) return this.touchBattle(battle, now);

		const lastTurn = battle.turnHistory[battle.turnHistory.length - 1];
		const timestamp = this.toIso(now);

		return {
			...battle,
			round: lastTurn.round,
			activeTurnIndex: lastTurn.turnIndex,
			updatedAt: timestamp,
			turnStartedAt: battle.status === 'active' ? timestamp : undefined,
			currentTurnElapsedSeconds: 0,
			turnHistory: battle.turnHistory.slice(0, -1),
		};
	}

	pauseBattle(battle: BattleEncounter, now = new Date()): BattleEncounter {
		const timestamp = this.toIso(now);
		return {
			...battle,
			status: 'paused',
			updatedAt: timestamp,
			turnStartedAt: undefined,
			currentTurnElapsedSeconds: this.getCurrentTurnElapsedSeconds(battle, now),
		};
	}

	resumeBattle(battle: BattleEncounter, now = new Date()): BattleEncounter {
		if (battle.status === 'completed') return battle;

		const timestamp = this.toIso(now);
		return {
			...battle,
			status: 'active',
			updatedAt: timestamp,
			turnStartedAt: battle.combatants.length ? timestamp : undefined,
			currentTurnElapsedSeconds: this.toNonNegativeInt(battle.currentTurnElapsedSeconds),
		};
	}

	completeBattle(battle: BattleEncounter, now = new Date()): BattleEncounter {
		const timestamp = this.toIso(now);
		return {
			...battle,
			status: 'completed',
			updatedAt: timestamp,
			completedAt: timestamp,
			turnStartedAt: undefined,
			currentTurnElapsedSeconds: this.getCurrentTurnElapsedSeconds(battle, now),
		};
	}

	updateBattleNotes(battle: BattleEncounter, dmNotes: string): BattleEncounter {
		return {
			...battle,
			updatedAt: this.toIso(new Date()),
			dmNotes,
		};
	}

	updateCombatant(
		battle: BattleEncounter,
		combatantId: string,
		patch: Partial<BattleCombatant>
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			...patch,
		}));
	}

	updateCombatantHp(
		battle: BattleEncounter,
		combatantId: string,
		patch: Partial<Pick<BattleCombatant, 'currentHp' | 'maxHp' | 'temporaryHp'>>
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => {
			const maxHp = patch.maxHp == null ? combatant.maxHp : this.toNonNegativeInt(patch.maxHp);
			const currentHpRaw =
				patch.currentHp == null ? combatant.currentHp : this.toNonNegativeInt(patch.currentHp);
			const temporaryHp =
				patch.temporaryHp == null ? combatant.temporaryHp : this.toNonNegativeInt(patch.temporaryHp);

			const currentHp = Math.min(currentHpRaw, maxHp);
			return {
				...combatant,
				maxHp,
				currentHp,
				temporaryHp,
				defeated: currentHp <= 0 ? true : false,
			};
		});
	}

	applyDamage(battle: BattleEncounter, combatantId: string, amount: number): BattleEncounter {
		const damage = this.toNonNegativeInt(amount);
		if (!damage) return battle;

		return this.mapCombatant(battle, combatantId, (combatant) => {
			const absorbed = Math.min(combatant.temporaryHp, damage);
			const remainingDamage = damage - absorbed;
			const temporaryHp = combatant.temporaryHp - absorbed;
			const currentHp = Math.max(0, combatant.currentHp - remainingDamage);

			return {
				...combatant,
				currentHp,
				temporaryHp,
				defeated: currentHp <= 0,
			};
		});
	}

	applyHealing(battle: BattleEncounter, combatantId: string, amount: number): BattleEncounter {
		const healing = this.toNonNegativeInt(amount);
		if (!healing) return battle;

		return this.mapCombatant(battle, combatantId, (combatant) => {
			const currentHp = Math.min(combatant.maxHp, combatant.currentHp + healing);
			return {
				...combatant,
				currentHp,
				defeated: currentHp <= 0,
			};
		});
	}

	setCombatantDefeated(
		battle: BattleEncounter,
		combatantId: string,
		defeated: boolean
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			defeated,
		}));
	}

	updateCombatantNotes(
		battle: BattleEncounter,
		combatantId: string,
		privateNotes: string
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			privateNotes,
		}));
	}

	addCondition(
		battle: BattleEncounter,
		combatantId: string,
		condition: Omit<BattleCondition, 'id' | 'appliedAtRound' | 'appliedAtTurnIndex'> &
			Partial<Pick<BattleCondition, 'appliedAtRound' | 'appliedAtTurnIndex'>>
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			conditions: [
				...combatant.conditions,
				{
					...condition,
					id: this.createId(),
					appliedAtRound: condition.appliedAtRound ?? battle.round,
					appliedAtTurnIndex: condition.appliedAtTurnIndex ?? battle.activeTurnIndex,
				},
			],
		}));
	}

	removeCondition(
		battle: BattleEncounter,
		combatantId: string,
		conditionId: string
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			conditions: combatant.conditions.filter((condition) => condition.id !== conditionId),
		}));
	}

	private mapCombatant(
		battle: BattleEncounter,
		combatantId: string,
		updater: (combatant: BattleCombatant) => BattleCombatant
	): BattleEncounter {
		let didChange = false;
		const combatants = battle.combatants.map((combatant) => {
			if (combatant.id !== combatantId) return combatant;
			didChange = true;
			return updater(combatant);
		});

		if (!didChange) return battle;

		return {
			...battle,
			combatants,
			updatedAt: this.toIso(new Date()),
		};
	}

	private touchBattle(battle: BattleEncounter, now: Date): BattleEncounter {
		return {
			...battle,
			updatedAt: this.toIso(now),
		};
	}

	private createCombatantFromCreature(
		creature: CreatureInterface,
		sourceIndex: number
	): BattleCombatant {
		const maxHp = this.toNonNegativeInt(creature.maxHealthPoints ?? creature.healthPoints);
		const currentHp = Math.min(this.toNonNegativeInt(creature.healthPoints), maxHp);
		const temporaryHp = this.toNonNegativeInt(creature.temporaryHealthPoints);

		return {
			id: this.createId(),
			name: creature.name || `Combatente ${sourceIndex + 1}`,
			side: DEFAULT_SIDE,
			initiative: this.toFiniteNumber(creature.initiative),
			turnOrder: sourceIndex,
			armorClass: this.toArmorClass(creature.armorClass),
			maxHp,
			currentHp,
			temporaryHp,
			defeated: creature.alive === false || currentHp <= 0,
			hidden: false,
			conditions: this.mapConditions(creature.conditions ?? []),
			privateNotes: this.joinNotes(creature.notes?.map((note) => note.text)),
		};
	}

	private createTurnHistoryEntry(
		battle: BattleEncounter,
		combatant: BattleCombatant,
		endedAt: string,
		durationSeconds: number,
		notes?: string
	): BattleTurnLogEntry {
		return {
			id: this.createId(),
			round: battle.round,
			turnIndex: battle.activeTurnIndex,
			combatantId: combatant.id,
			combatantName: combatant.displayName?.trim() || combatant.name,
			startedAt: battle.turnStartedAt ?? endedAt,
			endedAt,
			durationSeconds,
			notes: (notes || '').trim() || undefined,
		};
	}

	private mapConditions(conditions: ConditionInterface[]): BattleCondition[] {
		return conditions.map((condition, index) => ({
			id: this.createId(),
			name: this.slugify(condition.text) || `condition-${index + 1}`,
			label: condition.text || `Condicao ${index + 1}`,
			description: condition.url || undefined,
			appliedAtRound: Math.max(1, this.toNonNegativeInt(condition.appliedAtRound) || 1),
			appliedAtTurnIndex: 0,
		}));
	}

	private joinNotes(notes: Array<string | undefined> | undefined): string | undefined {
		const text = (notes ?? [])
			.map((note) => (note || '').trim())
			.filter(Boolean)
			.join('\n');
		return text || undefined;
	}

	private toArmorClass(value: unknown): number | undefined {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? numeric : undefined;
	}

	private createId(): string {
		return globalThis.crypto?.randomUUID?.() ?? `battle-${Math.random().toString(36).slice(2, 10)}`;
	}

	private toIso(value: Date): string {
		return value.toISOString();
	}

	private toNonNegativeInt(value: unknown): number {
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) return 0;
		return Math.max(0, Math.floor(numeric));
	}

	private toFiniteNumber(value: unknown): number {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? numeric : 0;
	}

	private slugify(value: string): string {
		return (value || '')
			.trim()
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '');
	}
}
