import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EncounterHub } from './encounter-hub';
import { LocalStorageService } from '../../services/local-storage-service/local-storage-service';

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
		expect(component.battleSetupTieLabel('pc-uuid')).toBe('Empate');
		component.setBattleSetupInitiativeTieBreaker('pc-uuid', 16);
		component.setBattleSetupInitiativeTieBreaker('monster-uuid', 12);
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
});
