import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

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
