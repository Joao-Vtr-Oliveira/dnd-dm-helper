import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';

import { EncounterHub } from './encounter-hub';
import { BattleEncounterStorageService } from '../../services/battle-encounter-storage-service/battle-encounter-storage-service';
import { LocalStorageService } from '../../services/local-storage-service/local-storage-service';

describe('EncounterHub', () => {
  let component: EncounterHub;
  let fixture: ComponentFixture<EncounterHub>;

	beforeEach(async () => {
		localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EncounterHub],
       providers: [provideZonelessChangeDetection(), provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(EncounterHub);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('opens one encounter action menu at a time and closes it with Escape', () => {
		component.toggleActionMenu('first');
		expect(component.actionMenuEncounterId()).toBe('first');
		component.toggleActionMenu('second');
		expect(component.actionMenuEncounterId()).toBe('second');
		component.onEscape();
		expect(component.actionMenuEncounterId()).toBeNull();
	});

	it('closes the encounter action menu when clicking outside it', () => {
		component.toggleActionMenu('first');
		fixture.nativeElement.firstElementChild.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(component.actionMenuEncounterId()).toBeNull();
	});

	it('uses an accessible dialog and closes battle setup with Escape', () => {
		const storage = TestBed.inject(LocalStorageService);
		const saved = storage.createEncounter('Accessible setup', {
			creatures: [],
			creatureIdCount: 0,
			lairActions: [],
			traps: [],
			round: 0,
			battleCreated: false,
			shareEnabled: false,
			battleTrackerVersion: '5.123.0',
			sharedTimestamp: null,
			loaded: true,
		});

		component.startBattle(saved.id);
		fixture.detectChanges();

		const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
		expect(dialog?.getAttribute('aria-modal')).toBe('true');
		expect(dialog?.getAttribute('aria-labelledby')).toBe('battle-setup-title');
		component.onEscape();
		expect(component.battleSetupModal()).toBeNull();
	});

	it('resumes a paused battle before opening its tracker', () => {
		const storage = TestBed.inject(LocalStorageService);
		const battleStorage = TestBed.inject(BattleEncounterStorageService);
		const router = TestBed.inject(Router);
		const navigate = spyOn(router, 'navigate');
		const saved = storage.createEncounter('Paused battle', {
			creatures: [],
			creatureIdCount: 0,
			lairActions: [],
			traps: [],
			round: 0,
			battleCreated: false,
			shareEnabled: false,
			battleTrackerVersion: '5.123.0',
			sharedTimestamp: null,
			loaded: true,
		});
		const battle = battleStorage.createBattleFromEncounter(saved);
		battleStorage.pauseBattleEncounter(battle.id);

		component.continueBattle(saved.id);

		expect(battleStorage.getBattleEncounters().find((entry) => entry.id === battle.id)?.status).toBe('active');
		expect(navigate).toHaveBeenCalledWith(['/home/battle-tracker', battle.id]);
	});

	it('confirms and removes battles before deleting their encounter', () => {
		const storage = TestBed.inject(LocalStorageService);
		const battleStorage = TestBed.inject(BattleEncounterStorageService);
		const saved = storage.createEncounter('Encounter with battle', {
			creatures: [],
			creatureIdCount: 0,
			lairActions: [],
			traps: [],
			round: 0,
			battleCreated: false,
			shareEnabled: false,
			battleTrackerVersion: '5.123.0',
			sharedTimestamp: null,
			loaded: true,
		});
		battleStorage.createBattleFromEncounter(saved);

		component.remove(saved.id);
		expect(component.confirmModal()?.action).toBe('delete-encounter-and-battles');
		component.confirmNewBattle();

		expect(storage.getEncounter(saved.id)).toBeNull();
		expect(battleStorage.getBattlesByEncounterId(saved.id)).toEqual([]);
	});

	it('requires confirmation before deleting an encounter without battles', () => {
		const storage = TestBed.inject(LocalStorageService);
		const saved = storage.createEncounter('Standalone encounter', {
			creatures: [],
			creatureIdCount: 0,
			lairActions: [],
			traps: [],
			round: 0,
			battleCreated: false,
			shareEnabled: false,
			battleTrackerVersion: '5.123.0',
			sharedTimestamp: null,
			loaded: true,
		});

		component.remove(saved.id);
		expect(component.confirmModal()?.action).toBe('delete-encounter');
		expect(storage.getEncounter(saved.id)).not.toBeNull();
		component.confirmNewBattle();
		expect(storage.getEncounter(saved.id)).toBeNull();
	});

	it('uses the shared battle preparation operation when launching a battle', () => {
		const storage = TestBed.inject(LocalStorageService);
		const battleStorage = TestBed.inject(BattleEncounterStorageService);
		const prepare = spyOn(battleStorage, 'getOrCreateBattleFromEncounter').and.callThrough();
		const saved = storage.createEncounter('Hub encounter', {
			creatures: [],
			creatureIdCount: 0,
			lairActions: [],
			traps: [],
			round: 0,
			battleCreated: false,
			shareEnabled: false,
			battleTrackerVersion: '5.123.0',
			sharedTimestamp: null,
			loaded: true,
		});

		component.startBattle(saved.id);
		component.launchBattleFromSetup();

		expect(prepare).toHaveBeenCalledWith(
			saved,
			jasmine.any(Object),
			false,
		);
	});

	it('marks initiative ties without requiring DES and resolves them when DES values differ', () => {
		const storage = TestBed.inject(LocalStorageService);
		const saved = storage.createEncounter('Tie encounter', {
			creatures: [
				{
					id: 1,
					name: 'Thorn',
					initiative: 17,
					healthPoints: 10,
					maxHealthPoints: 10,
					armorClass: 12,
					temporaryHealthPoints: 0,
					alive: true,
					conditions: [],
					notes: [],
					shared: true,
					hitPointsShared: true,
					totalSpellSlots: null,
					usedSpellSlots: null,
					spells: {},
					specialAbilities: [],
				},
				{
					id: 2,
					name: 'Dodman',
					initiative: 17,
					healthPoints: 10,
					maxHealthPoints: 10,
					armorClass: 12,
					temporaryHealthPoints: 0,
					alive: true,
					conditions: [],
					notes: [],
					shared: true,
					hitPointsShared: true,
					totalSpellSlots: null,
					usedSpellSlots: null,
					spells: {},
					specialAbilities: [],
				},
			],
			creatureIdCount: 2,
			lairActions: [],
			traps: [],
			round: 0,
			battleCreated: false,
			shareEnabled: false,
			battleTrackerVersion: '5.123.0',
			sharedTimestamp: null,
			loaded: true,
		});

		component.openBattleSetup(saved, 'start');
		expect(component.battleSetupTieLabel(1)).toBe('Empate');
		component.setBattleSetupInitiative(1, '0');
		component.setBattleSetupInitiative(2, '0');
		fixture.detectChanges();
		expect(component.isBattleSetupInitiativeTied(1)).toBeFalse();
		expect(fixture.nativeElement.textContent).not.toContain('DES (desempate)');

		component.setBattleSetupInitiative(1, '17');
		component.setBattleSetupInitiative(2, '17');
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('DES (desempate)');
		component.setBattleSetupInitiativeTieBreaker(1, '16');
		component.setBattleSetupInitiativeTieBreaker(2, '12');

		expect(component.battleSetupTieLabel(1)).toBe('Empate resolvido por DES');
		component.launchBattleFromSetup();
		expect(TestBed.inject(BattleEncounterStorageService).getBattleEncounters()[0].combatants[0].name).toBe(
			'Thorn',
		);
	});
});
