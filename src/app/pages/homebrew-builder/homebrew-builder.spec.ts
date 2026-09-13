import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import type { CompendiumSpellListEntry } from '../../models/compendium-spell-model';
import { CompendiumSpellRepositoryService } from '../../services/compendium-spell-repository-service/compendium-spell-repository-service';
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
				{
					provide: CompendiumSpellRepositoryService,
					useValue: { getIndex: async () => ({ sources: [], spells: [] }) },
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

	it('opens the visible compendium action', () => {
		const buttons = fixture.nativeElement.querySelectorAll(
			'button',
		) as NodeListOf<HTMLButtonElement>;
		const action = Array.from(buttons).find((button) =>
			button.textContent?.includes('Adicionar do Compêndio'),
		);

		expect(action).toBeTruthy();
		action!.click();
		fixture.detectChanges();

		expect(component.spellPickerOpen()).toBeTrue();
		expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
	});

	it('adds a compendium spell with its canonical source and rejects only that same source', () => {
		const spell: CompendiumSpellListEntry = {
			id: 'PHB:fireball',
			name: 'Fireball',
			source: 'PHB',
			level: 3,
			school: 'EV',
			ritual: false,
			concentration: false,
			aliases: [],
			classes: ['Wizard'],
		};

		component.addCompendiumSpell(spell);
		component.addCompendiumSpell(spell);

		expect(component.creature().spells).toEqual([
			jasmine.objectContaining({ name: 'Fireball', source: 'PHB', level: 3, uses: 1 }),
		]);
		expect(component.toast()?.type).toBe('warn');
	});

	it('labels spell fields and actions after adding a compendium spell', () => {
		component.addCompendiumSpell({
			id: 'PHB:aid',
			name: 'Aid',
			source: 'PHB',
			level: 2,
			school: 'A',
			ritual: false,
			concentration: false,
			aliases: [],
			classes: [],
		});
		fixture.detectChanges();

		const text = fixture.nativeElement.textContent as string;
		expect(text).toContain('Nome da magia');
		expect(text).toContain('Nível');
		expect(text).toContain('Usos');
		expect(text).toContain('Ações');
	});

	it('allows manual and alternate-source spells with the same name and clears stale links on rename', () => {
		component.addCompendiumSpell({
			id: 'PHB:fireball',
			name: 'Fireball',
			source: 'PHB',
			level: 3,
			school: 'EV',
			ritual: false,
			concentration: false,
			aliases: [],
			classes: [],
		});
		component.addCompendiumSpell({
			id: 'XGE:fireball',
			name: 'Fireball',
			source: 'XGE',
			level: 3,
			school: 'EV',
			ritual: false,
			concentration: false,
			aliases: [],
			classes: [],
		});
		component.setSpellDraft({ name: 'Fireball' });
		component.addSpell();
		const linkedSpellId = component.creature().spells[0].id;

		component.updateSpell(linkedSpellId, { name: 'Custom Fireball' });

		expect(component.creature().spells).toHaveSize(3);
		expect(component.creature().spells[0].source).toBeUndefined();
	});

	it('shows feedback instead of saving a sheet without a creature name', () => {
		component.save();
		expect(component.toast()?.type).toBe('warn');
		expect(component.toast()?.text).toContain('nome');
	});
});
