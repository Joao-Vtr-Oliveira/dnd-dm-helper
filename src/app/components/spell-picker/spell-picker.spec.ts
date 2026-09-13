import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { CompendiumSpellListEntry } from '../../models/compendium-spell-model';
import { CompendiumSpellRepositoryService } from '../../services/compendium-spell-repository-service/compendium-spell-repository-service';
import { SpellPickerComponent } from './spell-picker';

function spellFixture(
	overrides: Partial<CompendiumSpellListEntry> = {},
): CompendiumSpellListEntry {
	return {
		id: 'PHB:fireball',
		name: 'Fireball',
		source: 'PHB',
		level: 3,
		school: 'EV',
		ritual: false,
		concentration: false,
		aliases: ['Bola de Fogo'],
		classes: ['Wizard', 'Sorcerer'],
		...overrides,
	};
}

describe('SpellPickerComponent', () => {
	let component: SpellPickerComponent;
	let fixture: ComponentFixture<SpellPickerComponent>;
	let repository: jasmine.SpyObj<CompendiumSpellRepositoryService>;

	beforeEach(async () => {
		repository = jasmine.createSpyObj<CompendiumSpellRepositoryService>(
			'CompendiumSpellRepositoryService',
			['getIndex'],
		);
		repository.getIndex.and.resolveTo({
			sources: [{ source: 'PHB', path: 'phb.json' }],
			spells: [spellFixture()],
		});

		await TestBed.configureTestingModule({
			imports: [SpellPickerComponent],
			providers: [
				provideZonelessChangeDetection(),
				{ provide: CompendiumSpellRepositoryService, useValue: repository },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(SpellPickerComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('open', true);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('loads the index first and filters its canonical entries', () => {
		const fireball = spellFixture();
		const cureWounds = spellFixture({
			id: 'XGE:cure-wounds',
			name: 'Cure Wounds',
			source: 'XGE',
			level: 1,
			school: 'E',
			aliases: [],
			classes: ['Cleric'],
		});
		component.index.set({ sources: [], spells: [fireball, cureWounds] });

		component.query.set('bola');
		expect(component.spells()).toEqual([fireball]);

		component.query.set('');
		component.source.set('XGE');
		component.level.set('1');
		component.school.set('E');
		component.spellClass.set('Cleric');
		expect(component.spells()).toEqual([cureWounds]);
		expect(repository.getIndex).toHaveBeenCalledTimes(1);
	});

	it('emits the selected canonical index entry without loading spell detail', () => {
		const selected: CompendiumSpellListEntry[] = [];
		component.selected.subscribe((spell) => selected.push(spell));

		component.select(spellFixture());

		expect(selected).toEqual([spellFixture()]);
	});
});
