import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { CreatureSheet, CreatureSpell } from '../../models/creature-sheet-model';
import { CreatureStatBlockComponent } from './creature-stat-block';

function creatureFixture(overrides: Partial<CreatureSheet> = {}): CreatureSheet {
	return {
		name: 'Archmage',
		armorClass: 12,
		armorClassNote: 'mage armor',
		maxHp: 99,
		spellSlots: [
			{ level: 1, max: 4 },
			{ level: 3, max: 3 },
		],
		spells: [
			{ id: 'light', name: 'Light', level: 0, castingGroup: 'at-will' },
			{ id: 'magic-missile', name: 'Magic Missile', source: 'PHB', level: 1, castingGroup: 'slot' },
			{ id: 'fireball', name: 'Fireball', level: 3, castingGroup: 'slot' },
			{ id: 'plane-shift', name: 'Plane Shift', uses: 1, castingGroup: 'daily' },
			{ id: 'invisibility', name: 'Invisibility', uses: 3, each: true, castingGroup: 'daily' },
			{ id: 'misty-step', name: 'Misty Step', uses: 1, castingGroup: 'rest' },
			{ id: 'teleport', name: 'Teleport', uses: 1, castingGroup: 'weekly' },
			{ id: 'detect-magic', name: 'Detect Magic', castingGroup: 'constant' },
		],
		specialAbilities: [],
		features: [
			{
				id: 'spellcasting',
				name: 'Spellcasting',
				description: 'The archmage is a 9th-level spellcaster.',
				kind: 'trait',
			},
			{ id: 'teleport', name: 'Teleport', kind: 'legendary', legendaryCost: 2 },
		],
		size: 'Medium',
		creatureType: 'humanoid',
		alignment: 'neutral good',
		challengeRating: '12',
		source: 'MM',
		speed: [{ type: 'walk', distance: '30 ft.' }],
		abilityScores: { str: 10, int: 20 },
		savingThrows: [{ ability: 'int', bonus: 9 }],
		skills: [{ name: 'Arcana', bonus: 13 }],
		damageResistances: [{ types: ['fire'], note: 'from spells' }],
		senses: [{ name: 'darkvision', detail: '60 ft.' }],
		passivePerception: 10,
		languages: ['Common', 'Draconic'],
		legendaryActions: { count: 3, intro: 'The archmage can take 3 legendary actions.' },
		spellcasting: { ability: 'int', spellSaveDc: 17, spellAttackBonus: 9 },
		...overrides,
	};
}

