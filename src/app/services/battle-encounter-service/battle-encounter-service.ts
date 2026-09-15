import { inject, Injectable } from '@angular/core';
import type {
	BattleCombatant,
	BattleCombatantSide,
	BattleConcentrationCheckPendingAction,
	BattleCondition,
	BattleConditionPreset,
	BattleDeathSavePendingAction,
	BattleDeathSaveState,
	BattleEncounter,
	BattleEncounterCreateOptions,
	BattleLairAction,
	BattlePendingAction,
	BattleReferenceSheet,
	BattleSpecialAbility,
	BattleSpellSlotLevel,
	BattleTrap,
	BattleTurnLogEntry,
	BattleTurnSnapshot,
	BattleTurnSnapshotState,
} from '../../models/battle-encounter-model';
import type {
	CreatureCategory,
	CreatureDamageDefense,
	CreatureFeature,
	CreatureSheet,
	CreatureSpecialAbility,
	CreatureSpell,
	CreatureSpellSlot,
} from '../../models/creature-sheet-model';
import { normalizeArmorClass } from '../../models/creature-sheet-model';
import type {
	Encounter,
	EncounterLairAction,
	EncounterParticipant,
	EncounterTrap,
} from '../../models/encounter-model';
import {
	BattleConditionService,
	type CreateBattleConditionInput,
} from '../battle-condition-service/battle-condition-service';
import {
	BattleAbilityService,
} from '../battle-ability-service/battle-ability-service';
import { BattleSpellSlotService } from '../battle-spell-slot-service/battle-spell-slot-service';
import type { SavedSheetInterface } from '../local-storage-service/local-storage-service';

const DEFAULT_SIDE: BattleCombatantSide = 'enemy';
const DEFAULT_CREATURE_CATEGORY: CreatureCategory = 'monster';
export const MAX_BATTLE_TURN_SNAPSHOTS = 30;

export type DeathSaveOutcome = 'success' | 'failure' | 'stable' | 'dead' | 'natural-20';

type AddCombatantOverrides = {
	name?: string;
	displayName?: string;
	side?: BattleCombatantSide;
	initiative?: number;
	initiativeTieBreaker?: number;
	armorClass?: number | null;
	maxHp?: number;
	currentHp?: number;
	temporaryHp?: number;
	category?: CreatureCategory;
	pendingAdd?: boolean;
	joinsAtRound?: number;
	sourceParticipantId?: string;
	sourceSheetId?: string;
	referenceSheetId?: string;
};

export type CreateBattleLairActionInput = {
	name: string;
	description?: string;
	initiative?: number;
	frequency: BattleLairAction['frequency'];
	cooldownRounds?: number;
};

export type CreateBattleTrapInput = {
	name: string;
	description?: string;
	triggerType: BattleTrap['triggerType'];
	initiative?: number;
	frequency: BattleTrap['frequency'];
	cooldownRounds?: number;
};

type RoundStartResolution = {
	combatants: BattleCombatant[];
	pendingCombatants: BattleCombatant[];
	messages: string[];
};

