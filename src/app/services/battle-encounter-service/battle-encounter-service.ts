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

		if (nextTurnIndex >= battle.combatants.length) {
			nextTurnIndex = 0;
			nextRound += 1;
		}

		const startExpire = this.conditionService.expireConditionsAtTiming(
			endExpire.combatants,
			{ round: nextRound, turnIndex: nextTurnIndex },
			'start'
		);
		const cooldownAdvance = this.abilityService.advanceCooldowns(
			startExpire.combatants,
			nextRound > battle.round
		);

		const turnHistory = [...battle.turnHistory];
		if (currentCombatant) {
			turnHistory.push(
				this.createTurnHistoryEntry(battle, currentCombatant, timestamp, durationSeconds, notes)
			);
		}

		for (const message of [...endExpire.messages, ...startExpire.messages, ...cooldownAdvance.messages]) {
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
			turnStartedAt: timestamp,
			currentTurnElapsedSeconds: 0,
			combatants: cooldownAdvance.combatants,
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
		}));
	}

	disableSpellSlots(battle: BattleEncounter, combatantId: string): BattleEncounter {
		return this.mapCombatant(battle, combatantId, (combatant) => ({
			...combatant,
			spellSlots: [],
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

	private normalizeCombatant(raw: Partial<BattleCombatant>, sourceIndex: number): BattleCombatant {
		const maxHp = this.toNonNegativeInt(raw.maxHp);
		const currentHp = Math.min(this.toNonNegativeInt(raw.currentHp), maxHp || this.toNonNegativeInt(raw.currentHp));
		return {
			id: typeof raw.id === 'string' ? raw.id : this.createId(),
			sourceCreatureId: typeof raw.sourceCreatureId === 'number' ? raw.sourceCreatureId : undefined,
			name: typeof raw.name === 'string' ? raw.name : `Combatente ${sourceIndex + 1}`,
			displayName: typeof raw.displayName === 'string' ? raw.displayName : undefined,
			side: this.normalizeSide(raw.side),
			initiative: this.toFiniteNumber(raw.initiative),
			initiativeTieBreaker:
				raw.initiativeTieBreaker == null ? undefined : this.toFiniteNumber(raw.initiativeTieBreaker),
			turnOrder: this.toNonNegativeInt(raw.turnOrder),
			armorClass: this.toArmorClass(raw.armorClass),
			maxHp,
			currentHp,
			temporaryHp: this.toNonNegativeInt(raw.temporaryHp),
			defeated: raw.defeated === true || currentHp <= 0,
			hidden: raw.hidden === true,
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
		options?: BattleEncounterCreateOptions
	): BattleCombatant {
		const maxHp = this.toNonNegativeInt(creature.maxHealthPoints ?? creature.healthPoints);
		const currentHp = Math.min(this.toNonNegativeInt(creature.healthPoints), maxHp);
		const temporaryHp = this.toNonNegativeInt(creature.temporaryHealthPoints);
		const side = options?.combatantSides?.[creature.id] ?? DEFAULT_SIDE;
		const initiativeOverride = options?.initiativeOverrides?.[creature.id];

		return {
			id: this.createId(),
			sourceCreatureId: creature.id,
			name: creature.name || `Combatente ${sourceIndex + 1}`,
			side,
			initiative: this.toFiniteNumber(
				initiativeOverride == null ? creature.initiative : initiativeOverride
			),
			turnOrder: sourceIndex,
			armorClass: this.toArmorClass(creature.armorClass),
			maxHp,
			currentHp,
			temporaryHp,
			defeated: creature.alive === false || currentHp <= 0,
			hidden: false,
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
