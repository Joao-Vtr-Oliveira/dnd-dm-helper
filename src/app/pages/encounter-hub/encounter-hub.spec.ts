import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EncounterHub } from './encounter-hub';
import { LocalStorageService } from '../../services/local-storage-service/local-storage-service';
import { BattleEncounterStorageService } from '../../services/battle-encounter-storage-service/battle-encounter-storage-service';

describe('EncounterHub', () => {
	let component: EncounterHub;
	let fixture: ComponentFixture<EncounterHub>;

	beforeEach(async () => {
		localStorage.clear();
		await TestBed.configureTestingModule({
			imports: [EncounterHub],
			providers: [provideZonelessChangeDetection(), provideRouter([])],
		}).compileComponents();
		fixture = TestBed.createComponent(EncounterHub);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('opens one encounter action menu at a time and closes it with Escape', () => {
		component.toggleActionMenu('first');
		component.toggleActionMenu('second');
		expect(component.actionMenuEncounterId()).toBe('second');
		component.onEscape();
		expect(component.actionMenuEncounterId()).toBeNull();
	});

	it('uses participant UUIDs for battle setup maps and category defaults', () => {
		const encounter = TestBed.inject(LocalStorageService).createEncounter('Setup', {
			schemaVersion: 1,
			type: 'dnd-dm-helper-encounter',
			tags: [],
			participants: [
				{
					id: 'pc-uuid',
					name: 'Aria',
					category: 'pc',
					initiative: 15,
					sheet: {
						name: 'Aria',
						armorClass: 16,
						maxHp: 24,
						spellSlots: [],
						spells: [],
						specialAbilities: [],
						features: [],
						abilityScores: { dex: 14 },
					},
				},
				{
					id: 'monster-uuid',
					name: 'Ogre',
					category: 'monster',
					initiative: 15,
					sheet: {
						name: 'Ogre',
						armorClass: 11,
						maxHp: 59,
						spellSlots: [],
						spells: [],
						specialAbilities: [],
						features: [],
						abilityScores: { dex: 8 },
					},
				},
			],
			lairActions: [],
			traps: [],
		});

		component.openBattleSetup(encounter, 'start');
		const modal = component.battleSetupModal()!;
		expect(modal.sides).toEqual({ 'pc-uuid': 'player', 'monster-uuid': 'enemy' });
		expect(modal.initiatives).toEqual({ 'pc-uuid': 15, 'monster-uuid': 15 });
		expect(modal.initiativeTieBreakers).toEqual({ 'pc-uuid': 14, 'monster-uuid': 8 });
		expect(component.battleSetupTieLabel('pc-uuid')).toBe('Empate resolvido por DES');
	});

	it('closes battle setup with Escape', () => {
		const encounter = TestBed.inject(LocalStorageService).createEncounter('Accessible setup', {
			schemaVersion: 1,
			type: 'dnd-dm-helper-encounter',
			tags: [],
			participants: [],
			lairActions: [],
			traps: [],
		});
		component.startBattle(encounter.id);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe(
			'true',
		);
		component.onEscape();
		expect(component.battleSetupModal()).toBeNull();
	});

	it('exposes formal contextual options and keeps geographic selections hierarchical', () => {
		component.campaignWorld.world.set({
			empires: [{ id: 'mornk', name: 'Mornk', aliases: [] }],
			states: [{ id: 'feng', name: 'Feng', aliases: [], empireId: 'mornk' }],
			settlements: [
				{ id: 'feng-city', name: 'Feng City', aliases: [], stateId: 'feng', settlementType: 'city' },
			],
			organizations: [
				{
					id: 'odl',
					name: 'Olhos de Luna',
					aliases: [],
					organizationType: 'guild',
					scope: 'campaign',
					presence: [],
				},
				{
					id: 'community',
					name: 'Local community',
					aliases: [],
					organizationType: 'group',
					scope: 'local',
					presence: [],
				},
			],
			pointsOfInterest: [],
		} as never);

		expect(component.organizationOptions().map((option) => option.label)).toEqual([
			'Todas as organizações',
			'Olhos de Luna',
		]);
		component.setEmpireFilter('mornk');
		expect(component.stateOptions().map((option) => option.id)).toEqual(['all', 'feng']);
		component.setStateFilter('feng');
		component.setSettlementFilter('feng-city');
		expect(component.filters()).toEqual(
			jasmine.objectContaining({ empireId: 'mornk', stateId: 'feng', settlementId: 'feng-city' }),
		);
	});

	it('keeps an active battle accessible through the ongoing battles panel when its encounter is archived', () => {
		const encounter = TestBed.inject(LocalStorageService).createEncounter('Archived session', {
			schemaVersion: 1,
			type: 'dnd-dm-helper-encounter',
			tags: [],
			archived: true,
			participants: [],
			lairActions: [],
			traps: [],
		});
		const battleStorage = TestBed.inject(BattleEncounterStorageService);
		const battle = battleStorage.createBattleFromEncounter(encounter);
		battleStorage.saveBattleEncounter({ ...battle, status: 'active' });
		component.encounters.set([encounter]);
		component.battles.set(battleStorage.getBattleEncounters());

		expect(component.ongoingBattles().map((item) => item.sourceEncounterId)).toEqual([encounter.id]);
	});

});
