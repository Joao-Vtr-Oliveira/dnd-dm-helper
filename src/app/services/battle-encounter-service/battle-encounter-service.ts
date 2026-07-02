import { inject, Injectable } from '@angular/core';
import type {
	BattleCombatant,
	BattleCombatantSide,
	BattleCondition,
	BattleConditionPreset,
	BattleEncounter,
	BattleEncounterCreateOptions,
	BattleSpecialAbility,
	BattleSpellSlotLevel,
	BattleTurnLogEntry,
	EncounterTemplate,
} from '../../models/battle-encounter-model';
import type {
	ConditionInterface,
	CreatureCategory,
	CreatureInterface,
	CreatureSpecialAbility,
} from '../../models/battleTracker-model';
import {
	BattleConditionService,
	type CreateBattleConditionInput,
} from '../battle-condition-service/battle-condition-service';
import { BattleAbilityService, type CreateBattleAbilityInput } from '../battle-ability-service/battle-ability-service';
import { BattleSpellSlotService } from '../battle-spell-slot-service/battle-spell-slot-service';

const DEFAULT_SIDE: BattleCombatantSide = 'enemy';
const DEFAULT_CREATURE_CATEGORY: CreatureCategory = 'monster';

type AddCombatantOverrides = {
	name?: string;
	displayName?: string;
	side?: BattleCombatantSide;
	initiative?: number;
	armorClass?: number;
	maxHp?: number;
	currentHp?: number;
	temporaryHp?: number;
	category?: CreatureCategory;
	pendingAdd?: boolean;
	joinsAtRound?: number;
	sourceSheetId?: string;
};

type RoundStartResolution = {
	combatants: BattleCombatant[];
	pendingCombatants: BattleCombatant[];
	messages: string[];
};

export const DEFAULT_BATTLE_CONDITIONS: BattleConditionPreset[] = [
	{ name: 'prone', label: 'Caído / Prone' },
	{ name: 'grappled', label: 'Agarrado / Grappled' },
	{ name: 'restrained', label: 'Contido / Restrained' },
	{ name: 'poisoned', label: 'Envenenado / Poisoned' },
	{ name: 'stunned', label: 'Atordoado / Stunned' },
	{ name: 'unconscious', label: 'Inconsciente / Unconscious' },
	{ name: 'frightened', label: 'Amedrontado / Frightened' },
	{ name: 'invisible', label: 'Invisível / Invisible' },
	{ name: 'concentrating', label: 'Concentrando / Concentrating' },
	{ name: 'blessed', label: 'Abençoado / Blessed' },
	{ name: 'custom', label: 'Personalizado / Custom' },
];

@Injectable({ providedIn: 'root' })
export class BattleEncounterService {
	private readonly conditionService = inject(BattleConditionService);
	private readonly abilityService = inject(BattleAbilityService);
	private readonly spellSlotService = inject(BattleSpellSlotService);

	createBattleFromEncounter(
		template: EncounterTemplate,
		options?: BattleEncounterCreateOptions,
		now = new Date()
	): BattleEncounter {
		const timestamp = this.toIso(now);
		const combatants = this.orderCombatants(
			(template.data.creatures ?? []).map((creature, index) =>
				this.createCombatantFromCreature(creature, index, options)
			)
		);

		return {
			id: this.createId(),
			sourceEncounterId: template.id,
			name: options?.name?.trim() || template.name,
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
			pendingCombatants: [],
			turnHistory: [],
			dmNotes: '',
		};
	}

