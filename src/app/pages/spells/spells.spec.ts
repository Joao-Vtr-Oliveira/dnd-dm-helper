import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import type {
	CompendiumSpell,
	CompendiumSpellListEntry,
} from '../../models/compendium-spell-model';
import { CompendiumSpellRepositoryService } from '../../services/compendium-spell-repository-service/compendium-spell-repository-service';
import { SpellsPage } from './spells';

function spellListFixture(
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
		castingTime: '1 action',
		range: '150 ft.',
		aliases: ['Bola de Fogo'],
		classes: ['Wizard', 'Sorcerer'],
		...overrides,
	};
}

function spellFixture(): CompendiumSpell {
	return {
		...spellListFixture(),
		components: { verbal: true, somatic: true, material: 'bat guano and sulfur' },
		duration: 'Instantaneous',
		entries: ['A bright streak flashes.\nEach creature takes {@damage 8d6} fire damage.'],
		entriesHigherLevel: ['The damage increases by {@damage 1d6}.'],
		damageTypes: ['fire'],
		savingThrows: ['dexterity'],
		attackTypes: [],
		conditions: [],
		classes: ['Sorcerer', 'Wizard'],
		raw: {} as CompendiumSpell['raw'],
	};
}

describe('SpellsPage', () => {
	let component: SpellsPage;
	let fixture: ComponentFixture<SpellsPage>;
	let repository: jasmine.SpyObj<CompendiumSpellRepositoryService>;
	let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

	beforeEach(async () => {
		repository = jasmine.createSpyObj<CompendiumSpellRepositoryService>(
			'CompendiumSpellRepositoryService',
			['getIndex', 'getSpell'],
		);
		repository.getIndex.and.resolveTo({
			sources: [{ source: 'PHB', path: 'phb.json' }],
			spells: [spellListFixture()],
		});
		repository.getSpell.and.resolveTo(spellFixture());
		queryParams = new BehaviorSubject(convertToParamMap({}));

		await TestBed.configureTestingModule({
			imports: [SpellsPage],
			providers: [
				provideZonelessChangeDetection(),
				{ provide: CompendiumSpellRepositoryService, useValue: repository },
				{ provide: ActivatedRoute, useValue: { queryParamMap: queryParams.asObservable() } },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(SpellsPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('filters index entries by aliases and spell traits', () => {
		const fireball = spellListFixture();
		const detectMagic = spellListFixture({
			id: 'PHB:detect-magic',
			name: 'Detect Magic',
			level: 1,
			school: 'D',
			concentration: true,
			ritual: true,
			aliases: [],
			classes: ['Cleric'],
		});
		component.index.set({ sources: [], spells: [fireball, detectMagic] });
		component.query.set('bola de fogo');
		expect(component.spells()).toEqual([fireball]);

		component.query.set('');
		component.concentrationOnly.set(true);
		component.ritualOnly.set(true);
		expect(component.spells()).toEqual([detectMagic]);

		component.concentrationOnly.set(false);
		component.ritualOnly.set(false);
		component.spellClass.set('Wizard');
		expect(component.spells()).toEqual([fireball]);
	});

	it('loads the selected spell detail lazily and renders its separated sections', async () => {
		const entry = spellListFixture();
		await component.select(entry);
		fixture.detectChanges();

		expect(repository.getSpell).toHaveBeenCalledWith('PHB', 'Fireball');
		expect(component.isSelected(entry)).toBeTrue();
		expect(fixture.nativeElement.textContent).toContain('Em níveis superiores');
		expect(fixture.nativeElement.textContent).toContain('Sorcerer, Wizard');
		expect(fixture.nativeElement.textContent).toContain('8d6');
	});

	it('loads a query-param spell after canonicalizing its exact index entry', async () => {
		await fixture.whenStable();
		queryParams.next(convertToParamMap({ source: 'phb', name: 'fireball' }));
		await fixture.whenStable();

		expect(repository.getSpell).toHaveBeenCalledWith('PHB', 'Fireball');
		expect(component.selected()?.name).toBe('Fireball');
	});

	it('formats spell labels and components for the list and detail', () => {
		expect(component.levelLabel(0)).toBe('Truque');
		expect(component.schoolLabel('V')).toBe('Evocação');
		expect(component.componentsLabel(spellFixture().components)).toBe('V, S, M');
	});
});
