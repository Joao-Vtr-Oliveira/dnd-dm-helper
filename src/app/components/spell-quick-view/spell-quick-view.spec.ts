import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { CompendiumSpell } from '../../models/compendium-spell-model';
import type { ResolvedSpellReference } from '../../models/spell-reference-model';
import { SpellQuickViewComponent } from './spell-quick-view';

function spellFixture(): CompendiumSpell {
	return {
		id: 'PHB:fireball',
		name: 'Fireball',
		source: 'PHB',
		aliases: [],
		level: 3,
		school: 'V',
		castingTime: '1 action',
		range: '150 ft.',
		components: { verbal: true, somatic: true, material: 'bat guano and sulfur' },
		duration: 'Instantaneous',
		concentration: false,
		ritual: false,
		entries: ['A bright streak deals {@damage 8d6} fire damage.'],
		entriesHigherLevel: ['The damage increases by {@damage 1d6}.'],
		damageTypes: ['fire'],
		savingThrows: ['dexterity'],
		attackTypes: [],
		conditions: [],
		classes: ['Sorcerer', 'Wizard'],
		raw: {} as CompendiumSpell['raw'],
	};
}

describe('SpellQuickViewComponent', () => {
	let component: SpellQuickViewComponent;
	let fixture: ComponentFixture<SpellQuickViewComponent>;
	let router: Router;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SpellQuickViewComponent],
			providers: [provideZonelessChangeDetection(), provideRouter([])],
		}).compileComponents();
		fixture = TestBed.createComponent(SpellQuickViewComponent);
		component = fixture.componentInstance;
		router = TestBed.inject(Router);
	});

	it('renders complete details from a resolved reference', () => {
		component.spell = {
			reference: { name: 'Fireball', source: 'PHB' },
			spell: spellFixture(),
		} satisfies ResolvedSpellReference;
		component.open = true;
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).toContain('Fireball');
		expect(fixture.nativeElement.textContent).toContain('Em níveis superiores');
		expect(fixture.nativeElement.textContent).toContain('Sorcerer, Wizard');
		expect(fixture.nativeElement.textContent).toContain('8d6');
	});

	it('opens the canonical compendium route for a direct spell', () => {
		component.spell = spellFixture();
		const navigate = spyOn(router, 'navigate').and.resolveTo(true);

		component.openInCompendium();

		expect(navigate).toHaveBeenCalledWith(['/home/compendium/spells'], {
			queryParams: { source: 'PHB', name: 'Fireball' },
		});
	});
});
