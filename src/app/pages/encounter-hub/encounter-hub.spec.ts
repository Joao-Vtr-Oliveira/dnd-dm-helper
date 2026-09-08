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
});