	normalizeBattleEncounter(raw: Partial<BattleEncounter>): BattleEncounter {
		const createdAt = this.normalizeIso(raw.createdAt);
		const updatedAt = this.normalizeIso(raw.updatedAt ?? raw.createdAt);
		const combatants = this.orderCombatants(
			Array.isArray(raw.combatants)
				? raw.combatants.map((combatant, index) => this.normalizeCombatant(combatant, index))
				: []
		);
		const pendingCombatants = Array.isArray(raw.pendingCombatants)
			? raw.pendingCombatants.map((combatant, index) =>
					this.normalizeCombatant(combatant, index, {
						pendingAdd: true,
					})
			  )
			: [];

		return {
			id: typeof raw.id === 'string' ? raw.id : this.createId(),
			sourceEncounterId:
				typeof raw.sourceEncounterId === 'string' ? raw.sourceEncounterId : 'unknown-encounter',
			name: typeof raw.name === 'string' ? raw.name : 'Batalha local',
			description: typeof raw.description === 'string' ? raw.description : undefined,
			status:
				raw.status === 'active' || raw.status === 'paused' || raw.status === 'completed'
					? raw.status
					: 'active',
			round: Math.max(1, this.toNonNegativeInt(raw.round) || 1),
			activeTurnIndex:
				combatants.length === 0
					? -1
					: Math.min(
							Math.max(0, this.toNonNegativeInt(raw.activeTurnIndex)),
							combatants.length - 1
					  ),
			createdAt,
			startedAt: this.normalizeIso(raw.startedAt ?? raw.createdAt),
			updatedAt,
			completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : undefined,
			turnStartedAt: typeof raw.turnStartedAt === 'string' ? raw.turnStartedAt : undefined,
			currentTurnElapsedSeconds: this.toNonNegativeInt(raw.currentTurnElapsedSeconds),
			combatants,
			pendingCombatants,
			turnHistory: this.normalizeTurnHistory(raw.turnHistory),
			dmNotes: typeof raw.dmNotes === 'string' ? raw.dmNotes : '',
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
		const endExpire = this.conditionService.expireConditionsAtTiming(
			battle.combatants,
			{ round: battle.round, turnIndex: battle.activeTurnIndex },
			'end'
		);

		let nextTurnIndex = battle.activeTurnIndex + 1;
		let nextRound = battle.round;
		let nextCombatants = endExpire.combatants;
		let nextPendingCombatants = battle.pendingCombatants;
		let roundStartMessages: string[] = [];
		const roundAdvanced = nextTurnIndex >= battle.combatants.length;

		if (roundAdvanced) {
			nextRound += 1;
			const resolution = this.resolveRoundStartChanges(
				endExpire.combatants,
				battle.pendingCombatants
			);
			nextCombatants = resolution.combatants;
			nextPendingCombatants = resolution.pendingCombatants;
			roundStartMessages = resolution.messages;
			nextTurnIndex = nextCombatants.length ? 0 : -1;
		}

		const startExpire = this.conditionService.expireConditionsAtTiming(
			nextCombatants,
			{ round: nextRound, turnIndex: nextTurnIndex },
			'start'
		);
		const cooldownAdvance = this.abilityService.advanceCooldowns(
			startExpire.combatants,
			roundAdvanced
		);

		const turnHistory = [...battle.turnHistory];
		if (currentCombatant) {
			turnHistory.push(
				this.createTurnHistoryEntry(battle, currentCombatant, timestamp, durationSeconds, notes)
			);
		}

		for (const message of [
			...endExpire.messages,
			...roundStartMessages,
			...startExpire.messages,
			...cooldownAdvance.messages,
		]) {
			turnHistory.push(
				this.createSystemHistoryEntry(
					{
						round: nextRound,
						turnIndex: nextTurnIndex,
					},
					timestamp,
					message
				)
			);
		}

		return {
			...battle,
			round: nextRound,
			activeTurnIndex: nextTurnIndex,
			updatedAt: timestamp,
			turnStartedAt: nextTurnIndex >= 0 ? timestamp : undefined,
			currentTurnElapsedSeconds: 0,
			combatants: cooldownAdvance.combatants,
			pendingCombatants: nextPendingCombatants,
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
				defeated: currentHp <= 0,
				collapsed: currentHp <= 0 ? true : combatant.collapsed,
			};
		});
	}

	addCombatantFromCreature(
		battle: BattleEncounter,
		creature: CreatureInterface,
		overrides?: AddCombatantOverrides,
		now = new Date()
	): BattleEncounter {
		const joinsAtRound = this.shouldQueueCombatantForNextRound(battle)
			? battle.round + 1
			: undefined;
		const combatant = this.createCombatantFromCreature(creature, battle.combatants.length, undefined, {
			...overrides,
			pendingAdd: joinsAtRound != null,
			joinsAtRound,
		});

		return this.insertCombatant(battle, combatant, now);
	}

	duplicateCombatant(battle: BattleEncounter, combatantId: string, now = new Date()): BattleEncounter {
		const original = this.findCombatant(battle, combatantId);
		if (!original) return battle;

		const joinsAtRound = this.shouldQueueCombatantForNextRound(battle)
			? battle.round + 1
			: undefined;
		const duplicate = this.normalizeCombatant(
			{
				...structuredClone(original),
				id: this.createId(),
				name: this.createDuplicateName(battle, original.displayName?.trim() || original.name),
				displayName: undefined,
				currentHp: original.maxHp,
				temporaryHp: 0,
				defeated: false,
				collapsed: false,
				spellSlots: original.spellSlots.map((slot) => ({
					level: slot.level,
					max: slot.max,
					used: 0,
				})),
				specialAbilities: original.specialAbilities.map((ability) =>
					this.abilityService.normalizeAbility({
						...ability,
						id: this.createId(),
						isAvailable: true,
						currentCooldownRounds: 0,
						currentCooldownTurns: 0,
						lastUsedAtRound: undefined,
						lastUsedAtTurnIndex: undefined,
					})
				),
				conditions: [],
				privateNotes: undefined,
				nextRoundInitiative: undefined,
				pendingAdd: joinsAtRound != null,
				joinsAtRound,
			},
			battle.combatants.length + battle.pendingCombatants.length,
			{
				pendingAdd: joinsAtRound != null,
			}
		);

		return this.insertCombatant(battle, duplicate, now);
	}

	removeCombatant(battle: BattleEncounter, combatantId: string, now = new Date()): BattleEncounter {
		const timestamp = this.toIso(now);
		const pendingIndex = battle.pendingCombatants.findIndex((combatant) => combatant.id === combatantId);
		if (pendingIndex >= 0) {
			return {
				...battle,
				updatedAt: timestamp,
				pendingCombatants: battle.pendingCombatants.filter((combatant) => combatant.id !== combatantId),
			};
		}

		const activeIndex = battle.combatants.findIndex((combatant) => combatant.id === combatantId);
		if (activeIndex === -1) return battle;

		const nextCombatants = battle.combatants.filter((combatant) => combatant.id !== combatantId);
		if (!nextCombatants.length) {
			return {
				...battle,
				updatedAt: timestamp,
				combatants: [],
				activeTurnIndex: -1,
				turnStartedAt: undefined,
				currentTurnElapsedSeconds: 0,
			};
		}

		let round = battle.round;
		let activeTurnIndex = battle.activeTurnIndex;
		let combatants = this.orderCombatants(nextCombatants);
		let pendingCombatants = battle.pendingCombatants;
		const turnHistory = [...battle.turnHistory];

		if (activeIndex < battle.activeTurnIndex) {
			activeTurnIndex = Math.max(0, battle.activeTurnIndex - 1);
		} else if (activeIndex === battle.activeTurnIndex) {
			if (activeIndex >= nextCombatants.length) {
				round += 1;
				const resolution = this.resolveRoundStartChanges(combatants, pendingCombatants);
				combatants = resolution.combatants;
				pendingCombatants = resolution.pendingCombatants;
				activeTurnIndex = combatants.length ? 0 : -1;
				for (const message of resolution.messages) {
					turnHistory.push(
						this.createSystemHistoryEntry(
							{
								round,
								turnIndex: Math.max(0, activeTurnIndex),
							},
							timestamp,
							message
						)
					);
				}
			} else {
				activeTurnIndex = activeIndex;
			}
		}

		return {
			...battle,
			round,
			activeTurnIndex,
			updatedAt: timestamp,
			turnStartedAt: battle.status === 'active' && activeTurnIndex >= 0 ? timestamp : undefined,
			currentTurnElapsedSeconds: 0,
			combatants,
			pendingCombatants,
			turnHistory,
		};
	}

	scheduleCombatantInitiative(
		battle: BattleEncounter,
		combatantId: string,
		initiative: number
	): BattleEncounter {
		const normalizedInitiative = this.toFiniteNumber(initiative);
		const pending = battle.pendingCombatants.some((combatant) => combatant.id === combatantId);
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			initiative: pending ? normalizedInitiative : combatant.initiative,
			nextRoundInitiative: pending ? undefined : normalizedInitiative,
		}));
	}

	clearScheduledCombatantInitiative(
		battle: BattleEncounter,
		combatantId: string
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			nextRoundInitiative: undefined,
		}));
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
				collapsed: currentHp <= 0 ? true : combatant.collapsed,
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
			collapsed: defeated ? true : combatant.collapsed,
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
		input: CreateBattleConditionInput
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			conditions: [
				...combatant.conditions,
				this.conditionService.createCondition(battle, {
					...input,
					appliedAtCombatantId: combatantId,
				}),
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

	describeConditionDuration(condition: BattleCondition, battle: BattleEncounter): string {
		return this.conditionService.describeConditionDuration(condition, battle);
	}

	addSpecialAbility(
		battle: BattleEncounter,
		combatantId: string,
		input: CreateBattleAbilityInput
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			specialAbilities: [...combatant.specialAbilities, this.abilityService.createAbility(input)],
		}));
	}

	useSpecialAbility(
		battle: BattleEncounter,
		combatantId: string,
		abilityId: string
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			specialAbilities: combatant.specialAbilities.map((ability) =>
				ability.id === abilityId ? this.abilityService.useAbility(ability, battle) : ability
			),
		}));
	}

	resetSpecialAbility(
		battle: BattleEncounter,
		combatantId: string,
		abilityId: string
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			specialAbilities: combatant.specialAbilities.map((ability) =>
				ability.id === abilityId ? this.abilityService.resetAbility(ability) : ability
			),
		}));
	}

	removeSpecialAbility(
		battle: BattleEncounter,
		combatantId: string,
		abilityId: string
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			specialAbilities: combatant.specialAbilities.filter((ability) => ability.id !== abilityId),
		}));
	}

	rollSpecialAbilityRecharge(
		battle: BattleEncounter,
		combatantId: string,
		abilityId: string
	): { battle: BattleEncounter; roll: number; success: boolean } | null {
		let result: { roll: number; success: boolean } | null = null;
		const nextBattle = this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			specialAbilities: combatant.specialAbilities.map((ability) => {
				if (ability.id !== abilityId) return ability;
				const rolled = this.abilityService.rollRecharge(ability);
				result = { roll: rolled.roll, success: rolled.success };
				return rolled.ability;
			}),
		}));

		if (!result) return null;
		const rechargeResult = result as { roll: number; success: boolean };
		return {
			battle: nextBattle,
			roll: rechargeResult.roll,
			success: rechargeResult.success,
		};
	}

	describeAbilityStatus(ability: BattleSpecialAbility): string {
		return this.abilityService.describeAbility(ability);
	}

	enableSpellSlots(battle: BattleEncounter, combatantId: string): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			spellSlots: this.spellSlotService.createDefaultSpellSlots(),
			spellSlotsCollapsed: true,
		}));
	}

	disableSpellSlots(battle: BattleEncounter, combatantId: string): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			spellSlots: [],
			spellSlotsCollapsed: true,
		}));
	}

	setSpellSlotsCollapsed(
		battle: BattleEncounter,
		combatantId: string,
		spellSlotsCollapsed: boolean
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			spellSlotsCollapsed,
		}));
	}

	setSpellSlotMax(
		battle: BattleEncounter,
		combatantId: string,
		level: number,
		max: number
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			spellSlots: this.spellSlotService.setSlotMax(combatant.spellSlots, level, max),
		}));
	}

	useSpellSlot(battle: BattleEncounter, combatantId: string, level: number): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			spellSlots: this.spellSlotService.useSlot(combatant.spellSlots, level),
		}));
	}

	recoverSpellSlot(battle: BattleEncounter, combatantId: string, level: number): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			spellSlots: this.spellSlotService.recoverSlot(combatant.spellSlots, level),
		}));
	}

	setSpellSlotUsed(
		battle: BattleEncounter,
		combatantId: string,
		level: number,
		used: number
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			spellSlots: this.spellSlotService.setUsed(combatant.spellSlots, level, used),
		}));
	}

	getAvailableSpellSlots(slot: BattleSpellSlotLevel): number {
		return this.spellSlotService.getAvailable(slot);
	}

	getPositionAfterTurns(
		battle: BattleEncounter,
		steps: number
	): { round: number; turnIndex: number } {
		return this.conditionService.advancePosition(
			battle.round,
			Math.max(0, battle.activeTurnIndex),
			steps,
			Math.max(1, battle.combatants.length)
		);
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
		const pendingCombatants = battle.pendingCombatants.map((combatant) => {
			if (combatant.id !== combatantId) return combatant;
			didChange = true;
			return updater(combatant);
		});

		if (!didChange) return battle;

		return {
			...battle,
			combatants,
			pendingCombatants,
			updatedAt: this.toIso(new Date()),
		};
	}

	private touchBattle(battle: BattleEncounter, now: Date): BattleEncounter {
		return {
			...battle,
			updatedAt: this.toIso(now),
		};
	}

	private normalizeCombatant(
		raw: Partial<BattleCombatant>,
		sourceIndex: number,
		overrides?: Partial<Pick<BattleCombatant, 'pendingAdd'>>
	): BattleCombatant {
		const maxHp = this.toNonNegativeInt(raw.maxHp);
		const currentHp = Math.min(
			this.toNonNegativeInt(raw.currentHp),
			maxHp || this.toNonNegativeInt(raw.currentHp)
		);
		const pendingAdd = overrides?.pendingAdd ?? raw.pendingAdd === true;
		return {
			id: typeof raw.id === 'string' ? raw.id : this.createId(),
			sourceCreatureId: typeof raw.sourceCreatureId === 'number' ? raw.sourceCreatureId : undefined,
			sourceSheetId: typeof raw.sourceSheetId === 'string' ? raw.sourceSheetId : undefined,
			name: typeof raw.name === 'string' ? raw.name : `Combatente ${sourceIndex + 1}`,
			displayName: typeof raw.displayName === 'string' ? raw.displayName : undefined,
			category: this.normalizeCreatureCategory(raw.category),
			side: this.normalizeSide(raw.side),
			initiative: this.toFiniteNumber(raw.initiative),
			nextRoundInitiative:
				raw.nextRoundInitiative == null ? undefined : this.toFiniteNumber(raw.nextRoundInitiative),
			initiativeTieBreaker:
				raw.initiativeTieBreaker == null ? undefined : this.toFiniteNumber(raw.initiativeTieBreaker),
			turnOrder: this.toNonNegativeInt(raw.turnOrder),
			armorClass: this.toArmorClass(raw.armorClass),
			maxHp,
			currentHp,
			temporaryHp: this.toNonNegativeInt(raw.temporaryHp),
			defeated: raw.defeated === true || currentHp <= 0,
			hidden: raw.hidden === true,
			collapsed: raw.collapsed === true,
			spellSlotsCollapsed: raw.spellSlotsCollapsed !== false,
			pendingAdd,
			joinsAtRound:
				raw.joinsAtRound == null ? undefined : Math.max(1, this.toNonNegativeInt(raw.joinsAtRound) || 1),
			conditions: Array.isArray(raw.conditions)
				? raw.conditions.map((condition) => this.conditionService.normalizeCondition(condition))
				: [],
			specialAbilities: Array.isArray(raw.specialAbilities)
				? raw.specialAbilities.map((ability) => this.abilityService.normalizeAbility(ability))
				: [],
			spellSlots: this.spellSlotService.normalizeSpellSlots(raw.spellSlots),
			privateNotes: typeof raw.privateNotes === 'string' ? raw.privateNotes : undefined,
		};
	}

	private createCombatantFromCreature(
		creature: CreatureInterface,
		sourceIndex: number,
		options?: BattleEncounterCreateOptions,
		overrides?: AddCombatantOverrides
	): BattleCombatant {
		const category = this.normalizeCreatureCategory(overrides?.category ?? creature.category);
		const maxHp = this.toNonNegativeInt(
			overrides?.maxHp ?? creature.maxHealthPoints ?? creature.healthPoints
		);
		const currentHp = Math.min(
			this.toNonNegativeInt(overrides?.currentHp ?? creature.healthPoints),
			maxHp
		);
		const temporaryHp = this.toNonNegativeInt(
			overrides?.temporaryHp ?? creature.temporaryHealthPoints
		);
		const side =
			overrides?.side ??
			options?.combatantSides?.[creature.id] ??
			this.inferSideFromCategory(category, creature.category);
		const initiativeOverride = options?.initiativeOverrides?.[creature.id];
		const initiative =
			overrides?.initiative ?? (initiativeOverride == null ? creature.initiative : initiativeOverride);

		return {
			id: this.createId(),
			sourceCreatureId: creature.id,
			sourceSheetId: overrides?.sourceSheetId ?? creature.sourceSheetId,
			name: overrides?.name?.trim() || creature.name || `Combatente ${sourceIndex + 1}`,
			displayName: overrides?.displayName?.trim() || undefined,
			category,
			side,
			initiative: this.toFiniteNumber(initiative),
			nextRoundInitiative: undefined,
			turnOrder: sourceIndex,
			armorClass: this.toArmorClass(overrides?.armorClass ?? creature.armorClass),
			maxHp,
			currentHp,
			temporaryHp,
			defeated: creature.alive === false || currentHp <= 0,
			hidden: false,
			collapsed: false,
			spellSlotsCollapsed: true,
			pendingAdd: overrides?.pendingAdd === true,
			joinsAtRound: overrides?.joinsAtRound,
			conditions: this.mapConditions(creature.conditions ?? []),
			specialAbilities: this.mapSpecialAbilities(creature.specialAbilities ?? []),
			spellSlots: this.mapSpellSlots(creature.totalSpellSlots, creature.usedSpellSlots),
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

	private createSystemHistoryEntry(
		position: { round: number; turnIndex: number },
		timestamp: string,
		notes: string
	): BattleTurnLogEntry {
		return {
			id: this.createId(),
			round: position.round,
			turnIndex: position.turnIndex,
			combatantId: 'system',
			combatantName: 'Sistema',
			startedAt: timestamp,
			endedAt: timestamp,
			durationSeconds: 0,
			notes,
		};
	}

	private normalizeTurnHistory(raw: unknown): BattleTurnLogEntry[] {
		if (!Array.isArray(raw)) return [];

		return raw.map((entry, index) => {
			const candidate = entry as Partial<BattleTurnLogEntry>;
			const timestamp = this.normalizeIso(candidate.startedAt);
			return {
				id: typeof candidate.id === 'string' ? candidate.id : `turn-log-${index + 1}`,
				round: Math.max(1, this.toNonNegativeInt(candidate.round) || 1),
				turnIndex: Math.max(0, this.toNonNegativeInt(candidate.turnIndex)),
				combatantId:
					typeof candidate.combatantId === 'string' ? candidate.combatantId : 'system',
				combatantName:
					typeof candidate.combatantName === 'string' ? candidate.combatantName : 'Sistema',
				startedAt: timestamp,
				endedAt: typeof candidate.endedAt === 'string' ? candidate.endedAt : undefined,
				durationSeconds: this.toNonNegativeInt(candidate.durationSeconds),
				notes: typeof candidate.notes === 'string' ? candidate.notes : undefined,
			};
		});
	}

	private mapConditions(conditions: ConditionInterface[]): BattleCondition[] {
		return conditions.map((condition, index) =>
			this.conditionService.normalizeCondition({
				id: this.createId(),
				name: this.slugify(condition.text) || `condition-${index + 1}`,
				label: condition.text || `Condicao ${index + 1}`,
				description: condition.url || undefined,
				appliedAtRound: Math.max(1, this.toNonNegativeInt(condition.appliedAtRound) || 1),
				appliedAtTurnIndex: 0,
				durationType: 'manual',
			})
		);
	}

	private mapSpecialAbilities(abilities: CreatureSpecialAbility[]): BattleSpecialAbility[] {
		return abilities.map((ability, index) =>
			this.abilityService.normalizeAbility({
				id: ability.id || `creature-ability-${index + 1}`,
				name: ability.name || `Habilidade ${index + 1}`,
				description: ability.description,
				rechargeType: ability.rechargeType,
				cooldownTurns: ability.cooldownTurns,
				cooldownRounds: ability.cooldownRounds,
				rechargeDice: ability.rechargeDice,
				rechargeOn: ability.rechargeOn,
				isAvailable: true,
				currentCooldownRounds: 0,
				currentCooldownTurns: 0,
			})
		);
	}

	private mapSpellSlots(
		totalSpellSlots: CreatureInterface['totalSpellSlots'],
		usedSpellSlots: CreatureInterface['usedSpellSlots']
	): BattleSpellSlotLevel[] {
		if (!totalSpellSlots && !usedSpellSlots) return [];

		return this.spellSlotService.createDefaultSpellSlots().map((slot) => {
			const key = `${slot.level}${this.ordinalSuffix(slot.level)}` as keyof NonNullable<
				CreatureInterface['totalSpellSlots']
			>;
			const max = this.toNonNegativeInt(totalSpellSlots?.[key]);
			const used = Math.min(max, this.toNonNegativeInt(usedSpellSlots?.[key]));

			return {
				level: slot.level,
				max,
				used,
			};
		});
	}

	private joinNotes(notes: Array<string | undefined> | undefined): string | undefined {
		const text = (notes ?? [])
			.map((note) => (note || '').trim())
			.filter(Boolean)
			.join('\n');
		return text || undefined;
	}

	private normalizeSide(value: unknown): BattleCombatantSide {
		if (value === 'player' || value === 'ally' || value === 'enemy' || value === 'neutral') {
			return value;
		}
		return DEFAULT_SIDE;
	}

	private normalizeCreatureCategory(value: unknown): CreatureCategory | undefined {
		if (value == null) return undefined;
		if (value === 'monster' || value === 'boss') return 'monster';
		if (value === 'npc' || value === 'ally' || value === 'pet') return 'npc';
		if (value === 'pc' || value === 'PC' || value === 'player') return 'pc';
		if (value === 'other' || value === 'item') return 'other';
		return DEFAULT_CREATURE_CATEGORY;
	}

	private inferSideFromCategory(
		category: CreatureCategory | undefined,
		rawCategory?: unknown
	): BattleCombatantSide {
		if (rawCategory === 'ally' || rawCategory === 'pet') return 'ally';
		if (category === 'pc') return 'player';
		if (category === 'npc') return 'neutral';
		if (category === 'other') return 'neutral';
		return DEFAULT_SIDE;
	}

	private shouldQueueCombatantForNextRound(battle: BattleEncounter): boolean {
		return battle.status !== 'completed' && battle.combatants.length > 0;
	}

	private insertCombatant(
		battle: BattleEncounter,
		combatant: BattleCombatant,
		now: Date
	): BattleEncounter {
		const timestamp = this.toIso(now);
		if (combatant.pendingAdd) {
			return {
				...battle,
				updatedAt: timestamp,
				pendingCombatants: [...battle.pendingCombatants, combatant],
			};
		}

		const combatants = this.orderCombatants([...battle.combatants, combatant]);
		return {
			...battle,
			updatedAt: timestamp,
			combatants,
			activeTurnIndex: battle.activeTurnIndex >= 0 ? battle.activeTurnIndex : 0,
			turnStartedAt:
				battle.status === 'active' ? battle.turnStartedAt ?? timestamp : battle.turnStartedAt,
		};
	}

	private resolveRoundStartChanges(
		combatants: BattleCombatant[],
		pendingCombatants: BattleCombatant[]
	): RoundStartResolution {
		const updatedInitiatives = combatants
			.filter((combatant) => combatant.nextRoundInitiative != null)
			.map((combatant) => combatant.displayName?.trim() || combatant.name);
		const joiningCombatants = pendingCombatants.map(
			(combatant) => combatant.displayName?.trim() || combatant.name
		);
		const activatedCombatants = pendingCombatants.map((combatant) => ({
			...combatant,
			pendingAdd: false,
			joinsAtRound: undefined,
			nextRoundInitiative: undefined,
		}));
		const reorderedCombatants = this.orderCombatants([
			...combatants.map((combatant) => ({
				...combatant,
				initiative: combatant.nextRoundInitiative ?? combatant.initiative,
				nextRoundInitiative: undefined,
			})),
			...activatedCombatants,
		]);
		const messages: string[] = [];

		if (updatedInitiatives.length) {
			messages.push(
				`Iniciativas atualizadas no início do round para ${updatedInitiatives.join(', ')}.`
			);
		}

		if (joiningCombatants.length) {
			messages.push(`Entraram no próximo round: ${joiningCombatants.join(', ')}.`);
		}

		return {
			combatants: reorderedCombatants,
			pendingCombatants: [],
			messages,
		};
	}

	private findCombatant(battle: BattleEncounter, combatantId: string): BattleCombatant | null {
		return (
			battle.combatants.find((combatant) => combatant.id === combatantId) ??
			battle.pendingCombatants.find((combatant) => combatant.id === combatantId) ??
			null
		);
	}

	private createDuplicateName(battle: BattleEncounter, baseName: string): string {
		const normalizedBase = baseName.replace(/\s+\(\d+\)$/, '').trim() || 'Combatente';
		const names = new Set(
			[...battle.combatants, ...battle.pendingCombatants].map(
				(combatant) => combatant.displayName?.trim() || combatant.name
			)
		);
		if (!names.has(normalizedBase)) return normalizedBase;

		let index = 2;
		let candidate = `${normalizedBase} (${index})`;
		while (names.has(candidate)) {
			index += 1;
			candidate = `${normalizedBase} (${index})`;
		}
		return candidate;
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

	private normalizeIso(value: unknown): string {
		if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value;
		return this.toIso(new Date());
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

	private ordinalSuffix(level: number): 'st' | 'nd' | 'rd' | 'th' {
		if (level === 1) return 'st';
		if (level === 2) return 'nd';
		if (level === 3) return 'rd';
		return 'th';
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
