import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LocalStorageService, type SavedEncounter } from '../local-storage-service/local-storage-service';
import { BattleEncounterStorageService } from './battle-encounter-storage-service';

describe('BattleEncounterStorageService', () => {
	let service: BattleEncounterStorageService;
	const encounter: SavedEncounter = {
		schemaVersion: 1,
		type: 'dnd-dm-helper-encounter',
		id: 'enc-1',
		title: 'Bridge Ambush',
		description: 'Bandits defend a narrow bridge.',
		createdAt: 1,
		updatedAt: 1,
		tags: [],
		participants: [{
			id: 'bandit-captain', name: 'Bandit Captain', category: 'monster', initiative: 15,
			sheet: {
				name: 'Bandit Captain', armorClass: 15, maxHp: 65, spellSlots: [], spells: [],
				specialAbilities: [], features: [],
			},
		}],
		lairActions: [],
		traps: [],
	};

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
		service = TestBed.inject(BattleEncounterStorageService);
	});

	it('forwards a SavedEncounter directly and persists its description', () => {
		const battle = service.createBattleFromEncounter(encounter);
		const loaded = service.getBattleEncounterById(battle.id);

		expect(battle.sourceEncounterId).toBe(encounter.id);
		expect(battle.description).toBe(encounter.description);
		expect(battle.combatants[0].sourceParticipantId).toBe('bandit-captain');
		expect(loaded).toEqual(battle);
	});

	it('reuses active battles unless concurrent creation is requested', () => {
		const first = service.getOrCreateBattleFromEncounter(encounter);
		const reused = service.getOrCreateBattleFromEncounter(encounter);
		const concurrent = service.getOrCreateBattleFromEncounter(encounter, undefined, true);

		expect(first.kind).toBe('created');
		expect(reused).toEqual(jasmine.objectContaining({ kind: 'existing', battle: first.battle }));
		expect(concurrent.battle.id).not.toBe(first.battle.id);
	});

	it('normalizes legacy persisted runtime data when loading', () => {
		localStorage.setItem('dnd-dm-helper.battle-encounters.v1', JSON.stringify([{
			id: 'old-battle', sourceEncounterId: 'enc-1', name: 'Old Battle', status: 'active', round: 1,
			activeTurnIndex: 0, createdAt: '2026-01-01T10:00:00Z', startedAt: '2026-01-01T10:00:00Z',
			updatedAt: '2026-01-01T10:00:00Z', combatants: [], turnHistory: [],
		}]));

		expect(service.getBattleEncounterById('old-battle')?.turnSnapshots).toEqual([]);
		expect(service.getBattleEncounterById('old-battle')?.pendingActions).toEqual([]);
	});

	it('replaces a linked legacy Wen snapshot with the current rich sheet while keeping combat state', () => {
		const sheets = TestBed.inject(LocalStorageService);
		const wen = sheets.createSheet({
			title: 'Wen Torger', category: 'npc', source: 'Notion',
			data: {
				name: 'Wen Torger', armorClass: 15, maxHp: 58, spellSlots: [],
				fiveEToolsIdentity: { name: 'Wen Torger', source: 'Notion' },
				spells: [{ id: 'eldritch-blast', name: 'Eldritch Blast', source: 'XPHB', level: 0 }],
				specialAbilities: [
					{ id: 'brand', name: 'Infernal Brand', recoveryType: 'dice-recharge', rechargeDice: 'd6', rechargeOn: [5, 6] },
					{ id: 'step', name: 'Fiendish Step', recoveryType: 'dice-recharge', rechargeDice: 'd6', rechargeOn: [4, 5, 6] },
					{ id: 'rebuke', name: 'Hellish Rebuke', recoveryType: 'uses-per-day', maxUses: 2 },
				],
				features: [
					{ id: 'hunter', name: 'Caçador da Winterhold', kind: 'trait' },
					{ id: 'pact', name: 'Pacto Infernal Controlado', kind: 'trait' },
				],
			},
		});
		localStorage.setItem('dnd-dm-helper.battle-encounters.v1', JSON.stringify([{
			id: 'wen-legacy', name: 'Old Wen', status: 'active', round: 2, activeTurnIndex: 0,
			createdAt: '2026-01-01T10:00:00Z', startedAt: '2026-01-01T10:00:00Z', updatedAt: '2026-01-01T10:00:00Z',
			combatants: [{
				id: 'wen', name: 'Wen Torger', category: 'npc', side: 'ally',
				initiative: 12, turnOrder: 0, armorClass: 15, maxHp: 58, currentHp: 41, temporaryHp: 3,
				defeated: false, hidden: false, collapsed: false, spellSlotsCollapsed: true, pendingAdd: false,
				conditions: [], spellSlots: [], features: [],
				spells: [{ id: 'pact', name: 'Pacto Infernal Controlado', uses: 1 }],
				specialAbilities: [
					{ id: 'brand-old', name: 'Marca Infernal', recoveryType: 'round-cooldown', cooldownRounds: 5, currentCooldownRounds: 5, isAvailable: false },
					{ id: 'step-old', name: 'Passo Infernal', recoveryType: 'round-cooldown', cooldownRounds: 4, currentCooldownRounds: 4, isAvailable: false },
					{ id: 'rebuke-old', name: 'Hellish Rebuke', recoveryType: 'manual', isAvailable: false },
				],
			}], pendingCombatants: [], lairActions: [], traps: [], turnHistory: [], pendingActions: [], turnSnapshots: [],
		}]));

		const loaded = service.getBattleEncounterById('wen-legacy')!;
		const wenRuntime = loaded.combatants[0];
		expect(wenRuntime.currentHp).toBe(41);
		expect(wenRuntime.temporaryHp).toBe(3);
		expect(wenRuntime.sourceSheetId).toBe(wen.id);
		expect(wenRuntime.spellSlots).toEqual([{ level: 3, max: 2, used: 0 }]);
		expect(wenRuntime.spells.map((spell) => spell.name)).toEqual(['Eldritch Blast']);
		expect(wenRuntime.features.map((feature) => feature.name)).toEqual([
			'Caçador da Winterhold', 'Pacto Infernal Controlado',
		]);
		expect(wenRuntime.specialAbilities).toEqual([
			jasmine.objectContaining({ name: 'Infernal Brand', recoveryType: 'dice-recharge', rechargeOn: [5, 6], currentCooldownRounds: 0, isAvailable: false }),
			jasmine.objectContaining({ name: 'Fiendish Step', recoveryType: 'dice-recharge', rechargeOn: [4, 5, 6], currentCooldownRounds: 0, isAvailable: false }),
			jasmine.objectContaining({ name: 'Hellish Rebuke', recoveryType: 'uses-per-day', maxUses: 2, usedCount: 2, isAvailable: false }),
		]);
	});

	it('does not refresh a battle-local snapshot after the source sheet changes', () => {
		const sheets = TestBed.inject(LocalStorageService);
		const source = sheets.createSheet({
			title: 'Snapshot Creature',
			category: 'monster',
			source: 'Test',
			data: {
				name: 'Snapshot Creature',
				armorClass: 12,
				maxHp: 20,
				spellSlots: [],
				spells: [],
				specialAbilities: [],
				features: [],
			},
		});
		const battle = service.createBattleFromEncounter({
			...encounter,
			id: 'snapshot-encounter',
			participants: [{
				...encounter.participants[0],
				name: source.title,
				sourceSheetId: source.id,
				sheet: source.data,
			}],
		});

		sheets.updateSheet(source.id, {
			data: { ...source.data, maxHp: 99 },
		});

		const loaded = service.getBattleEncounterById(battle.id)!;
		expect(loaded.referenceSheets[0].sheet.maxHp).toBe(20);
		expect(loaded.combatants[0].maxHp).toBe(20);
	});
});