type EncounterEventAdvanceResult = {
	lairActions: BattleLairAction[];
	traps: BattleTrap[];
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
		encounter: Encounter,
		options?: BattleEncounterCreateOptions,
		now = new Date(),
	): BattleEncounter {
		const timestamp = this.toIso(now);
		const referenceSheets = encounter.participants.map((participant) =>
			this.createReferenceSheet(participant.sheet),
		);
		const combatants = this.orderCombatants(
			encounter.participants.map((participant, index) => ({
				...this.createCombatantFromParticipant(participant, index, options, {
					referenceSheetId: referenceSheets[index].id,
				}),
				collapsed: true,
			})),
		);
		const initialTurnIndex = this.normalizeActiveTurnIndex(combatants, 0, 1);

		return {
			id: this.createId(),
			sourceEncounterId: encounter.id,
			name: options?.name?.trim() || encounter.title,
			description: encounter.description,
			status: 'active',
			round: 1,
			activeTurnIndex: initialTurnIndex,
			createdAt: timestamp,
			startedAt: timestamp,
			updatedAt: timestamp,
			turnStartedAt: initialTurnIndex >= 0 ? timestamp : undefined,
			currentTurnElapsedSeconds: 0,
			referenceSheets,
			combatants,
			pendingCombatants: [],
			lairActions: this.mapEncounterLairActions(encounter.lairActions),
			traps: this.mapEncounterTraps(encounter.traps),
			turnHistory: [],
			dmNotes: '',
			pendingActions: [],
			turnSnapshots: [],
		};
	}

	applyBattleSetup(
		battle: BattleEncounter,
		options: BattleEncounterCreateOptions,
		now = new Date(),
	): BattleEncounter {
		const activeCombatantId = battle.combatants[battle.activeTurnIndex]?.id;
		const combatants = this.orderCombatants(
			battle.combatants.map((combatant) => {
				const participantId = combatant.sourceParticipantId;
				if (!participantId) return combatant;
				const initiative = options.initiativeOverrides?.[participantId];
				const side = options.combatantSides?.[participantId];
				const hasTieBreakers = options.initiativeTieBreakerOverrides !== undefined;
				const tieBreaker = options.initiativeTieBreakerOverrides?.[participantId];
				return {
					...combatant,
					...(initiative == null ? {} : { initiative }),
					...(side ? { side } : {}),
					...(hasTieBreakers ? { initiativeTieBreaker: tieBreaker } : {}),
				};
			}),
		);
		return {
			...battle,
			...(options.name?.trim() ? { name: options.name.trim() } : {}),
			combatants,
			activeTurnIndex: activeCombatantId
				? Math.max(0, combatants.findIndex((combatant) => combatant.id === activeCombatantId))
				: battle.activeTurnIndex,
			updatedAt: this.toIso(now),
		};
	}

	normalizeBattleEncounter(raw: Partial<BattleEncounter>): BattleEncounter {
		const createdAt = this.normalizeIso(raw.createdAt);
		const updatedAt = this.normalizeIso(raw.updatedAt ?? raw.createdAt);
		const referenceSheets = this.normalizeReferenceSheets(raw.referenceSheets);
		const combatants = this.orderCombatants(
			Array.isArray(raw.combatants)
				? raw.combatants.map((combatant, index) => this.normalizeCombatant(combatant, index))
				: [],
		);
		const pendingCombatants = Array.isArray(raw.pendingCombatants)
			? raw.pendingCombatants.map((combatant, index) =>
					this.normalizeCombatant(combatant, index, {
						pendingAdd: true,
					}),
				)
			: [];
		const lairActions = Array.isArray(raw.lairActions)
			? raw.lairActions.map((action, index) => this.normalizeLairAction(action, index))
			: [];
		const traps = Array.isArray(raw.traps)
			? raw.traps.map((trap, index) => this.normalizeTrap(trap, index))
			: [];
		const pendingActions = this.reconcilePendingActionsForCombatants(
			this.normalizePendingActions(raw.pendingActions),
			combatants,
			pendingCombatants,
		);

		return {
			id: typeof raw.id === 'string' ? raw.id : this.createId(),
			...(typeof raw.sourceEncounterId === 'string' && raw.sourceEncounterId.trim()
				? { sourceEncounterId: raw.sourceEncounterId }
				: {}),
			name: typeof raw.name === 'string' ? raw.name : 'Batalha local',
			description: typeof raw.description === 'string' ? raw.description : undefined,
			status:
				raw.status === 'active' || raw.status === 'paused' || raw.status === 'completed'
					? raw.status
					: 'active',
			round: Math.max(1, this.toNonNegativeInt(raw.round) || 1),
			activeTurnIndex: this.normalizeActiveTurnIndex(
				combatants,
				this.toNonNegativeInt(raw.activeTurnIndex),
				Math.max(1, this.toNonNegativeInt(raw.round) || 1),
			),
			createdAt,
			startedAt: this.normalizeIso(raw.startedAt ?? raw.createdAt),
			updatedAt,
			...(typeof raw.completedAt === 'string' ? { completedAt: raw.completedAt } : {}),
			...(typeof raw.turnStartedAt === 'string' ? { turnStartedAt: raw.turnStartedAt } : {}),
			currentTurnElapsedSeconds: this.toNonNegativeInt(raw.currentTurnElapsedSeconds),
			referenceSheets,
			combatants,
			pendingCombatants,
			lairActions,
			traps,
			turnHistory: this.normalizeTurnHistory(raw.turnHistory),
			dmNotes: typeof raw.dmNotes === 'string' ? raw.dmNotes : '',
			pendingActions,
			turnSnapshots: this.normalizeTurnSnapshots(raw.turnSnapshots),
		};
	}

	/**
	 * Replaces legacy stat-block projections with their linked canonical sheets while retaining
	 * combat-only state. This prevents obsolete snapshot spells and recovery rules from leaking
	 * into active battles after a sheet migration.
	 */
	refreshLinkedSheetSnapshots(
		battle: BattleEncounter,
		sheets: SavedSheetInterface[],
	): BattleEncounter {
		const sheetsById = new Map(sheets.map((sheet) => [sheet.id, sheet]));
		const refreshCombatant = (combatant: BattleCombatant) => {
			const matchingSheets = combatant.sourceSheetId
				? []
				: sheets.filter(
					(sheet) =>
						!!sheet.data.fiveEToolsIdentity &&
						(sheet.data.name === combatant.name || sheet.title === combatant.name),
				);
			const source = combatant.sourceSheetId
				? sheetsById.get(combatant.sourceSheetId)
				: matchingSheets.length === 1
					? matchingSheets[0]
					: undefined;
			if (!source) return combatant;
			const sheet = source.data;
			return {
				...combatant,
				...(combatant.sourceSheetId ? {} : { sourceSheetId: source.id }),
				category: source.category,
				armorClass: sheet.armorClass,
				maxHp: sheet.maxHp,
				currentHp: Math.min(combatant.currentHp, sheet.maxHp),
				specialAbilities: this.refreshRuntimeAbilities(
					combatant.specialAbilities,
					sheet.specialAbilities,
					sheet.features,
					combatant.features.length === 0,
				),
				spellSlots: this.refreshRuntimeSpellSlots(combatant.spellSlots, sheet.spellSlots),
				spells: structuredClone(sheet.spells),
				features: structuredClone(sheet.features),
			};
		};
		const combatants = battle.combatants.map(refreshCombatant);
		const pendingCombatants = battle.pendingCombatants.map(refreshCombatant);
		const referenceSheets = battle.referenceSheets.map((reference) => {
			const combatant = [...combatants, ...pendingCombatants].find(
				(candidate) => candidate.referenceSheetId === reference.id,
			);
			const source = combatant?.sourceSheetId ? sheetsById.get(combatant.sourceSheetId) : undefined;
			return source ? { ...reference, sheet: structuredClone(source.data) } : reference;
		});
		return this.normalizeBattleEncounter({
			...battle,
			combatants,
			pendingCombatants,
			referenceSheets,
			pendingActions: this.reconcilePendingActionsForCombatants(
				battle.pendingActions,
				combatants,
				pendingCombatants,
			),
			turnSnapshots: battle.turnSnapshots.map((snapshot) => ({
				...snapshot,
				state: {
					...snapshot.state,
					combatants: snapshot.state.combatants.map(refreshCombatant),
					pendingCombatants: snapshot.state.pendingCombatants.map(refreshCombatant),
				},
			})),
		});
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

	getInitiativeEligibleCombatants(battle: BattleEncounter): BattleCombatant[] {
		return battle.combatants.filter((combatant) =>
			this.isCombatantEligibleForInitiative(combatant, battle.round),
		);
	}

	getCurrentCombatant(battle: BattleEncounter): BattleCombatant | null {
		if (!battle.combatants.length || battle.activeTurnIndex < 0) return null;
		const current = battle.combatants[battle.activeTurnIndex] ?? null;
		if (current && this.isCombatantEligibleForInitiative(current, battle.round)) return current;
		const fallbackIndex = this.findFirstEligibleTurnIndex(battle.combatants, battle.round);
		return fallbackIndex >= 0 ? (battle.combatants[fallbackIndex] ?? null) : null;
	}

	getCurrentTurnElapsedSeconds(battle: BattleEncounter, now = new Date()): number {
		const base = this.toNonNegativeInt(battle.currentTurnElapsedSeconds);
		if (battle.status !== 'active' || !battle.turnStartedAt) return base;

		const startedAt = Date.parse(battle.turnStartedAt);
		if (Number.isNaN(startedAt)) return base;

		return base + Math.max(0, Math.floor((now.getTime() - startedAt) / 1000));
	}

	advanceTurn(battle: BattleEncounter, now = new Date(), notes?: string): BattleEncounter {
		if (!battle.combatants.length && !battle.pendingCombatants.length) {
			return this.touchBattle(battle, now);
		}
		const turnSnapshot = this.createTurnSnapshot(battle, now);

		if (!battle.combatants.length) {
			const timestamp = this.toIso(now);
			const resolution = this.resolveRoundStartChanges(
				[],
				battle.pendingCombatants,
				battle.round + 1,
			);
			return {
				...battle,
				round: battle.round + 1,
				activeTurnIndex: this.findFirstEligibleTurnIndex(resolution.combatants, battle.round + 1),
				updatedAt: timestamp,
				turnStartedAt: resolution.combatants.length ? timestamp : undefined,
				currentTurnElapsedSeconds: 0,
				combatants: resolution.combatants,
				pendingCombatants: resolution.pendingCombatants,
				turnHistory: [
					...battle.turnHistory,
					...resolution.messages.map((message) =>
						this.createSystemHistoryEntry(
							{
								round: battle.round + 1,
								turnIndex: Math.max(
									0,
									this.findFirstEligibleTurnIndex(resolution.combatants, battle.round + 1),
								),
							},
							timestamp,
							message,
						),
					),
				],
				turnSnapshots: this.appendTurnSnapshot(battle, turnSnapshot),
			};
		}

		const timestamp = this.toIso(now);
		const currentCombatant = this.getCurrentCombatant(battle);
		const durationSeconds = this.getCurrentTurnElapsedSeconds(battle, now);
		const currentTurnIndex =
			currentCombatant == null
				? -1
				: battle.combatants.findIndex((combatant) => combatant.id === currentCombatant.id);
		const endExpire = this.conditionService.expireConditionsAtTiming(
			battle.combatants,
			{ round: battle.round, turnIndex: Math.max(0, currentTurnIndex) },
			'end',
		);

		let nextTurnIndex = this.findNextEligibleTurnIndex(
			endExpire.combatants,
			Math.max(-1, currentTurnIndex),
			battle.round,
		);
		let nextRound = battle.round;
		let nextCombatants = endExpire.combatants;
		let nextPendingCombatants = battle.pendingCombatants;
		let roundStartMessages: string[] = [];
		const roundAdvanced =
			nextTurnIndex < 0 || (currentTurnIndex >= 0 && nextTurnIndex <= currentTurnIndex);

		if (roundAdvanced) {
			nextRound += 1;
			const resolution = this.resolveRoundStartChanges(
				endExpire.combatants,
				battle.pendingCombatants,
				nextRound,
			);
			nextCombatants = resolution.combatants;
			nextPendingCombatants = resolution.pendingCombatants;
			roundStartMessages = resolution.messages;
			nextTurnIndex = this.findFirstEligibleTurnIndex(nextCombatants, nextRound);
		}

		const startExpire = this.conditionService.expireConditionsAtTiming(
			nextCombatants,
			{ round: nextRound, turnIndex: Math.max(0, nextTurnIndex) },
			'start',
		);
		const cooldownAdvance = this.abilityService.advanceCooldowns(
			startExpire.combatants,
			roundAdvanced,
		);
		const encounterEventAdvance = this.advanceEncounterEventCooldowns(
			battle.lairActions,
			battle.traps,
			roundAdvanced,
		);

		const turnHistory = [...battle.turnHistory];
		if (currentCombatant) {
			turnHistory.push(
				this.createTurnHistoryEntry(battle, currentCombatant, timestamp, durationSeconds, notes),
			);
		}

		for (const message of [
			...endExpire.messages,
			...roundStartMessages,
			...startExpire.messages,
			...cooldownAdvance.messages,
			...encounterEventAdvance.messages,
		]) {
			turnHistory.push(
				this.createSystemHistoryEntry(
					{
						round: nextRound,
						turnIndex: nextTurnIndex,
					},
					timestamp,
					message,
				),
			);
		}

		return this.ensureDeathSavePendingAction({
			...battle,
			round: nextRound,
			activeTurnIndex: nextTurnIndex,
			updatedAt: timestamp,
			turnStartedAt: nextTurnIndex >= 0 ? timestamp : undefined,
			currentTurnElapsedSeconds: 0,
			combatants: cooldownAdvance.combatants,
			pendingCombatants: nextPendingCombatants,
			lairActions: encounterEventAdvance.lairActions,
			traps: encounterEventAdvance.traps,
			turnHistory,
			pendingActions: this.reconcilePendingActionsForCombatants(
				battle.pendingActions,
				cooldownAdvance.combatants,
				nextPendingCombatants,
			),
			turnSnapshots: this.appendTurnSnapshot(battle, turnSnapshot),
		});
	}

	undoTurn(battle: BattleEncounter, now = new Date()): BattleEncounter {
		const snapshot = battle.turnSnapshots?.at(-1);
		if (!snapshot) return battle;

		const state = structuredClone(snapshot.state);
		const timestamp = this.toIso(now);

		return {
			...battle,
			status: state.status,
			round: state.round,
			activeTurnIndex: state.activeTurnIndex,
			updatedAt: timestamp,
			completedAt: state.completedAt,
			turnStartedAt:
				state.status === 'active' && state.activeTurnIndex >= 0 ? timestamp : undefined,
			currentTurnElapsedSeconds: 0,
			combatants: state.combatants,
			pendingCombatants: state.pendingCombatants,
			lairActions: state.lairActions,
			traps: state.traps,
			turnHistory: state.turnHistory,
			dmNotes: state.dmNotes,
			pendingActions: state.pendingActions,
			turnSnapshots: battle.turnSnapshots.slice(0, -1),
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
		const activeTurnIndex = this.normalizeActiveTurnIndex(
			battle.combatants,
			battle.activeTurnIndex,
			battle.round,
		);
		return {
			...battle,
			status: 'active',
			updatedAt: timestamp,
			activeTurnIndex,
			turnStartedAt: activeTurnIndex >= 0 ? timestamp : undefined,
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
		patch: Partial<BattleCombatant>,
	): BattleEncounter {
		return this.reconcilePendingActions(
			this.mapCombatant(battle, combatantId, (combatant) => ({
				...combatant,
				...patch,
			})),
		);
	}

	updateCombatantHp(
		battle: BattleEncounter,
		combatantId: string,
		patch: Partial<Pick<BattleCombatant, 'currentHp' | 'maxHp' | 'temporaryHp'>>,
	): BattleEncounter {
		const updatedBattle = this.mapCombatant(battle, combatantId, (combatant) => {
			const maxHp = patch.maxHp == null ? combatant.maxHp : this.toNonNegativeInt(patch.maxHp);
			const currentHpRaw =
				patch.currentHp == null ? combatant.currentHp : this.toNonNegativeInt(patch.currentHp);
			const temporaryHp =
				patch.temporaryHp == null
					? combatant.temporaryHp
					: this.toNonNegativeInt(patch.temporaryHp);

			const currentHp = Math.min(currentHpRaw, maxHp);
			const defeatedState = this.resolveDefeatedState(battle, combatant, currentHp);
			return {
				...combatant,
				maxHp,
				currentHp,
				temporaryHp,
				defeated: defeatedState.defeated,
				collapsed: defeatedState.collapsed,
				inactiveUntilRound: defeatedState.inactiveUntilRound,
			};
		});
		const updatedCombatant = this.findCombatant(updatedBattle, combatantId);
		const resolvedBattle = updatedCombatant?.defeated
			? this.stopConcentration(updatedBattle, combatantId)
			: updatedBattle;
		return this.reconcilePendingActions(resolvedBattle);
	}

	addCombatantFromParticipant(
		battle: BattleEncounter,
		participant: EncounterParticipant,
		overrides?: AddCombatantOverrides,
		now = new Date(),
	): BattleEncounter {
		const joinsAtRound = this.shouldQueueCombatantForNextRound(battle)
			? battle.round + 1
			: undefined;
		const referenceSheet = this.createReferenceSheet(participant.sheet);
		const combatant = this.createCombatantFromParticipant(
			participant,
			battle.combatants.length,
			undefined,
			{
				...overrides,
				referenceSheetId: referenceSheet.id,
				pendingAdd: joinsAtRound != null,
				joinsAtRound,
			},
		);

		return {
			...this.insertCombatant(battle, combatant, now),
			referenceSheets: [...battle.referenceSheets, referenceSheet],
		};
	}

	duplicateCombatant(
		battle: BattleEncounter,
		combatantId: string,
		now = new Date(),
	): BattleEncounter {
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
				deathSaves: undefined,
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
						usedCount: 0,
						currentCooldownRounds: 0,
						currentCooldownTurns: 0,
						lastUsedAtRound: undefined,
						lastUsedAtTurnIndex: undefined,
						lastUsedAt: undefined,
						lastRechargeRoll: undefined,
						lastRechargeAttemptAtRound: undefined,
					}),
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
			},
		);

		return this.insertCombatant(battle, duplicate, now);
	}

	removeCombatant(battle: BattleEncounter, combatantId: string, now = new Date()): BattleEncounter {
		const timestamp = this.toIso(now);
		const pendingIndex = battle.pendingCombatants.findIndex(
			(combatant) => combatant.id === combatantId,
		);
		if (pendingIndex >= 0) {
			return {
				...battle,
				updatedAt: timestamp,
				pendingCombatants: battle.pendingCombatants.filter(
					(combatant) => combatant.id !== combatantId,
				),
				pendingActions: battle.pendingActions.filter(
					(action) => action.combatantId !== combatantId,
				),
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
				pendingActions: battle.pendingActions.filter(
					(action) => action.combatantId !== combatantId,
				),
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
				const resolution = this.resolveRoundStartChanges(combatants, pendingCombatants, round);
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
							message,
						),
					);
				}
			} else {
				activeTurnIndex = activeIndex;
			}
		}

		return {
			...battle,
			round,
			activeTurnIndex: this.normalizeActiveTurnIndex(combatants, activeTurnIndex, round),
			updatedAt: timestamp,
			turnStartedAt:
				battle.status === 'active' &&
				this.normalizeActiveTurnIndex(combatants, activeTurnIndex, round) >= 0
					? timestamp
					: undefined,
			currentTurnElapsedSeconds: 0,
			combatants,
			pendingCombatants,
			turnHistory,
			pendingActions: this.reconcilePendingActionsForCombatants(
				battle.pendingActions.filter((action) => action.combatantId !== combatantId),
				combatants,
				pendingCombatants,
			),
		};
	}

	scheduleCombatantInitiative(
		battle: BattleEncounter,
		combatantId: string,
		initiative: number,
	): BattleEncounter {
		const normalizedInitiative = this.toFiniteNumber(initiative);
		const pending = battle.pendingCombatants.some((combatant) => combatant.id === combatantId);
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			initiative: pending ? normalizedInitiative : combatant.initiative,
			nextRoundInitiative: pending ? undefined : normalizedInitiative,
		}));
	}

	scheduleCombatantInitiativeTieBreaker(
		battle: BattleEncounter,
		combatantId: string,
		initiativeTieBreaker: number | undefined,
	): BattleEncounter {
		const pending = battle.pendingCombatants.some((combatant) => combatant.id === combatantId);
		const normalizedTieBreaker =
			initiativeTieBreaker == null ? undefined : this.toFiniteNumber(initiativeTieBreaker);
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			initiativeTieBreaker: pending ? normalizedTieBreaker : combatant.initiativeTieBreaker,
			nextRoundInitiativeTieBreaker: pending ? undefined : (normalizedTieBreaker ?? null),
		}));
	}

	clearScheduledCombatantInitiative(battle: BattleEncounter, combatantId: string): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			nextRoundInitiative: undefined,
		}));
	}

	clearScheduledCombatantInitiativeTieBreaker(
		battle: BattleEncounter,
		combatantId: string,
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			nextRoundInitiativeTieBreaker: undefined,
		}));
	}

	applyDamage(battle: BattleEncounter, combatantId: string, amount: number): BattleEncounter {
		const damage = this.toNonNegativeInt(amount);
		if (!damage) return battle;
		const combatant = this.findCombatant(battle, combatantId);
		if (!combatant) return battle;

		const damagedBattle = this.mapCombatant(battle, combatantId, (target) => {
			const absorbed = Math.min(target.temporaryHp, damage);
			const remainingDamage = damage - absorbed;
			const temporaryHp = target.temporaryHp - absorbed;
			const currentHp = Math.max(0, target.currentHp - remainingDamage);

			return {
				...target,
				currentHp,
				temporaryHp,
				...this.resolveDefeatedState(battle, target, currentHp),
			};
		});
		const updatedCombatant = this.findCombatant(damagedBattle, combatantId);
		if (!updatedCombatant) return damagedBattle;
		if (updatedCombatant.defeated) return this.stopConcentration(damagedBattle, combatantId);
		if (!this.isConcentrating(combatant)) return damagedBattle;

		return {
			...damagedBattle,
			pendingActions: [
				...damagedBattle.pendingActions,
				this.createConcentrationCheck(combatantId, damage, damagedBattle),
			],
		};
	}

	applyHealing(battle: BattleEncounter, combatantId: string, amount: number): BattleEncounter {
		const healing = this.toNonNegativeInt(amount);
		if (!healing) return battle;

		return this.mapCombatant(battle, combatantId, (combatant) => {
			const currentHp = Math.min(combatant.maxHp, combatant.currentHp + healing);
			const defeatedState = this.resolveDefeatedState(battle, combatant, currentHp);
			return {
				...combatant,
				currentHp,
				defeated: defeatedState.defeated,
				collapsed: defeatedState.collapsed,
				inactiveUntilRound: defeatedState.inactiveUntilRound,
			};
		});
	}

	setCombatantDefeated(
		battle: BattleEncounter,
		combatantId: string,
		defeated: boolean,
	): BattleEncounter {
		const updatedBattle = this.mapCombatant(battle, combatantId, (combatant) => {
			const autoDefeat = this.shouldAutoDefeatCombatant(combatant);
			const enforcedDefeated = autoDefeat && combatant.currentHp <= 0 ? true : defeated;
			const inactiveUntilRound =
				!enforcedDefeated && combatant.defeated
					? this.getNextRoundForReentry(battle)
					: enforcedDefeated
						? undefined
						: combatant.inactiveUntilRound;
			return {
				...combatant,
				defeated: enforcedDefeated,
				collapsed: enforcedDefeated ? true : combatant.defeated ? false : combatant.collapsed,
				inactiveUntilRound,
			};
		});
		const updatedCombatant = this.findCombatant(updatedBattle, combatantId);
		return updatedCombatant?.defeated
			? this.stopConcentration(updatedBattle, combatantId)
			: updatedBattle;
	}

	updateCombatantNotes(
		battle: BattleEncounter,
		combatantId: string,
		privateNotes: string,
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			privateNotes,
		}));
	}

	addCondition(
		battle: BattleEncounter,
		combatantId: string,
		input: CreateBattleConditionInput,
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
		conditionId: string,
	): BattleEncounter {
		const updatedBattle = this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			conditions: combatant.conditions.filter((condition) => condition.id !== conditionId),
		}));
		return this.reconcilePendingActions(updatedBattle);
	}

	startConcentration(battle: BattleEncounter, combatantId: string): BattleEncounter {
		const combatant = this.findCombatant(battle, combatantId);
		if (!combatant || combatant.defeated || this.isConcentrating(combatant)) return battle;

		return this.addCondition(battle, combatantId, {
			name: 'concentrating',
			label: 'Concentrando / Concentrating',
			durationType: 'manual',
		});
	}

	stopConcentration(battle: BattleEncounter, combatantId: string): BattleEncounter {
		const withoutCondition = this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			conditions: combatant.conditions.filter((condition) => condition.name !== 'concentrating'),
		}));
		if (withoutCondition === battle) return battle;

		return {
			...withoutCondition,
			pendingActions: withoutCondition.pendingActions.filter(
				(action) => action.type !== 'concentration-check' || action.combatantId !== combatantId,
			),
		};
	}

	canUseDeathSaves(combatant: Pick<BattleCombatant, 'category' | 'side'>): boolean {
		return (
			combatant.category === 'pc' || (combatant.category === 'npc' && combatant.side !== 'enemy')
		);
	}

	startDeathSaves(battle: BattleEncounter, combatantId: string): BattleEncounter {
		const combatant = this.findCombatant(battle, combatantId);
		if (!combatant || !this.canUseDeathSaves(combatant) || combatant.deathSaves) return battle;

		const startedBattle = this.mapCombatant(battle, combatantId, (target) => ({
			...target,
			defeated: false,
			collapsed: true,
			deathSaves: { status: 'active', successes: 0, failures: 0 },
		}));
		return this.stopConcentration(startedBattle, combatantId);
	}

	recordDeathSaveResult(
		battle: BattleEncounter,
		actionId: string,
		roll: number,
	): { battle: BattleEncounter; roll: number; outcome: DeathSaveOutcome } | null {
		if (!Number.isInteger(roll) || roll < 1 || roll > 20) return null;
		const action = battle.pendingActions.find(
			(item): item is BattleDeathSavePendingAction =>
				item.id === actionId && item.type === 'death-save',
		);
		if (!action) return null;

		const combatant = this.findCombatant(battle, action.combatantId);
		if (
			!combatant ||
			!this.canUseDeathSaves(combatant) ||
			combatant.deathSaves?.status !== 'active'
		) {
			return null;
		}

		const withoutAction = {
			...battle,
			pendingActions: battle.pendingActions.filter((item) => item.id !== actionId),
		};
		if (roll === 20) {
			return {
				battle: this.mapCombatant(withoutAction, action.combatantId, (target) => ({
					...target,
					defeated: false,
					collapsed: false,
					deathSaves: undefined,
				})),
				roll,
				outcome: 'natural-20',
			};
		}

		const failures = combatant.deathSaves.failures + (roll === 1 ? 2 : roll < 10 ? 1 : 0);
		const successes = combatant.deathSaves.successes + (roll >= 10 ? 1 : 0);
		const status = failures >= 3 ? 'dead' : successes >= 3 ? 'stable' : 'active';
		const outcome: DeathSaveOutcome =
			status === 'dead'
				? 'dead'
				: status === 'stable'
					? 'stable'
					: roll >= 10
						? 'success'
						: 'failure';

		return {
			battle: this.mapCombatant(withoutAction, action.combatantId, (target) => ({
				...target,
				defeated: status === 'dead',
				collapsed: status === 'dead' ? true : target.collapsed,
				deathSaves: { status, successes: Math.min(3, successes), failures: Math.min(3, failures) },
			})),
			roll,
			outcome,
		};
	}

	addDeathSaveFailures(
		battle: BattleEncounter,
		combatantId: string,
		amount: number,
	): BattleEncounter {
		const failuresToAdd = this.toNonNegativeInt(amount);
		const combatant = this.findCombatant(battle, combatantId);
		if (
			!failuresToAdd ||
			!combatant ||
			!this.canUseDeathSaves(combatant) ||
			(combatant.deathSaves?.status !== 'active' && combatant.deathSaves?.status !== 'stable')
		) {
			return battle;
		}

		const deathsSaves = combatant.deathSaves;
		const failures = Math.min(3, deathsSaves.failures + failuresToAdd);
		const status = failures >= 3 ? 'dead' : 'active';
		const updatedBattle = this.mapCombatant(battle, combatantId, (target) => ({
			...target,
			defeated: status === 'dead',
			collapsed: status === 'dead' ? true : target.collapsed,
			deathSaves: {
				status,
				successes: deathsSaves.status === 'stable' ? 0 : deathsSaves.successes,
				failures,
			},
		}));
		return this.reconcilePendingActions(updatedBattle);
	}

	addDeathSaveSuccess(battle: BattleEncounter, combatantId: string): BattleEncounter {
		const combatant = this.findCombatant(battle, combatantId);
		if (
			!combatant ||
			!this.canUseDeathSaves(combatant) ||
			combatant.deathSaves?.status !== 'active'
		) {
			return battle;
		}

		const successes = Math.min(3, combatant.deathSaves.successes + 1);
		const status = successes >= 3 ? 'stable' : 'active';
		const updatedBattle = this.mapCombatant(battle, combatantId, (target) => ({
			...target,
			deathSaves: { ...combatant.deathSaves!, status, successes },
		}));
		return this.reconcilePendingActions(updatedBattle);
	}

	recoverFromDeathSaves(battle: BattleEncounter, combatantId: string): BattleEncounter {
		const combatant = this.findCombatant(battle, combatantId);
		if (!combatant?.deathSaves) return battle;

		const recoveredBattle = this.mapCombatant(battle, combatantId, (target) => ({
			...target,
			defeated: false,
			collapsed: false,
			inactiveUntilRound: target.defeated
				? this.getNextRoundForReentry(battle)
				: target.inactiveUntilRound,
			deathSaves: undefined,
		}));
		return this.reconcilePendingActions(recoveredBattle);
	}

	resolveConcentrationCheck(
		battle: BattleEncounter,
		actionId: string,
		succeeded: boolean,
	): { battle: BattleEncounter; succeeded: boolean } | null {
		const action = battle.pendingActions.find(
			(item): item is BattleConcentrationCheckPendingAction =>
				item.id === actionId && item.type === 'concentration-check',
		);
		if (!action) return null;

		const withoutAction = {
			...battle,
			pendingActions: battle.pendingActions.filter((item) => item.id !== actionId),
		};
		return {
			battle: succeeded ? withoutAction : this.stopConcentration(withoutAction, action.combatantId),
			succeeded,
		};
	}

	describeConditionDuration(condition: BattleCondition, battle: BattleEncounter): string {
		return this.conditionService.describeConditionDuration(condition, battle);
	}

	useSpecialAbility(
		battle: BattleEncounter,
		combatantId: string,
		abilityId: string,
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			specialAbilities: combatant.specialAbilities.map((ability) =>
				ability.id === abilityId ? this.abilityService.useAbility(ability, battle) : ability,
			),
		}));
	}

	resetSpecialAbility(
		battle: BattleEncounter,
		combatantId: string,
		abilityId: string,
	): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			specialAbilities: combatant.specialAbilities.map((ability) =>
				ability.id === abilityId ? this.abilityService.resetAbility(ability) : ability,
			),
		}));
	}

	recordSpecialAbilityRecharge(
		battle: BattleEncounter,
		combatantId: string,
		abilityId: string,
		roll: number,
	): { battle: BattleEncounter; roll: number; success: boolean } | null {
		if (!this.canAttemptSpecialAbilityRecharge(battle, combatantId, abilityId)) return null;

		let result: { roll: number; success: boolean } | null = null;
		const nextBattle = this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			specialAbilities: combatant.specialAbilities.map((ability) => {
				if (ability.id !== abilityId) return ability;
				const rolled = this.abilityService.recordRechargeResult(ability, battle.round, roll);
				if (!rolled) return ability;
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

	rollSpecialAbilityRecharge(
		battle: BattleEncounter,
		combatantId: string,
		abilityId: string,
	): { battle: BattleEncounter; roll: number; success: boolean } | null {
		if (!this.canAttemptSpecialAbilityRecharge(battle, combatantId, abilityId)) return null;

		let result: { roll: number; success: boolean } | null = null;
		const nextBattle = this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			specialAbilities: combatant.specialAbilities.map((ability) => {
				if (ability.id !== abilityId) return ability;
				const rolled = this.abilityService.rollRecharge(ability, battle.round);
				if (!rolled) return ability;
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

	canAttemptSpecialAbilityRecharge(
		battle: BattleEncounter,
		combatantId: string,
		abilityId: string,
	): boolean {
		const currentCombatant = this.getCurrentCombatant(battle);
		if (!currentCombatant || currentCombatant.id !== combatantId) return false;

		const currentTurnIndex = battle.combatants.findIndex(
			(combatant) => combatant.id === currentCombatant.id,
		);
		const ability = currentCombatant.specialAbilities.find((item) => item.id === abilityId);
		if (!ability) return false;

		const usedThisTurn =
			ability.lastUsedAtRound === battle.round && ability.lastUsedAtTurnIndex === currentTurnIndex;
		return !usedThisTurn && this.abilityService.canAttemptRecharge(ability, battle.round);
	}

	getPendingDiceRechargeAbilities(battle: BattleEncounter): BattleSpecialAbility[] {
		const currentCombatant = this.getCurrentCombatant(battle);
		if (!currentCombatant) return [];
		return currentCombatant.specialAbilities.filter((ability) =>
			this.canAttemptSpecialAbilityRecharge(battle, currentCombatant.id, ability.id),
		);
	}

	getPendingActions(battle: BattleEncounter): BattlePendingAction[] {
		const currentCombatant = this.getCurrentCombatant(battle);
		const diceRechargeActions =
			battle.status === 'active' && currentCombatant
				? this.getPendingDiceRechargeAbilities(battle).map((ability) => ({
						id: `dice-recharge-${currentCombatant.id}-${ability.id}`,
						type: 'dice-recharge' as const,
						combatantId: currentCombatant.id,
						abilityId: ability.id,
						abilityName: ability.name,
						rechargeOn: ability.rechargeOn ?? [5, 6],
						createdAtRound: ability.lastUsedAtRound ?? battle.round,
						createdAtTurnIndex: ability.lastUsedAtTurnIndex ?? battle.activeTurnIndex,
						priority: 100,
					}))
				: [];

		return [...battle.pendingActions, ...diceRechargeActions].sort(
			(left, right) =>
				right.priority - left.priority ||
				left.createdAtRound - right.createdAtRound ||
				left.createdAtTurnIndex - right.createdAtTurnIndex,
		);
	}

	describeAbilityStatus(ability: BattleSpecialAbility): string {
		return this.abilityService.describeAbilityStatus(ability);
	}

	describeAbilityUsage(ability: BattleSpecialAbility): string | null {
		return this.abilityService.describeAbilityUsage(ability);
	}

	describeAbilityRecovery(ability: BattleSpecialAbility): string {
		return this.abilityService.describeAbilityRecovery(ability);
	}

	describeAbilityRule(ability: BattleSpecialAbility): string | null {
		return this.abilityService.describeAbilityRule(ability);
	}

	describeAbilityLastUsed(ability: BattleSpecialAbility): string | null {
		return this.abilityService.describeAbilityLastUsed(ability);
	}

	describeDiceRechargeAttempt(
		ability: BattleSpecialAbility,
		battle: BattleEncounter,
	): string | null {
		return this.abilityService.describeDiceRechargeAttempt(ability, battle.round);
	}

	addLairAction(battle: BattleEncounter, input: CreateBattleLairActionInput): BattleEncounter {
		const action: BattleLairAction = {
			id: this.createId(),
			name: input.name.trim() || 'Lair Action',
			description: (input.description || '').trim() || undefined,
			initiative: this.toFiniteNumber(input.initiative ?? 20),
			active: true,
			frequency: input.frequency,
			cooldownRounds:
				input.frequency === 'cooldown-rounds'
					? Math.max(1, this.toNonNegativeInt(input.cooldownRounds) || 1)
					: undefined,
			currentCooldownRounds: 0,
		};

		return {
			...battle,
			updatedAt: this.toIso(new Date()),
			lairActions: [...battle.lairActions, action],
		};
	}

	updateLairActionActive(
		battle: BattleEncounter,
		actionId: string,
		active: boolean,
	): BattleEncounter {
		return {
			...battle,
			updatedAt: this.toIso(new Date()),
			lairActions: battle.lairActions.map((action) =>
				action.id === actionId ? { ...action, active } : action,
			),
		};
	}

	triggerLairAction(battle: BattleEncounter, actionId: string, now = new Date()): BattleEncounter {
		const timestamp = this.toIso(now);
		let triggeredName: string | null = null;
		const lairActions = battle.lairActions.map((action) => {
			if (action.id !== actionId || !action.active || (action.currentCooldownRounds ?? 0) > 0) {
				return action;
			}
			triggeredName = action.name;
			if (action.frequency === 'cooldown-rounds') {
				return {
					...action,
					currentCooldownRounds: Math.max(1, action.cooldownRounds ?? 1),
					lastTriggeredAtRound: battle.round,
				};
			}
			return {
				...action,
				lastTriggeredAtRound: battle.round,
			};
		});

		if (!triggeredName) return battle;
		return {
			...battle,
			updatedAt: timestamp,
			lairActions,
			turnHistory: [
				...battle.turnHistory,
				this.createSystemHistoryEntry(
					{ round: battle.round, turnIndex: Math.max(0, battle.activeTurnIndex) },
					timestamp,
					`Ação de covil executada: ${triggeredName}.`,
				),
			],
		};
	}

	removeLairAction(battle: BattleEncounter, actionId: string): BattleEncounter {
		return {
			...battle,
			updatedAt: this.toIso(new Date()),
			lairActions: battle.lairActions.filter((action) => action.id !== actionId),
		};
	}

	addTrap(battle: BattleEncounter, input: CreateBattleTrapInput): BattleEncounter {
		const trap: BattleTrap = {
			id: this.createId(),
			name: input.name.trim() || 'Armadilha',
			description: (input.description || '').trim() || undefined,
			triggerType: input.triggerType,
			initiative:
				input.triggerType === 'initiative'
					? this.toFiniteNumber(input.initiative ?? 20)
					: undefined,
			active: true,
			frequency: input.frequency,
			cooldownRounds:
				input.frequency === 'cooldown-rounds'
					? Math.max(1, this.toNonNegativeInt(input.cooldownRounds) || 1)
					: undefined,
			currentCooldownRounds: 0,
		};

		return {
			...battle,
			updatedAt: this.toIso(new Date()),
			traps: [...battle.traps, trap],
		};
	}

	updateTrapActive(battle: BattleEncounter, trapId: string, active: boolean): BattleEncounter {
		return {
			...battle,
			updatedAt: this.toIso(new Date()),
			traps: battle.traps.map((trap) => (trap.id === trapId ? { ...trap, active } : trap)),
		};
	}

	triggerTrap(battle: BattleEncounter, trapId: string, now = new Date()): BattleEncounter {
		const timestamp = this.toIso(now);
		let triggeredName: string | null = null;
		const traps = battle.traps.map((trap) => {
			if (trap.id !== trapId || !trap.active || (trap.currentCooldownRounds ?? 0) > 0) {
				return trap;
			}
			triggeredName = trap.name;
			if (trap.frequency === 'once') {
				return {
					...trap,
					active: false,
					lastTriggeredAtRound: battle.round,
				};
			}
			if (trap.frequency === 'cooldown-rounds') {
				return {
					...trap,
					currentCooldownRounds: Math.max(1, trap.cooldownRounds ?? 1),
					lastTriggeredAtRound: battle.round,
				};
			}
			return {
				...trap,
				lastTriggeredAtRound: battle.round,
			};
		});

		if (!triggeredName) return battle;
		return {
			...battle,
			updatedAt: timestamp,
			traps,
			turnHistory: [
				...battle.turnHistory,
				this.createSystemHistoryEntry(
					{ round: battle.round, turnIndex: Math.max(0, battle.activeTurnIndex) },
					timestamp,
					`Armadilha disparada: ${triggeredName}.`,
				),
			],
		};
	}

	removeTrap(battle: BattleEncounter, trapId: string): BattleEncounter {
		return {
			...battle,
			updatedAt: this.toIso(new Date()),
			traps: battle.traps.filter((trap) => trap.id !== trapId),
		};
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
		spellSlotsCollapsed: boolean,
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
		max: number,
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
		used: number,
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
		steps: number,
	): { round: number; turnIndex: number } {
		return this.conditionService.advancePosition(
			battle.round,
			Math.max(0, battle.activeTurnIndex),
			steps,
			Math.max(1, battle.combatants.length),
		);
	}

	private mapCombatant(
		battle: BattleEncounter,
		combatantId: string,
		updater: (combatant: BattleCombatant) => BattleCombatant,
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
		overrides?: Partial<Pick<BattleCombatant, 'pendingAdd'>>,
	): BattleCombatant {
		const maxHp = this.toNonNegativeInt(raw.maxHp);
		const currentHp = Math.min(
			this.toNonNegativeInt(raw.currentHp),
			maxHp || this.toNonNegativeInt(raw.currentHp),
		);
		const pendingAdd = overrides?.pendingAdd ?? raw.pendingAdd === true;
		const category = this.normalizeCreatureCategory(raw.category);
		const side = this.normalizeSide(raw.side);
		const autoDefeat = this.shouldAutoDefeatCombatant({ category, side });
		const deathSaves = this.canUseDeathSaves({ category, side })
			? this.normalizeDeathSaveState(raw.deathSaves)
			: undefined;
		return {
			id: typeof raw.id === 'string' ? raw.id : this.createId(),
			sourceParticipantId:
				typeof raw.sourceParticipantId === 'string' ? raw.sourceParticipantId : undefined,
			sourceSheetId: typeof raw.sourceSheetId === 'string' ? raw.sourceSheetId : undefined,
			referenceSheetId:
				typeof raw.referenceSheetId === 'string' && raw.referenceSheetId.trim()
					? raw.referenceSheetId
					: undefined,
			name: typeof raw.name === 'string' ? raw.name : `Combatente ${sourceIndex + 1}`,
			displayName: typeof raw.displayName === 'string' ? raw.displayName : undefined,
			category,
			side,
			initiative: this.toFiniteNumber(raw.initiative),
			nextRoundInitiative:
				raw.nextRoundInitiative == null ? undefined : this.toFiniteNumber(raw.nextRoundInitiative),
			initiativeTieBreaker:
				raw.initiativeTieBreaker == null
					? undefined
					: this.toFiniteNumber(raw.initiativeTieBreaker),
			nextRoundInitiativeTieBreaker:
				raw.nextRoundInitiativeTieBreaker === undefined
					? undefined
					: raw.nextRoundInitiativeTieBreaker === null
						? null
						: this.toFiniteNumber(raw.nextRoundInitiativeTieBreaker),
			turnOrder: this.toNonNegativeInt(raw.turnOrder),
			armorClass: this.toArmorClass(raw.armorClass),
			maxHp,
			currentHp,
			temporaryHp: this.toNonNegativeInt(raw.temporaryHp),
			defeated:
				raw.defeated === true || deathSaves?.status === 'dead' || (autoDefeat && currentHp <= 0),
			hidden: raw.hidden === true,
			inactiveUntilRound:
				raw.inactiveUntilRound == null
					? undefined
					: Math.max(1, this.toNonNegativeInt(raw.inactiveUntilRound) || 1),
			collapsed: raw.collapsed === true,
			spellSlotsCollapsed: raw.spellSlotsCollapsed !== false,
			pendingAdd,
			joinsAtRound:
				raw.joinsAtRound == null
					? undefined
					: Math.max(1, this.toNonNegativeInt(raw.joinsAtRound) || 1),
			conditions: Array.isArray(raw.conditions)
				? raw.conditions.map((condition) => this.conditionService.normalizeCondition(condition))
				: [],
			...(deathSaves ? { deathSaves } : {}),
			specialAbilities: Array.isArray(raw.specialAbilities)
				? raw.specialAbilities.map((ability) => this.abilityService.normalizeAbility(ability))
				: [],
			spellSlots: this.spellSlotService.normalizeSpellSlots(raw.spellSlots),
			spells: this.normalizeSpells(raw.spells),
			features: this.normalizeFeatures(raw.features),
			...(this.normalizeDamageDefenses(raw.damageVulnerabilities)
				? { damageVulnerabilities: this.normalizeDamageDefenses(raw.damageVulnerabilities) }
				: {}),
			...(this.normalizeDamageDefenses(raw.damageResistances)
				? { damageResistances: this.normalizeDamageDefenses(raw.damageResistances) }
				: {}),
			...(this.normalizeDamageDefenses(raw.damageImmunities)
				? { damageImmunities: this.normalizeDamageDefenses(raw.damageImmunities) }
				: {}),
			...(this.normalizeStringList(raw.conditionImmunities)
				? { conditionImmunities: this.normalizeStringList(raw.conditionImmunities) }
				: {}),
			privateNotes: typeof raw.privateNotes === 'string' ? raw.privateNotes : undefined,
		};
	}

	private normalizeLairAction(
		raw: Partial<BattleLairAction>,
		sourceIndex: number,
	): BattleLairAction {
		const frequency =
			raw.frequency === 'every-round' ||
			raw.frequency === 'cooldown-rounds' ||
			raw.frequency === 'manual'
				? raw.frequency
				: 'every-round';
		return {
			id: typeof raw.id === 'string' ? raw.id : `lair-action-${sourceIndex + 1}`,
			name: typeof raw.name === 'string' ? raw.name : `Lair Action ${sourceIndex + 1}`,
			description: typeof raw.description === 'string' ? raw.description : undefined,
			initiative: this.toFiniteNumber(raw.initiative ?? 20),
			active: raw.active !== false,
			frequency,
			cooldownRounds:
				frequency === 'cooldown-rounds'
					? Math.max(1, this.toNonNegativeInt(raw.cooldownRounds) || 1)
					: undefined,
			currentCooldownRounds: this.toNonNegativeInt(raw.currentCooldownRounds),
			lastTriggeredAtRound: this.toPositiveIntOrUndefined(raw.lastTriggeredAtRound),
		};
	}

	private normalizeTrap(raw: Partial<BattleTrap>, sourceIndex: number): BattleTrap {
		const triggerType =
			raw.triggerType === 'initiative' ||
			raw.triggerType === 'round-start' ||
			raw.triggerType === 'round-end' ||
			raw.triggerType === 'manual'
				? raw.triggerType
				: 'manual';
		const frequency =
			raw.frequency === 'once' ||
			raw.frequency === 'every-round' ||
			raw.frequency === 'cooldown-rounds' ||
			raw.frequency === 'manual'
				? raw.frequency
				: 'manual';
		return {
			id: typeof raw.id === 'string' ? raw.id : `trap-${sourceIndex + 1}`,
			name: typeof raw.name === 'string' ? raw.name : `Armadilha ${sourceIndex + 1}`,
			description: typeof raw.description === 'string' ? raw.description : undefined,
			triggerType,
			initiative:
				triggerType === 'initiative' ? this.toFiniteNumber(raw.initiative ?? 20) : undefined,
			active: raw.active !== false,
			frequency,
			cooldownRounds:
				frequency === 'cooldown-rounds'
					? Math.max(1, this.toNonNegativeInt(raw.cooldownRounds) || 1)
					: undefined,
			currentCooldownRounds: this.toNonNegativeInt(raw.currentCooldownRounds),
			lastTriggeredAtRound: this.toPositiveIntOrUndefined(raw.lastTriggeredAtRound),
		};
	}

	private mapEncounterLairActions(actions: EncounterLairAction[] | undefined): BattleLairAction[] {
		if (!Array.isArray(actions)) return [];
		return actions.map((action, index) =>
			this.normalizeLairAction(
				{
					...structuredClone(action),
					currentCooldownRounds: 0,
					lastTriggeredAtRound: undefined,
				},
				index,
			),
		);
	}

	private mapEncounterTraps(traps: EncounterTrap[] | undefined): BattleTrap[] {
		if (!Array.isArray(traps)) return [];
		return traps.map((trap, index) =>
			this.normalizeTrap(
				{
					...structuredClone(trap),
					currentCooldownRounds: 0,
					lastTriggeredAtRound: undefined,
				},
				index,
			),
		);
	}

	private createCombatantFromParticipant(
		participant: EncounterParticipant,
		sourceIndex: number,
		options?: BattleEncounterCreateOptions,
		overrides?: AddCombatantOverrides,
	): BattleCombatant {
		const sheet = participant.sheet;
		const category = this.normalizeCreatureCategory(overrides?.category ?? participant.category);
		const maxHp = this.toNonNegativeInt(overrides?.maxHp ?? sheet.maxHp);
		const currentHp = Math.min(this.toNonNegativeInt(overrides?.currentHp ?? maxHp), maxHp);
		const temporaryHp = this.toNonNegativeInt(overrides?.temporaryHp ?? 0);
		const side =
			overrides?.side ??
			options?.combatantSides?.[participant.id] ??
			participant.side ??
			this.inferSideFromCategory(category);
		const autoDefeat = this.shouldAutoDefeatCombatant({ category, side });
		const initiativeOverride = options?.initiativeOverrides?.[participant.id];
		const initiativeTieBreaker =
			overrides?.initiativeTieBreaker ?? options?.initiativeTieBreakerOverrides?.[participant.id];
		const initiative =
			overrides?.initiative ??
			(initiativeOverride == null ? participant.initiative : initiativeOverride);

		return {
			id: this.createId(),
			sourceParticipantId: overrides?.sourceParticipantId ?? participant.id,
			sourceSheetId: overrides?.sourceSheetId ?? participant.sourceSheetId,
			referenceSheetId: overrides?.referenceSheetId,
			name: overrides?.name?.trim() || participant.name || `Combatente ${sourceIndex + 1}`,
			displayName: overrides?.displayName?.trim() || undefined,
			category,
			side,
			initiative: this.toFiniteNumber(initiative),
			nextRoundInitiative: undefined,
			initiativeTieBreaker:
				initiativeTieBreaker == null ? undefined : this.toFiniteNumber(initiativeTieBreaker),
			nextRoundInitiativeTieBreaker: undefined,
			turnOrder: sourceIndex,
			armorClass: this.toArmorClass(overrides?.armorClass ?? sheet.armorClass),
			maxHp,
			currentHp,
			temporaryHp,
			defeated: autoDefeat && currentHp <= 0,
			hidden: false,
			inactiveUntilRound: undefined,
			collapsed: false,
			spellSlotsCollapsed: true,
			pendingAdd: overrides?.pendingAdd === true,
			joinsAtRound: overrides?.joinsAtRound,
			conditions: [],
			specialAbilities: this.createRuntimeAbilities(sheet.specialAbilities, sheet.features),
			spellSlots: this.createRuntimeSpellSlots(sheet.spellSlots),
			spells: structuredClone(sheet.spells),
			features: structuredClone(sheet.features),
			...(this.normalizeDamageDefenses(sheet.damageVulnerabilities)
				? { damageVulnerabilities: this.normalizeDamageDefenses(sheet.damageVulnerabilities) }
				: {}),
			...(this.normalizeDamageDefenses(sheet.damageResistances)
				? { damageResistances: this.normalizeDamageDefenses(sheet.damageResistances) }
				: {}),
			...(this.normalizeDamageDefenses(sheet.damageImmunities)
				? { damageImmunities: this.normalizeDamageDefenses(sheet.damageImmunities) }
				: {}),
			...(this.normalizeStringList(sheet.conditionImmunities)
				? { conditionImmunities: this.normalizeStringList(sheet.conditionImmunities) }
				: {}),
			privateNotes: participant.notes?.trim() || undefined,
		};
	}

	private createReferenceSheet(sheet: CreatureSheet, id = this.createId()): BattleReferenceSheet {
		return { id, sheet: structuredClone(sheet) };
	}

	private normalizeDamageDefenses(values: unknown): CreatureDamageDefense[] | undefined {
		if (!Array.isArray(values)) return undefined;
		const normalized = values.flatMap((value) => {
			if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
			const defense = value as Partial<CreatureDamageDefense>;
			const types = this.normalizeStringList(defense.types);
			const note = typeof defense.note === 'string' ? defense.note.trim() : '';
			return types?.length ? [{ types, ...(note ? { note } : {}) }] : [];
		});
		return normalized.length ? normalized : undefined;
	}

	private normalizeStringList(values: unknown): string[] | undefined {
		if (!Array.isArray(values)) return undefined;
		const unique = new Set<string>();
		for (const value of values) {
			if (typeof value !== 'string' || !value.trim()) continue;
			unique.add(value.trim());
		}
		return unique.size ? [...unique] : undefined;
	}

	private normalizeReferenceSheets(raw: unknown): BattleReferenceSheet[] {
		if (!Array.isArray(raw)) return [];

		const ids = new Set<string>();
		return raw.flatMap((reference, index) => {
			if (!reference || typeof reference !== 'object') return [];
			const candidate = reference as Partial<BattleReferenceSheet>;
			if (!candidate.sheet || typeof candidate.sheet !== 'object') return [];
			const id =
				typeof candidate.id === 'string' && candidate.id.trim()
					? candidate.id
					: `reference-sheet-${index + 1}`;
			if (ids.has(id)) return [];
			ids.add(id);
			return [{ id, sheet: structuredClone(candidate.sheet) }];
		});
	}

	private createTurnHistoryEntry(
		battle: BattleEncounter,
		combatant: BattleCombatant,
		endedAt: string,
		durationSeconds: number,
		notes?: string,
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
		notes: string,
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
				combatantId: typeof candidate.combatantId === 'string' ? candidate.combatantId : 'system',
				combatantName:
					typeof candidate.combatantName === 'string' ? candidate.combatantName : 'Sistema',
				startedAt: timestamp,
				endedAt: typeof candidate.endedAt === 'string' ? candidate.endedAt : undefined,
				durationSeconds: this.toNonNegativeInt(candidate.durationSeconds),
				notes: typeof candidate.notes === 'string' ? candidate.notes : undefined,
			};
		});
	}

	private normalizePendingActions(raw: unknown): BattlePendingAction[] {
		if (!Array.isArray(raw)) return [];
		const actions = raw.flatMap((action, index) => {
			const normalized = this.normalizePendingAction(action, index);
			return normalized ? [normalized] : [];
		});
		const deathSaveCombatants = new Set<string>();
		return actions.filter((action) => {
			if (action.type !== 'death-save') return true;
			if (deathSaveCombatants.has(action.combatantId)) return false;
			deathSaveCombatants.add(action.combatantId);
			return true;
		});
	}

	private normalizePendingAction(raw: unknown, sourceIndex: number): BattlePendingAction | null {
		if (!raw || typeof raw !== 'object') return null;
		const candidate = raw as Record<string, unknown>;
		if (typeof candidate['combatantId'] !== 'string') return null;
		const id =
			typeof candidate['id'] === 'string' ? candidate['id'] : `pending-action-${sourceIndex + 1}`;
		const createdAtRound = Math.max(1, this.toNonNegativeInt(candidate['createdAtRound']) || 1);
		const createdAtTurnIndex = Math.max(0, this.toNonNegativeInt(candidate['createdAtTurnIndex']));

		if (candidate['type'] === 'death-save') {
			return {
				id,
				type: 'death-save',
				combatantId: candidate['combatantId'],
				createdAtRound,
				createdAtTurnIndex,
				priority: 300,
			};
		}
		if (candidate['type'] !== 'concentration-check') return null;

		const damage = this.toNonNegativeInt(candidate['damage']);
		if (!damage) return null;

		return {
			id,
			type: 'concentration-check',
			combatantId: candidate['combatantId'],
			damage,
			difficultyClass: this.getConcentrationDifficultyClass(damage),
			createdAtRound,
			createdAtTurnIndex,
			priority: 200,
		};
	}

	private createConcentrationCheck(
		combatantId: string,
		damage: number,
		battle: BattleEncounter,
	): BattleConcentrationCheckPendingAction {
		return {
			id: this.createId(),
			type: 'concentration-check',
			combatantId,
			damage,
			difficultyClass: this.getConcentrationDifficultyClass(damage),
			createdAtRound: battle.round,
			createdAtTurnIndex: Math.max(0, battle.activeTurnIndex),
			priority: 200,
		};
	}

	private normalizeDeathSaveState(raw: unknown): BattleDeathSaveState | undefined {
		if (!raw || typeof raw !== 'object') return undefined;
		const candidate = raw as Partial<BattleDeathSaveState>;
		if (
			candidate.status !== 'active' &&
			candidate.status !== 'stable' &&
			candidate.status !== 'dead'
		) {
			return undefined;
		}

		return {
			status: candidate.status,
			successes: Math.min(3, this.toNonNegativeInt(candidate.successes)),
			failures: Math.min(3, this.toNonNegativeInt(candidate.failures)),
		};
	}

	private getConcentrationDifficultyClass(damage: number): number {
		return Math.max(10, Math.floor(damage / 2));
	}

	private isConcentrating(combatant: BattleCombatant): boolean {
		return combatant.conditions.some((condition) => condition.name === 'concentrating');
	}

	private reconcilePendingActions(battle: BattleEncounter): BattleEncounter {
		const pendingActions = this.reconcilePendingActionsForCombatants(
			battle.pendingActions,
			battle.combatants,
			battle.pendingCombatants,
		);
		return pendingActions.length === battle.pendingActions.length
			? battle
			: { ...battle, pendingActions };
	}

	private reconcilePendingActionsForCombatants(
		pendingActions: BattlePendingAction[],
		combatants: BattleCombatant[],
		pendingCombatants: BattleCombatant[],
	): BattlePendingAction[] {
		const allCombatants = [...combatants, ...pendingCombatants];
		return pendingActions.filter((action) => {
			const combatant = allCombatants.find((item) => item.id === action.combatantId);
			if (action.type === 'concentration-check') {
				return combatant != null && !combatant.defeated && this.isConcentrating(combatant);
			}
			if (action.type === 'death-save') {
				return (
					combatant != null &&
					!combatant.defeated &&
					this.canUseDeathSaves(combatant) &&
					combatant.deathSaves?.status === 'active'
				);
			}
			return true;
		});
	}

	private ensureDeathSavePendingAction(battle: BattleEncounter): BattleEncounter {
		if (battle.status !== 'active') return battle;
		const combatant = this.getCurrentCombatant(battle);
		if (
			!combatant ||
			combatant.deathSaves?.status !== 'active' ||
			battle.pendingActions.some(
				(action) => action.type === 'death-save' && action.combatantId === combatant.id,
			)
		) {
			return battle;
		}

		return {
			...battle,
			pendingActions: [
				...battle.pendingActions,
				{
					id: this.createId(),
					type: 'death-save',
					combatantId: combatant.id,
					createdAtRound: battle.round,
					createdAtTurnIndex: Math.max(0, battle.activeTurnIndex),
					priority: 300,
				},
			],
		};
	}

	private normalizeTurnSnapshots(raw: unknown): BattleTurnSnapshot[] {
		if (!Array.isArray(raw)) return [];

		return raw
			.filter((snapshot) => snapshot && typeof snapshot === 'object')
			.slice(-MAX_BATTLE_TURN_SNAPSHOTS)
			.map((snapshot, index) => this.normalizeTurnSnapshot(snapshot, index));
	}

	private normalizeTurnSnapshot(raw: unknown, sourceIndex: number): BattleTurnSnapshot {
		const candidate = raw as Partial<BattleTurnSnapshot>;
		const state = this.normalizeTurnSnapshotState(candidate.state);
		const currentCombatant = state.combatants[state.activeTurnIndex];

		return {
			id: typeof candidate.id === 'string' ? candidate.id : `turn-snapshot-${sourceIndex + 1}`,
			createdAt: this.normalizeIso(candidate.createdAt),
			round: state.round,
			activeTurnIndex: state.activeTurnIndex,
			combatantName:
				typeof candidate.combatantName === 'string'
					? candidate.combatantName
					: currentCombatant?.displayName?.trim() || currentCombatant?.name,
			state,
		};
	}

	private normalizeTurnSnapshotState(raw: unknown): BattleTurnSnapshotState {
		const candidate =
			raw && typeof raw === 'object' ? (raw as Partial<BattleTurnSnapshotState>) : {};
		const round = Math.max(1, this.toNonNegativeInt(candidate.round) || 1);
		const combatants = this.orderCombatants(
			Array.isArray(candidate.combatants)
				? candidate.combatants.map((combatant, index) => this.normalizeCombatant(combatant, index))
				: [],
		);
		const pendingCombatants = Array.isArray(candidate.pendingCombatants)
			? candidate.pendingCombatants.map((combatant, index) =>
					this.normalizeCombatant(combatant, index, { pendingAdd: true }),
				)
			: [];
		const pendingActions = this.reconcilePendingActionsForCombatants(
			this.normalizePendingActions(candidate.pendingActions),
			combatants,
			pendingCombatants,
		);

		return {
			status:
				candidate.status === 'active' ||
				candidate.status === 'paused' ||
				candidate.status === 'completed'
					? candidate.status
					: 'active',
			round,
			activeTurnIndex: this.normalizeActiveTurnIndex(
				combatants,
				this.toNonNegativeInt(candidate.activeTurnIndex),
				round,
			),
			completedAt: typeof candidate.completedAt === 'string' ? candidate.completedAt : undefined,
			turnStartedAt:
				typeof candidate.turnStartedAt === 'string' ? candidate.turnStartedAt : undefined,
			currentTurnElapsedSeconds: this.toNonNegativeInt(candidate.currentTurnElapsedSeconds),
			combatants,
			pendingCombatants,
			lairActions: Array.isArray(candidate.lairActions)
				? candidate.lairActions.map((action, index) => this.normalizeLairAction(action, index))
				: [],
			traps: Array.isArray(candidate.traps)
				? candidate.traps.map((trap, index) => this.normalizeTrap(trap, index))
				: [],
			turnHistory: this.normalizeTurnHistory(candidate.turnHistory),
			dmNotes: typeof candidate.dmNotes === 'string' ? candidate.dmNotes : '',
			pendingActions,
		};
	}

	private createTurnSnapshot(battle: BattleEncounter, now: Date): BattleTurnSnapshot {
		const currentCombatant = this.getCurrentCombatant(battle);
		const state: BattleTurnSnapshotState = {
			status: battle.status,
			round: battle.round,
			activeTurnIndex: battle.activeTurnIndex,
			completedAt: battle.completedAt,
			turnStartedAt: battle.turnStartedAt,
			currentTurnElapsedSeconds: battle.currentTurnElapsedSeconds,
			combatants: battle.combatants,
			pendingCombatants: battle.pendingCombatants,
			lairActions: battle.lairActions,
			traps: battle.traps,
			turnHistory: battle.turnHistory,
			dmNotes: battle.dmNotes,
			pendingActions: battle.pendingActions,
		};

		return structuredClone({
			id: this.createId(),
			createdAt: this.toIso(now),
			round: battle.round,
			activeTurnIndex: battle.activeTurnIndex,
			combatantName: currentCombatant?.displayName?.trim() || currentCombatant?.name,
			state,
		});
	}

	private appendTurnSnapshot(
		battle: BattleEncounter,
		snapshot: BattleTurnSnapshot,
	): BattleTurnSnapshot[] {
		return [...(battle.turnSnapshots ?? []), snapshot].slice(-MAX_BATTLE_TURN_SNAPSHOTS);
	}

	private createRuntimeAbilities(
		abilities: CreatureSpecialAbility[],
		features: CreatureFeature[],
	): BattleSpecialAbility[] {
		return abilities.map((ability, index) =>
			this.abilityService.normalizeAbility({
				...this.abilityService.createAbility({
					name:
						ability.name ??
						features.find((feature) => feature.id === ability.featureId)?.name ??
						'Habilidade especial',
					description:
						ability.description ??
						features.find((feature) => feature.id === ability.featureId)?.description,
					recoveryType: ability.recoveryType,
					maxUses: ability.maxUses,
					cooldownTurns: ability.cooldownTurns,
					cooldownRounds: ability.cooldownRounds,
					rechargeDice: ability.rechargeDice,
					rechargeOn: ability.rechargeOn,
				}),
				id: ability.id || `creature-ability-${index + 1}`,
			}),
		);
	}

	private refreshRuntimeAbilities(
		current: BattleSpecialAbility[],
		source: CreatureSpecialAbility[],
		features: CreatureFeature[],
		allowLegacyPositionMatch: boolean,
	): BattleSpecialAbility[] {
		const fresh = this.createRuntimeAbilities(source, features);
		const currentByName = new Map(
			current.map((ability) => [this.abilityMatchKey(ability.name), ability]),
		);
		return fresh.map((ability, index) => {
			const prior = currentByName.get(this.abilityMatchKey(ability.name)) ??
				(allowLegacyPositionMatch && current.length === fresh.length ? current[index] : undefined);
			if (!prior) return ability;
			const wasUnavailable = prior.isAvailable === false;
			const usedCount =
				ability.recoveryType === 'uses-per-day' || ability.recoveryType === 'uses-per-combat'
					? Math.min(
							ability.maxUses ?? 1,
							prior.usedCount && prior.usedCount > 0
								? prior.usedCount
								: wasUnavailable
									? ability.maxUses ?? 1
									: 0,
						)
					: 0;
			return this.abilityService.normalizeAbility({
				...ability,
				usedCount,
				isAvailable: ability.recoveryType === 'dice-recharge' ? !wasUnavailable : undefined,
				lastUsedAtRound: prior.lastUsedAtRound,
				lastUsedAtTurnIndex: prior.lastUsedAtTurnIndex,
				lastUsedAt: prior.lastUsedAt,
				lastRechargeRoll: prior.lastRechargeRoll,
				lastRechargeAttemptAtRound: prior.lastRechargeAttemptAtRound,
			});
		});
	}

	private refreshRuntimeSpellSlots(
		current: BattleSpellSlotLevel[],
		source: CreatureSpellSlot[],
	): BattleSpellSlotLevel[] {
		const usedByLevel = new Map(current.map((slot) => [slot.level, slot.used]));
		return this.createRuntimeSpellSlots(source).map((slot) => ({
			...slot,
			used: Math.min(slot.max, usedByLevel.get(slot.level) ?? 0),
		}));
	}

	private abilityMatchKey(name: string) {
		return name
			.toLocaleLowerCase()
			.replace(/\([^)]*\)/g, '')
			.replace(/[^\p{L}\p{N}]+/gu, ' ')
			.trim();
	}

	private createRuntimeSpellSlots(slots: CreatureSpellSlot[]): BattleSpellSlotLevel[] {
		return slots.map((slot) => ({
			level: Math.max(1, this.toNonNegativeInt(slot.level) || 1),
			max: this.toNonNegativeInt(slot.max),
			used: 0,
		}));
	}

	private normalizeSpells(raw: unknown): CreatureSpell[] {
		if (!Array.isArray(raw)) return [];
		return raw.flatMap((spell, index) => {
			if (!spell || typeof spell !== 'object') return [];
			const candidate = spell as Partial<CreatureSpell>;
			const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
			if (!name) return [];
			const id =
				typeof candidate.id === 'string' && candidate.id ? candidate.id : `spell-${index + 1}`;
			const source =
				typeof candidate.source === 'string' && candidate.source.trim()
					? candidate.source.trim()
					: id.includes('::spell::')
						? 'PHB'
						: undefined;
			return [
				{
					id,
					name,
					...(source ? { source } : {}),
					level: candidate.level == null ? undefined : this.toNonNegativeInt(candidate.level),
					uses: candidate.uses == null ? undefined : this.toNonNegativeInt(candidate.uses),
					...(['slot', 'at-will', 'constant', 'daily', 'rest', 'weekly'].includes(
						String(candidate.castingGroup),
					)
						? { castingGroup: candidate.castingGroup }
						: {}),
					...(candidate.each === true ? { each: true } : {}),
				},
			];
		});
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

	private inferSideFromCategory(category: CreatureCategory | undefined): BattleCombatantSide {
		if (category === 'pc') return 'player';
		if (category === 'npc') return 'neutral';
		if (category === 'other') return 'neutral';
		return DEFAULT_SIDE;
	}

	private shouldQueueCombatantForNextRound(battle: BattleEncounter): boolean {
		return battle.status !== 'completed' && battle.combatants.length > 0;
	}

	private isCombatantEligibleForInitiative(combatant: BattleCombatant, round: number): boolean {
		return (
			combatant.defeated !== true &&
			combatant.pendingAdd !== true &&
			(combatant.inactiveUntilRound == null || combatant.inactiveUntilRound <= round)
		);
	}

	private findFirstEligibleTurnIndex(combatants: BattleCombatant[], round: number): number {
		return combatants.findIndex((combatant) =>
			this.isCombatantEligibleForInitiative(combatant, round),
		);
	}

	private findNextEligibleTurnIndex(
		combatants: BattleCombatant[],
		currentIndex: number,
		round: number,
	): number {
		if (!combatants.length) return -1;
		for (let offset = 1; offset <= combatants.length; offset += 1) {
			const index = (Math.max(-1, currentIndex) + offset) % combatants.length;
			if (this.isCombatantEligibleForInitiative(combatants[index], round)) {
				return index;
			}
		}
		return -1;
	}

	private normalizeActiveTurnIndex(
		combatants: BattleCombatant[],
		activeTurnIndex: number,
		round: number,
	): number {
		if (!combatants.length) return -1;
		const clampedIndex = Math.min(Math.max(0, activeTurnIndex), combatants.length - 1);
		if (this.isCombatantEligibleForInitiative(combatants[clampedIndex], round)) {
			return clampedIndex;
		}
		return this.findFirstEligibleTurnIndex(combatants, round);
	}

	private getNextRoundForReentry(battle: BattleEncounter): number | undefined {
		if (battle.status === 'completed') return undefined;
		return battle.round + 1;
	}

	private resolveDefeatedState(
		battle: BattleEncounter,
		combatant: BattleCombatant,
		currentHp: number,
	): Pick<BattleCombatant, 'defeated' | 'collapsed' | 'inactiveUntilRound'> {
		if (!this.shouldAutoDefeatCombatant(combatant)) {
			return {
				defeated: combatant.defeated,
				collapsed: combatant.collapsed,
				inactiveUntilRound: combatant.inactiveUntilRound,
			};
		}

		if (currentHp <= 0) {
			return {
				defeated: true,
				collapsed: true,
				inactiveUntilRound: undefined,
			};
		}

		if (combatant.defeated) {
			return {
				defeated: false,
				collapsed: combatant.collapsed,
				inactiveUntilRound: this.getNextRoundForReentry(battle),
			};
		}

		return {
			defeated: false,
			collapsed: combatant.collapsed,
			inactiveUntilRound: combatant.inactiveUntilRound,
		};
	}

	private shouldAutoDefeatCombatant(
		combatant: Pick<BattleCombatant, 'category' | 'side'>,
	): boolean {
		return !this.canUseDeathSaves(combatant) && combatant.side !== 'player';
	}

	private normalizeFeatures(features: unknown): CreatureFeature[] {
		if (!Array.isArray(features)) return [];
		const mapped = features
			.map((feature, index) => {
				const candidate = feature as Partial<CreatureFeature>;
				if (typeof candidate.name !== 'string' || !candidate.name.trim()) return null;
				return {
					id: typeof candidate.id === 'string' ? candidate.id : `feature-${index + 1}`,
					name: candidate.name.trim(),
					description:
						typeof candidate.description === 'string' ? candidate.description.trim() : undefined,
					kind:
						candidate.kind === 'trait' ||
						candidate.kind === 'action' ||
						candidate.kind === 'bonus' ||
						candidate.kind === 'reaction' ||
						candidate.kind === 'legendary' ||
						candidate.kind === 'spellcasting' ||
						candidate.kind === 'note'
							? candidate.kind
							: 'note',
				};
			})
			.filter((feature) => feature !== null);
		return mapped as CreatureFeature[];
	}

	private insertCombatant(
		battle: BattleEncounter,
		combatant: BattleCombatant,
		now: Date,
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
		const activeTurnIndex = this.normalizeActiveTurnIndex(
			combatants,
			battle.activeTurnIndex >= 0 ? battle.activeTurnIndex : 0,
			battle.round,
		);
		return {
			...battle,
			updatedAt: timestamp,
			combatants,
			activeTurnIndex,
			turnStartedAt:
				battle.status === 'active' && activeTurnIndex >= 0
					? (battle.turnStartedAt ?? timestamp)
					: undefined,
		};
	}

	private resolveRoundStartChanges(
		combatants: BattleCombatant[],
		pendingCombatants: BattleCombatant[],
		nextRound: number,
	): RoundStartResolution {
		const updatedInitiatives = combatants
			.filter((combatant) => combatant.nextRoundInitiative != null)
			.map((combatant) => combatant.displayName?.trim() || combatant.name);
		const updatedTieBreakers = combatants
			.filter((combatant) => combatant.nextRoundInitiativeTieBreaker !== undefined)
			.map((combatant) => combatant.displayName?.trim() || combatant.name);
		const reactivatedCombatants = combatants
			.filter(
				(combatant) =>
					combatant.inactiveUntilRound != null && combatant.inactiveUntilRound <= nextRound,
			)
			.map((combatant) => combatant.displayName?.trim() || combatant.name);
		const joiningCombatants = pendingCombatants.map(
			(combatant) => combatant.displayName?.trim() || combatant.name,
		);
		const activatedCombatants = pendingCombatants.map((combatant) => ({
			...combatant,
			pendingAdd: false,
			joinsAtRound: undefined,
			nextRoundInitiative: undefined,
			nextRoundInitiativeTieBreaker: undefined,
			inactiveUntilRound: undefined,
		}));
		const reorderedCombatants = this.orderCombatants([
			...combatants.map((combatant) => ({
				...combatant,
				initiative: combatant.nextRoundInitiative ?? combatant.initiative,
				nextRoundInitiative: undefined,
				initiativeTieBreaker:
					combatant.nextRoundInitiativeTieBreaker === undefined
						? combatant.initiativeTieBreaker
						: (combatant.nextRoundInitiativeTieBreaker ?? undefined),
				nextRoundInitiativeTieBreaker: undefined,
				inactiveUntilRound:
					combatant.inactiveUntilRound != null && combatant.inactiveUntilRound <= nextRound
						? undefined
						: combatant.inactiveUntilRound,
			})),
			...activatedCombatants,
		]);
		const messages: string[] = [];

		if (updatedInitiatives.length) {
			messages.push(
				`Iniciativas atualizadas no início do round para ${updatedInitiatives.join(', ')}.`,
			);
		}

		if (updatedTieBreakers.length) {
			messages.push(`DES de desempate atualizado para ${updatedTieBreakers.join(', ')}.`);
		}

		if (joiningCombatants.length) {
			messages.push(`Entraram no próximo round: ${joiningCombatants.join(', ')}.`);
		}

		if (reactivatedCombatants.length) {
			messages.push(`Voltaram à iniciativa: ${reactivatedCombatants.join(', ')}.`);
		}

		return {
			combatants: reorderedCombatants,
			pendingCombatants: [],
			messages,
		};
	}

	private advanceEncounterEventCooldowns(
		lairActions: BattleLairAction[],
		traps: BattleTrap[],
		roundAdvanced: boolean,
	): EncounterEventAdvanceResult {
		if (!roundAdvanced) {
			return {
				lairActions,
				traps,
				messages: [],
			};
		}

		const messages: string[] = [];
		const nextLairActions = lairActions.map((action) => {
			if ((action.currentCooldownRounds ?? 0) <= 0) return action;
			const remaining = Math.max(0, (action.currentCooldownRounds ?? 0) - 1);
			if (remaining === 0) {
				messages.push(`Ação de covil disponível novamente: ${action.name}.`);
			}
			return {
				...action,
				currentCooldownRounds: remaining,
			};
		});

		const nextTraps = traps.map((trap) => {
			if ((trap.currentCooldownRounds ?? 0) <= 0) return trap;
			const remaining = Math.max(0, (trap.currentCooldownRounds ?? 0) - 1);
			if (remaining === 0) {
				messages.push(`Armadilha disponível novamente: ${trap.name}.`);
			}
			return {
				...trap,
				currentCooldownRounds: remaining,
			};
		});

		return {
			lairActions: nextLairActions,
			traps: nextTraps,
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
				(combatant) => combatant.displayName?.trim() || combatant.name,
			),
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

	private toArmorClass(value: unknown): number | null {
		return normalizeArmorClass(value);
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

	private toPositiveIntOrUndefined(value: unknown): number | undefined {
		const numeric = this.toNonNegativeInt(value);
		return numeric > 0 ? numeric : undefined;
	}

	private toFiniteNumber(value: unknown): number {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? numeric : 0;
	}
}
