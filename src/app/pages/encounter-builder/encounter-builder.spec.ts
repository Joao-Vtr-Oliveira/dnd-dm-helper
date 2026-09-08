import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';

import { EncounterBuilder } from './encounter-builder';
import { BattleEncounterStorageService } from '../../services/battle-encounter-storage-service/battle-encounter-storage-service';
import { LocalStorageService } from '../../services/local-storage-service/local-storage-service';

describe('EncounterBuilder', () => {
  let component: EncounterBuilder;
  let fixture: ComponentFixture<EncounterBuilder>;

	beforeEach(async () => {
		localStorage.clear();
    await TestBed.configureTestingModule({
		imports: [EncounterBuilder],
		providers: [
			provideZonelessChangeDetection(),
			provideHttpClient(),
			provideRouter([]),
			{
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({}),
            },
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(EncounterBuilder);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

	 it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('creates manual traps by default and requires an explicit initiative choice', () => {
		expect(component.trapDraft().triggerType).toBe('manual');
		expect(component.trapDraft().frequency).toBe('manual');
		expect(component.trapDraft().initiative).toBe('');

		component.setTrapDraft({ name: 'Pressure Plate' });
		component.addTrap();
		expect(component.encounter().traps?.[0]).toEqual(
			jasmine.objectContaining({ triggerType: 'manual', frequency: 'manual', initiative: undefined }),
		);

		component.setTrapDraftTriggerType('initiative');
		expect(component.trapDraft().initiative).toBe('20');
		component.setTrapDraft({ name: 'Arrow Wall', frequency: 'every-round' });
		component.addTrap();
		expect(component.encounter().traps?.[1]).toEqual(
			jasmine.objectContaining({ triggerType: 'initiative', initiative: 20, frequency: 'every-round' }),
		);
	});

	it('saves a new encounter before creating and navigating to its battle', () => {
		const router = TestBed.inject<any>(Router);
		const navigate = spyOn(router, 'navigate').and.resolveTo(true);
		const battleStorage = TestBed.inject(BattleEncounterStorageService);
		component.title.set('Bridge Ambush');
		component.setTrapDraft({ name: 'Pressure Plate' });
		component.addTrap();

		component.saveAndStartBattle();

		const savedId = component.savedId();
		const battle = savedId ? battleStorage.getActiveBattleByEncounterId(savedId) : null;
		expect(savedId).toBeTruthy();
		expect(battle?.traps[0].triggerType).toBe('manual');
		expect(navigate).toHaveBeenCalledWith(['/home/battle-tracker', battle?.id]);
	});

	it('updates an existing encounter and does not create a second active battle', () => {
		const router = TestBed.inject<any>(Router);
		spyOn(router, 'navigate').and.resolveTo(true);
		const storage = TestBed.inject(LocalStorageService);
		const battleStorage = TestBed.inject(BattleEncounterStorageService);
		const saved = storage.createEncounter('Existing encounter', component.encounter());
		component.savedId.set(saved.id);
		component.title.set('Updated encounter');

		component.saveAndStartBattle();
		component.title.set('Updated again');
		component.saveAndStartBattle();

		expect(storage.getEncounter(saved.id)?.title).toBe('Updated again');
		expect(battleStorage.getBattlesByEncounterId(saved.id)).toHaveSize(1);
		expect(component.saveAndBattleLabel()).toBe('Salvar e continuar batalha');
	});

	it('does not create a battle when saving an unknown encounter fails', () => {
		const battleStorage = TestBed.inject(BattleEncounterStorageService);
		component.savedId.set('missing-encounter');

		component.saveAndStartBattle();

		expect(battleStorage.getBattleEncounters()).toEqual([]);
		expect(component.toast()?.type).toBe('error');
	});

	it('keeps the traditional save action available', () => {
		const router = TestBed.inject<any>(Router);
		const navigate = spyOn(router, 'navigate').and.resolveTo(true);

		component.save();

		expect(component.savedId()).toBeTruthy();
		expect(navigate).toHaveBeenCalledWith(
			['/home/encounter-builder', component.savedId()],
			jasmine.any(Object),
		);
	});
});
