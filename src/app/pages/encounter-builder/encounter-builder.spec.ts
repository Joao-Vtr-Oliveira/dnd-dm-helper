import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
				{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(EncounterBuilder);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('creates a clean canonical encounter', () => {
		const encounter = component.encounter();
		expect(encounter.participants).toEqual([]);
		expect(encounter.lairActions).toEqual([]);
		expect(encounter.traps).toEqual([]);
		expect((encounter as any).creatures).toBeUndefined();
		expect((encounter as any).creatureIdCount).toBeUndefined();
	});

	it('creates a UUID participant for every requested manual quantity', () => {
		component.setDraftName('Skeleton');
		component.setDraftQuantity(3);
		component.addParticipants();

		const participants = component.participants();
		expect(participants).toHaveSize(3);
		expect(new Set(participants.map((participant) => participant.id)).size).toBe(3);
		expect(participants.every((participant) => participant.sheet.maxHp === 0)).toBeTrue();
	});

	it('edits durable values through the participant sheet', () => {
		component.addParticipants();
		const participant = component.participants()[0];
		component.updateSheet(participant.id, { maxHp: 18, armorClass: 14 });
		component.setSpellSlot(participant.id, 2, 3);
		component.setSpellDraft(participant.id, { name: 'Misty Step', level: 2, uses: 1 });
		component.addSpell(participant.id);

		const sheet = component.participants()[0].sheet;
		expect(sheet.maxHp).toBe(18);
		expect(sheet.spellSlots).toContain(jasmine.objectContaining({ level: 2, max: 3 }));
		expect(sheet.spells).toContain(jasmine.objectContaining({ name: 'Misty Step', level: 2 }));
		expect((component.participants()[0] as any).healthPoints).toBeUndefined();
	});

	it('shows and persists recovery values for special abilities', () => {
		component.addParticipants();
		const participant = component.participants()[0];
		component.toggleExpanded(participant.id);
		component.setAbilityDraft(participant.id, {
			name: 'Sopro flamejante',
			recoveryType: 'dice-recharge',
			rechargeOn: '5,6',
		});
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).toContain('Resultados que recarregam (d6)');
		component.addSpecialAbility(participant.id);
		expect(component.participants()[0].sheet.specialAbilities).toContain(
			jasmine.objectContaining({
				recoveryType: 'dice-recharge',
				rechargeDice: 'd6',
				rechargeOn: [5, 6],
			}),
		);

		component.setAbilityDraft(participant.id, {
			name: 'Grito de guerra',
			recoveryType: 'uses-per-day',
			maxUses: 3,
		});
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Usos por dia');
		component.addSpecialAbility(participant.id);
		expect(component.participants()[0].sheet.specialAbilities).toContain(
			jasmine.objectContaining({ recoveryType: 'uses-per-day', maxUses: 3 }),
		);
	});

	it('saves the direct encounter record and routes to its edit URL', () => {
		const router = TestBed.inject(Router);
		const navigate = spyOn(router, 'navigate').and.resolveTo(true);
		component.updateTitle('Bridge Ambush');
		component.updateDescription('Stop the cultists.');
		component.updateTags('bridge, night, bridge');
		component.save();

		const saved = TestBed.inject(LocalStorageService).getEncounter(component.savedId()!);
		expect(saved?.title).toBe('Bridge Ambush');
		expect(saved?.description).toBe('Stop the cultists.');
		expect(saved?.tags).toEqual(['bridge', 'night']);
		expect(navigate).toHaveBeenCalledWith(['/home/encounter-builder', component.savedId()]);
	});

	it('saves before creating a battle', () => {
		const router = TestBed.inject(Router);
		const navigate = spyOn(router, 'navigate').and.resolveTo(true);
		component.addParticipants();
		component.saveAndStartBattle();

		const battle = TestBed.inject(BattleEncounterStorageService).getActiveBattleByEncounterId(
			component.savedId()!,
		);
		expect(battle).not.toBeNull();
		expect(navigate).toHaveBeenCalledWith(['/home/battle-tracker', battle?.id]);
	});
});