describe('CreatureStatBlockComponent', () => {
	let component: CreatureStatBlockComponent;
	let fixture: ComponentFixture<CreatureStatBlockComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [CreatureStatBlockComponent],
			providers: [provideZonelessChangeDetection()],
		}).compileComponents();
		fixture = TestBed.createComponent(CreatureStatBlockComponent);
		component = fixture.componentInstance;
	});

	it('renders a conventional stat block with grouped spellcasting', () => {
		fixture.componentRef.setInput('creature', creatureFixture());
		fixture.detectChanges();

		const text = fixture.nativeElement.textContent;
		expect(text).toContain('Archmage');
		expect(text).toContain('Medium, humanoid, neutral good');
		expect(text).toContain('CR 12');
		expect(text).toContain('Fonte MM');
		expect(text).toContain('CA 12 (mage armor)');
		expect(text).toContain('FOR');
		expect(text).toContain('10 (+0)');
		expect(text).toContain('INT');
		expect(text).toContain('20 (+5)');
		expect(text).toContain('Salvaguardas. INT +9');
		expect(text).toContain('Resistências. fire (from spells)');
		expect(text).toContain('Conjuração');
		expect(text).toContain('Truques (à vontade): Light');
		expect(text).toMatch(/1º nível \(4 espaços\):\s*Magic Missile/);
		expect(text).toMatch(/3º nível \(3 espaços\):\s*Fireball/);
		expect(text).toContain('1/dia: Plane Shift');
		expect(text).toContain('3/dia cada: Invisibility');
		expect(text).toContain('1/descanso: Misty Step');
		expect(text).toContain('1/semana: Teleport');
		expect(text).toContain('Constante: Detect Magic');
		expect(text).toContain('Ações lendárias');
		expect(text).not.toContain('The archmage is a 9th-level spellcaster.');
	});

	it('omits empty optional sections and never renders placeholder dashes', () => {
		fixture.componentRef.setInput(
			'creature',
			creatureFixture({
				armorClass: null,
				spellSlots: [],
				spells: [],
				features: [],
				size: undefined,
				creatureType: undefined,
				challengeRating: undefined,
				speed: undefined,
				abilityScores: undefined,
				savingThrows: undefined,
				skills: undefined,
				damageResistances: undefined,
				senses: undefined,
				passivePerception: undefined,
				languages: undefined,
				legendaryActions: undefined,
				spellcasting: undefined,
			}),
		);
		fixture.detectChanges();

		const text = fixture.nativeElement.textContent;
		expect(text).not.toContain('CA');
		expect(text).not.toContain('Atributos');
		expect(text).not.toContain('Metadados lendários');
		expect(text).not.toContain('Conjuração');
		expect(text).not.toContain('-');
	});

	it('emits sourced spells without embedding a quick view', () => {
		const spell = creatureFixture().spells[1];
		const selected: CreatureSpell[] = [];
		component.selectedSpell.subscribe((value) => selected.push(value));
		fixture.componentRef.setInput('creature', creatureFixture());
		fixture.detectChanges();

		const spellButton = Array.from<HTMLButtonElement>(
			fixture.nativeElement.querySelectorAll('button'),
		).find((button) => button.textContent?.trim() === 'Magic Missile')!;
		spellButton.click();
		fixture.detectChanges();

		expect(selected).toEqual([spell]);
		expect(fixture.nativeElement.textContent).not.toContain('Quick View');
	});

	it('emits a condition reference from an action description', () => {
		const selected: string[] = [];
		component.selectedCondition.subscribe((value) => selected.push(value));
		fixture.componentRef.setInput(
			'creature',
			creatureFixture({
				features: [
					{
						id: 'dagger',
						name: 'Dagger',
						description: 'The target has the Poisoned condition.',
						kind: 'action',
					},
				],
			}),
		);
		fixture.detectChanges();

		const conditionButton = Array.from<HTMLButtonElement>(
			fixture.nativeElement.querySelectorAll('button'),
		).find((button) => button.textContent?.trim() === 'Poisoned')!;
		conditionButton.click();

		expect(selected).toEqual(['poisoned']);
	});

	it('renders battle runtime without changing the static creature definition', () => {
		const creature = creatureFixture();
		fixture.componentRef.setInput('creature', creature);
		fixture.componentRef.setInput('runtimeCombatant', {
			specialAbilities: [
				{
					id: 'rebuke', name: 'Hellish Rebuke', recoveryType: 'uses-per-day', maxUses: 2,
					usedCount: 1, isAvailable: true,
				},
				{
					id: 'brand', name: 'Infernal Brand', recoveryType: 'dice-recharge', rechargeDice: 'd6',
					rechargeOn: [5, 6], usedCount: 0, isAvailable: false,
				},
			],
			spellSlots: [{ level: 3, max: 2, used: 1 }],
		});
		fixture.detectChanges();

		const text = fixture.nativeElement.textContent;
		expect(text).toContain('Estado na batalha');
		expect(text).toContain('1 / 2 disponível');
		expect(text).toContain('Recharge 5–6');
		expect(text).toContain('Aguardando recharge');
		expect(text).toContain('Slots de 3º. 1 / 2 disponíveis');
		expect(creature.specialAbilities).toEqual([]);
	});

	it('removes the elevated frame when embedded', () => {
		fixture.componentRef.setInput('creature', creatureFixture());
		fixture.componentRef.setInput('variant', 'embedded');
		fixture.detectChanges();

		const statBlock = fixture.nativeElement.querySelector('article');
		expect(statBlock.classList).not.toContain('rounded-app-panel');
		expect(statBlock.classList).not.toContain('shadow-app-panel');
	});
});
