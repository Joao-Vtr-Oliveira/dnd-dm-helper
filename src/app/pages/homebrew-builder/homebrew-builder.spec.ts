import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { HomebrewBuilder } from './homebrew-builder';

describe('HomebrewBuilder', () => {
	let component: HomebrewBuilder;
	let fixture: ComponentFixture<HomebrewBuilder>;

	beforeEach(async () => {
		localStorage.clear();
		await TestBed.configureTestingModule({
			imports: [HomebrewBuilder],
			providers: [
				provideZonelessChangeDetection(),
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
		}).compileComponents();

		fixture = TestBed.createComponent(HomebrewBuilder);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('syncs title into creature name until the user edits the name manually', () => {
		component.setTitle('Rosa V.');
		expect(component.creature().name).toBe('Rosa V.');

		component.setTitle('Rosa Vermelha');
		expect(component.creature().name).toBe('Rosa Vermelha');

		component.setName('Lady Rosa');
		component.setTitle('Rosa Final');
		expect(component.creature().name).toBe('Lady Rosa');
	});

	it('asks before navigating away with unsaved changes', async () => {
		component.setTitle('Ficha pendente');
		const navigation = component.canDeactivate();

		expect(component.unsavedChangesModal()).toBeTrue();
		component.stayOnPage();
		expect(await navigation).toBeFalse();

		const discardNavigation = component.canDeactivate();
		component.discardChanges();
		expect(await discardNavigation).toBeTrue();
	});

	it('stores maximum spell slots without runtime usage state', () => {
		component.setSpellSlot(1, 2);

		expect(component.slotValue(1)).toBe(2);
		expect(component.creature().spellSlots).toEqual([{ level: 1, max: 2 }]);
	});

	it('shows feedback instead of saving a sheet without a creature name', () => {
		component.save();
		expect(component.toast()?.type).toBe('warn');
		expect(component.toast()?.text).toContain('nome');
	});
});
