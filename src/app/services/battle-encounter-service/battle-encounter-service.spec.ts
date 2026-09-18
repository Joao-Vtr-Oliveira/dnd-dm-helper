import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Encounter, EncounterParticipant } from '../../models/encounter-model';
import { BattleEncounterService, MAX_BATTLE_TURN_SNAPSHOTS } from './battle-encounter-service';

describe('BattleEncounterService', () => {
	let service: BattleEncounterService;

	const boss: EncounterParticipant = {
		id: 'participant-boss',
		sourceSheetId: 'sheet-boss',
		name: 'Goblin Boss',
		category: 'monster',
		initiative: 18,
		notes: 'Focus the wizard',
		sheet: {
			name: 'Goblin Boss Sheet',
			armorClass: 16,
			maxHp: 30,
			spellSlots: [{ level: 1, max: 2 }],
			spells: [{ id: 'spell-fire', name: 'Fire Bolt', level: 0 }],
			specialAbilities: [
				{
					id: 'fire-breath',
					name: 'Fire Breath',
					recoveryType: 'dice-recharge',
					rechargeDice: 'd6',
					rechargeOn: [5, 6],
				},
			],
			features: [{ id: 'nimble', name: 'Nimble Escape', kind: 'bonus' }],
			damageResistances: [{ types: ['fire'], note: 'while wearing the ring' }],
			damageImmunities: [{ types: ['poison'] }],
			conditionImmunities: ['poisoned'],
		},
	};

	const encounter: Encounter = {
		schemaVersion: 1,
		type: 'dnd-dm-helper-encounter',
		id: 'enc-1',
		title: 'Goblin Ambush',
		description: 'A bridge is guarded by goblins.',
		createdAt: 1,
		updatedAt: 1,
		tags: [],
		archived: true,
		locationRefs: [{ scopeType: 'state', scopeId: 'feng', relation: 'operation' }],
		organizationRefs: [{ organizationId: 'winterhold', relation: 'affiliated' }],
		participants: [
			boss,
			{
				...structuredClone(boss),
				id: 'participant-minion',
				name: 'Goblin Minion',
				initiative: 12,
				sheet: { ...structuredClone(boss.sheet), maxHp: 12 },
			},
		],
		lairActions: [
			{
				id: 'lair-1',
				name: 'Cave Pulse',
				initiative: 20,
				active: true,
				frequency: 'cooldown-rounds',
				cooldownRounds: 2,
			},
		],
		traps: [
			{
				id: 'trap-1',
				name: 'Falling Rocks',
				triggerType: 'initiative',
				initiative: 10,
				active: true,
				frequency: 'every-round',
			},
		],
	};

	const wenTorger: EncounterParticipant = {
		id: '51de9d4e-ea2c-4d86-8d22-68fd31e14ce5',
		sourceSheetId: '51de9d4e-ea2c-4d86-8d22-68fd31e14ce5',
		name: 'Wen Torger', category: 'npc', initiative: 12,
		sheet: {
			name: 'Wen Torger', armorClass: 15, maxHp: 58, spellSlots: [],
			spells: [
				{ id: 'eldritch-blast', name: 'Eldritch Blast', source: 'XPHB', level: 0 },
				{ id: 'mage-hand', name: 'Mage Hand', source: 'XPHB', level: 0 },
				{ id: 'armor-of-agathys', name: 'Armor of Agathys', source: 'XPHB', level: 1 },
				{ id: 'hex', name: 'Hex', source: 'XPHB', level: 1 },
				{ id: 'hellish-rebuke-spell', name: 'Hellish Rebuke', source: 'XPHB', level: 1 },
			],
			specialAbilities: [
				{ id: 'infernal-brand', name: 'Infernal Brand', recoveryType: 'dice-recharge', rechargeDice: 'd6', rechargeOn: [5, 6] },
				{ id: 'fiendish-step', name: 'Fiendish Step', recoveryType: 'dice-recharge', rechargeDice: 'd6', rechargeOn: [4, 5, 6] },
				{ id: 'hellish-rebuke', name: 'Hellish Rebuke', recoveryType: 'uses-per-day', maxUses: 2 },
			],
			features: [
				{ id: 'winterhold-hunter', name: 'Caçador da Winterhold', kind: 'trait' },
				{ id: 'controlled-pact', name: 'Pacto Infernal Controlado', kind: 'trait' },
				{ id: 'infernal-brand-action', name: 'Infernal Brand', kind: 'action' },
			],
		},
	};

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
		service = TestBed.inject(BattleEncounterService);
	});

	it('creates isolated runtime combatants from encounter participants', () => {
		const source = structuredClone(encounter);
		Object.assign(source.participants[0].sheet as unknown as Record<string, unknown>, {
			archived: true,
			generic: false,
			classes: ['ranger'],
			tags: ['editorial'],
			locationRefs: [{ scopeType: 'settlement', scopeId: 'nagawoods', relation: 'base' }],
			organizationRefs: [{ organizationId: 'winterhold', relation: 'member' }],
		});
		const battle = service.createBattleFromEncounter(
			source,
			undefined,
			new Date('2026-01-01T10:00:00Z'),
		);
		const combatant = battle.combatants[0];
		const reference = battle.referenceSheets[0];

		expect(battle.sourceEncounterId).toBe(encounter.id);
		expect(battle.name).toBe(encounter.title);
		expect(battle.description).toBe(encounter.description);
		expect('archived' in battle).toBeFalse();
		expect('locationRefs' in battle).toBeFalse();
		expect('organizationRefs' in battle).toBeFalse();
		expect(combatant.sourceParticipantId).toBe(boss.id);
		expect(combatant.sourceSheetId).toBe(boss.sourceSheetId);
		expect(combatant.referenceSheetId).toBe(reference.id);
		expect(reference.sheet).toEqual(boss.sheet);
		for (const field of ['archived', 'generic', 'classes', 'tags', 'locationRefs', 'organizationRefs']) {
			expect(field in reference.sheet).withContext(field).toBeFalse();
			expect(field in combatant).withContext(field).toBeFalse();
		}
		expect(reference.sheet).not.toBe(source.participants[0].sheet);
		expect(combatant.currentHp).toBe(combatant.maxHp);
		expect(combatant.temporaryHp).toBe(0);
		expect(combatant.spellSlots).toEqual([{ level: 1, max: 2, used: 0 }]);
		expect(combatant.spells).toEqual(boss.sheet.spells);
		expect(combatant.features).toEqual(boss.sheet.features);
		expect(combatant.damageResistances).toEqual(boss.sheet.damageResistances);
		expect(combatant.damageResistances).not.toBe(boss.sheet.damageResistances);
		expect(combatant.damageImmunities).toEqual(boss.sheet.damageImmunities);
		expect(combatant.conditionImmunities).toEqual(['poisoned']);
		expect(combatant.specialAbilities[0]).toEqual(
			jasmine.objectContaining({
				id: 'fire-breath',
				recoveryType: 'dice-recharge',
				isAvailable: true,
				usedCount: 0,
				currentCooldownTurns: 0,
				currentCooldownRounds: 0,
			}),
		);
		expect(combatant.privateNotes).toBe(boss.notes);
		expect(source.participants[0].sheet).toEqual(
			jasmine.objectContaining({ locationRefs: [{ scopeType: 'settlement', scopeId: 'nagawoods', relation: 'base' }] }),
		);

		const advanced = service.advanceTurn(battle, new Date('2026-01-01T10:00:05Z'));
		const snapshot = advanced.turnSnapshots[0];
		expect(snapshot).toBeDefined();
		expect('referenceSheets' in snapshot.state).toBeFalse();
		expect(snapshot.state.combatants.every((item) => !('locationRefs' in item))).toBeTrue();
		expect(snapshot.state.pendingCombatants.every((item) => !('organizationRefs' in item))).toBeTrue();
	});

	it('creates Wen Torger from the current rich sheet without pseudo-spells or converted recharge', () => {
		const source = { ...encounter, participants: [structuredClone(wenTorger)] };
		const battle = service.createBattleFromEncounter(source);
		const wen = battle.combatants[0];

		expect(wen.specialAbilities).toEqual([
			jasmine.objectContaining({ name: 'Infernal Brand', recoveryType: 'dice-recharge', rechargeOn: [5, 6], currentCooldownRounds: 0 }),
			jasmine.objectContaining({ name: 'Fiendish Step', recoveryType: 'dice-recharge', rechargeOn: [4, 5, 6], currentCooldownRounds: 0 }),
			jasmine.objectContaining({ name: 'Hellish Rebuke', recoveryType: 'uses-per-day', maxUses: 2, usedCount: 0 }),
		]);
		expect(wen.spells.map((spell) => spell.name)).toEqual([
			'Eldritch Blast', 'Mage Hand', 'Armor of Agathys', 'Hex', 'Hellish Rebuke',
		]);
		expect(wen.features.filter((feature) => feature.kind === 'trait').map((feature) => feature.name)).toEqual([
			'Caçador da Winterhold', 'Pacto Infernal Controlado',
		]);

		const firstUse = service.useSpecialAbility(battle, wen.id, 'hellish-rebuke');
		const secondUse = service.useSpecialAbility(firstUse, wen.id, 'hellish-rebuke');
		expect(firstUse.combatants[0].specialAbilities[2]).toEqual(jasmine.objectContaining({ usedCount: 1, isAvailable: true }));
		expect(secondUse.combatants[0].specialAbilities[2]).toEqual(jasmine.objectContaining({ usedCount: 2, isAvailable: false }));
		expect(service.resetSpecialAbility(secondUse, wen.id, 'hellish-rebuke').combatants[0].specialAbilities[2]).toEqual(jasmine.objectContaining({ usedCount: 0, isAvailable: true }));
		expect(source.participants[0].sheet.specialAbilities[2]).toEqual(jasmine.objectContaining({ maxUses: 2 }));
		expect('usedCount' in source.participants[0].sheet.specialAbilities[2]).toBeFalse();
	});

	it('uses participant ids for side and initiative setup while keeping ties stable', () => {
		const battle = service.createBattleFromEncounter(encounter, {
			combatantSides: { 'participant-boss': 'ally', 'participant-minion': 'player' },
			initiativeOverrides: { 'participant-boss': 17, 'participant-minion': 17 },
			initiativeTieBreakerOverrides: { 'participant-boss': 12, 'participant-minion': 16 },
		});

		expect(battle.combatants.map((combatant) => combatant.name)).toEqual([
			'Goblin Minion',
			'Goblin Boss',
		]);
		expect(battle.combatants.map((combatant) => combatant.side)).toEqual(['player', 'ally']);
	});

	it('applies setup changes to an existing battle with the same tie ordering', () => {
		const battle = service.createBattleFromEncounter(encounter);
		const updated = service.applyBattleSetup(battle, {
			name: 'Updated battle',
			combatantSides: { 'participant-boss': 'ally', 'participant-minion': 'player' },
			initiativeOverrides: { 'participant-boss': 18, 'participant-minion': 18 },
			initiativeTieBreakerOverrides: { 'participant-boss': 12, 'participant-minion': 16 },
		});

		expect(updated.name).toBe('Updated battle');
		expect(updated.combatants.map((combatant) => combatant.name)).toEqual([
			'Goblin Minion',
			'Goblin Boss',
		]);
		expect(updated.combatants.map((combatant) => combatant.side)).toEqual(['player', 'ally']);
	});

	it('initializes encounter event runtime state without changing the source', () => {
		const battle = service.createBattleFromEncounter(encounter);

		expect(battle.lairActions[0]).toEqual(
			jasmine.objectContaining({
				id: 'lair-1',
				currentCooldownRounds: 0,
				lastTriggeredAtRound: undefined,
			}),
		);
		expect(battle.traps[0]).toEqual(
			jasmine.objectContaining({
				id: 'trap-1',
				currentCooldownRounds: 0,
				lastTriggeredAtRound: undefined,
			}),
		);
		expect('currentCooldownRounds' in encounter.lairActions[0]).toBeFalse();
	});

	it('snapshots and restores the same canonical runtime shape', () => {
		const battle = service.createBattleFromEncounter(encounter);
		const before = structuredClone(battle);
		const advanced = service.advanceTurn(battle, new Date('2026-01-01T10:00:05Z'));
		const restored = service.undoTurn(advanced, new Date('2026-01-01T10:01:00Z'));

		expect(advanced.turnSnapshots).toHaveSize(1);
		expect(advanced.turnSnapshots[0].state.combatants[0].spells).toEqual(
			before.combatants[0].spells,
		);
		expect(advanced.turnSnapshots[0].state.combatants[0].features).toEqual(
			before.combatants[0].features,
		);
		expect(restored.combatants).toEqual(before.combatants);
		expect(restored.lairActions).toEqual(before.lairActions);
		expect(restored.traps).toEqual(before.traps);
	});

	it('adds and duplicates canonical participants with fresh runtime state', () => {
		const battle = service.createBattleFromEncounter(encounter);
		const added = service.addCombatantFromParticipant(battle, {
			...structuredClone(boss),
			id: 'participant-reinforcement',
			name: 'Cult Fanatic',
			initiative: 20,
		});
		const original = added.pendingCombatants[0];
		const spent = service.useSpellSlot(added, original.id, 1);
		const duplicated = service.duplicateCombatant(spent, original.id);
		const copy = duplicated.pendingCombatants.find((combatant) => combatant.id !== original.id)!;

		expect(original.sourceParticipantId).toBe('participant-reinforcement');
		expect(original.spells).toEqual(boss.sheet.spells);
		expect(original.features).toEqual(boss.sheet.features);
		expect(copy.currentHp).toBe(copy.maxHp);
		expect(copy.temporaryHp).toBe(0);
		expect(copy.spellSlots[0].used).toBe(0);
		expect(copy.specialAbilities[0].isAvailable).toBeTrue();
	});

	it('keeps damage, conditions, and spell-slot state isolated to the battle', () => {
		const battle = service.createBattleFromEncounter(encounter);
		const combatantId = battle.combatants[0].id;
		const withTemporaryHp = service.updateCombatantHp(battle, combatantId, { temporaryHp: 5 });
		const damaged = service.applyDamage(withTemporaryHp, combatantId, 8);
		const withCondition = service.addCondition(damaged, combatantId, {
			name: 'stunned',
			label: 'Stunned',
			durationType: 'turns',
			durationTurns: 1,
		});
		const advanced = service.advanceTurn(withCondition);
		const spent = service.useSpellSlot(advanced, combatantId, 1);
		const recovered = service.recoverSpellSlot(spent, combatantId, 1);

		expect(damaged.combatants[0]).toEqual(
			jasmine.objectContaining({
				temporaryHp: 0,
				currentHp: 27,
			}),
		);
		expect(advanced.combatants[0].conditions).toEqual([]);
		expect(spent.combatants[0].spellSlots[0].used).toBe(1);
		expect(recovered.combatants[0].spellSlots[0].used).toBe(0);
		expect(encounter.participants[0].sheet.spellSlots[0]).toEqual({ level: 1, max: 2 });
	});

	it('keeps dice recharge physical and accepts one recorded result per round', () => {
		const battle = service.createBattleFromEncounter(encounter);
		const combatantId = battle.combatants[0].id;
		const abilityId = battle.combatants[0].specialAbilities[0].id;
		const used = service.useSpecialAbility(battle, combatantId, abilityId);
		const ownerNextTurn = service.advanceTurn(service.advanceTurn(used));
		const resolved = service.recordSpecialAbilityRecharge(
			ownerNextTurn,
			combatantId,
			abilityId,
			5,
		)!;

		expect(
			service.getPendingDiceRechargeAbilities(ownerNextTurn).map((ability) => ability.id),
		).toEqual([abilityId]);
		expect(resolved.success).toBeTrue();
		expect(resolved.battle.combatants[0].specialAbilities[0]).toEqual(
			jasmine.objectContaining({
				isAvailable: true,
				lastRechargeRoll: 5,
				lastRechargeAttemptAtRound: 2,
			}),
		);
		expect(
			service.recordSpecialAbilityRecharge(resolved.battle, combatantId, abilityId, 6),
		).toBeNull();
	});

	it('keeps dice recharge, round cooldown, and combat uses as distinct runtime mechanics', () => {
		const source = structuredClone(encounter);
		source.participants[0].sheet.specialAbilities = [
			{ id: 'recharge', name: 'Recharge 4-6', recoveryType: 'dice-recharge', rechargeDice: 'd6', rechargeOn: [4, 5, 6] },
			{ id: 'rounds', name: 'Round cooldown', recoveryType: 'round-cooldown', cooldownRounds: 2 },
			{ id: 'combat', name: 'Combat use', recoveryType: 'uses-per-combat', maxUses: 2 },
		];
		const battle = service.createBattleFromEncounter(source);
		const combatantId = battle.combatants[0].id;
		const usedRecharge = service.useSpecialAbility(battle, combatantId, 'recharge');
		const usedCooldown = service.useSpecialAbility(usedRecharge, combatantId, 'rounds');
		const usedCombat = service.useSpecialAbility(usedCooldown, combatantId, 'combat');
		const nextRound = service.advanceTurn(service.advanceTurn(usedCombat));
		const failedRecharge = service.recordSpecialAbilityRecharge(nextRound, combatantId, 'recharge', 1)!;

		expect(usedRecharge.combatants[0].specialAbilities[0]).toEqual(
			jasmine.objectContaining({ recoveryType: 'dice-recharge', rechargeOn: [4, 5, 6], currentCooldownRounds: 0, isAvailable: false }),
		);
		expect(usedCooldown.combatants[0].specialAbilities[1]).toEqual(
			jasmine.objectContaining({ recoveryType: 'round-cooldown', currentCooldownRounds: 2 }),
		);
		expect(nextRound.combatants[0].specialAbilities[1]).toEqual(
			jasmine.objectContaining({ currentCooldownRounds: 1, isAvailable: false }),
		);
		expect(failedRecharge).toEqual(jasmine.objectContaining({ success: false }));
		expect(failedRecharge.battle.combatants[0].specialAbilities[0]).toEqual(
			jasmine.objectContaining({ isAvailable: false, lastRechargeRoll: 1 }),
		);
		expect(usedCombat.combatants[0].specialAbilities[2]).toEqual(
			jasmine.objectContaining({ recoveryType: 'uses-per-combat', maxUses: 2, usedCount: 1, isAvailable: true }),
		);
		expect(service.resetSpecialAbility(usedCombat, combatantId, 'combat').combatants[0].specialAbilities[2]).toEqual(
			jasmine.objectContaining({ usedCount: 0, isAvailable: true }),
		);
	});

	it('normalizes persisted battles to canonical runtime fields only', () => {
		const persistedReferenceSheet = {
			id: 'reference-1',
			sheet: {
				name: 'Mage reference',
				armorClass: 15,
				maxHp: 40,
				spellSlots: [],
				spells: [],
				specialAbilities: [],
				features: [],
				size: 'Medium',
				locationRefs: [{ scopeType: 'settlement', scopeId: 'old-town', relation: 'base' }],
				organizationRefs: [{ organizationId: 'guild', relation: 'member' }],
			},
		} as unknown as import('../../models/battle-encounter-model').BattleReferenceSheet;
		const normalized = service.normalizeBattleEncounter({
			id: 'battle-1',
			sourceEncounterId: 'enc-1',
			name: 'Battle',
			round: 1,
			activeTurnIndex: 0,
			createdAt: '2026-01-01T10:00:00Z',
			startedAt: '2026-01-01T10:00:00Z',
			updatedAt: '2026-01-01T10:00:00Z',
			combatants: [
				{
					id: 'combatant-1',
					sourceParticipantId: 'participant-1',
					referenceSheetId: 'reference-1',
					name: 'Mage',
					side: 'enemy',
					initiative: 10,
					turnOrder: 0,
					armorClass: null,
					maxHp: 12,
					currentHp: 12,
					temporaryHp: 0,
					defeated: false,
					hidden: false,
					collapsed: false,
					spellSlotsCollapsed: true,
					pendingAdd: false,
					conditions: [],
					specialAbilities: [],
					spellSlots: [],
					spells: [{ id: 'MM:mage::spell::1', name: 'Magic Missile', level: 1 }],
					features: [{ id: 'feature-1', name: 'Spellcasting', kind: 'spellcasting' }],
					damageResistances: [{ types: ['fire'], note: 'while shielded' }],
				},
			],
			referenceSheets: [persistedReferenceSheet],
			pendingCombatants: [],
			lairActions: [],
			traps: [],
			turnHistory: [],
			pendingActions: [],
			turnSnapshots: [],
		});

		expect(normalized.combatants[0].sourceParticipantId).toBe('participant-1');
		expect(normalized.combatants[0].referenceSheetId).toBe('reference-1');
		expect(normalized.combatants[0].spells[0].name).toBe('Magic Missile');
		expect(normalized.combatants[0].spells[0].source).toBe('PHB');
		expect('locationRefs' in normalized.referenceSheets[0].sheet).toBeFalse();
		expect('organizationRefs' in normalized.referenceSheets[0].sheet).toBeFalse();
		expect(normalized.combatants[0].features[0].name).toBe('Spellcasting');
		expect(normalized.combatants[0].damageResistances).toEqual([
			{ types: ['fire'], note: 'while shielded' },
		]);
		expect(normalized.referenceSheets[0].sheet).toEqual(
			jasmine.objectContaining({ name: 'Mage reference', size: 'Medium' }),
		);
	});

	it('keeps the configured number of snapshots', () => {
		let battle = service.createBattleFromEncounter(encounter);
		for (let index = 0; index < MAX_BATTLE_TURN_SNAPSHOTS + 1; index += 1) {
			battle = service.advanceTurn(battle);
		}
		expect(battle.turnSnapshots).toHaveSize(MAX_BATTLE_TURN_SNAPSHOTS);
	});
});
