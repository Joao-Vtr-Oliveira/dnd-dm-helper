import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BattleTrackerPage } from './battle-tracker';
import { BattleEncounterStorageService } from '../../services/battle-encounter-storage-service/battle-encounter-storage-service';

describe('BattleTrackerPage', () => {
	let component: BattleTrackerPage;
	let fixture: ComponentFixture<BattleTrackerPage>;
	let storage: BattleEncounterStorageService;

	beforeEach(async () => {
		localStorage.clear();

		await TestBed.configureTestingModule({
			imports: [BattleTrackerPage],
			providers: [
				provideZonelessChangeDetection(),
				provideHttpClient(),
				provideRouter([]),
				{
					provide: ActivatedRoute,
					useValue: {
						snapshot: {
							paramMap: convertToParamMap({ battleId: 'battle-1' }),
						},
					},
				},
			],
		}).compileComponents();

		storage = TestBed.inject(BattleEncounterStorageService);
		localStorage.setItem(
			'dnd-dm-helper.battle-encounters.v1',
			JSON.stringify([
				{
					id: 'battle-1',
					sourceEncounterId: 'enc-1',
					name: 'Test Battle',
					status: 'active',
					round: 1,
					activeTurnIndex: 0,
					createdAt: '2026-01-01T10:00:00.000Z',
					startedAt: '2026-01-01T10:00:00.000Z',
					updatedAt: '2026-01-01T10:00:00.000Z',
					turnStartedAt: '2026-01-01T10:00:00.000Z',
					currentTurnElapsedSeconds: 0,
					combatants: [
						{
							id: 'c1',
							name: 'Hero',
							side: 'player',
							initiative: 15,
							turnOrder: 0,
							maxHp: 20,
							currentHp: 20,
							temporaryHp: 0,
							defeated: false,
							hidden: false,
							collapsed: true,
							spellSlotsCollapsed: true,
							pendingAdd: false,
							conditions: [
								{
									id: 'poisoned',
									name: 'poisoned',
									label: 'Poisoned',
									appliedAtRound: 1,
									appliedAtTurnIndex: 0,
									durationType: 'manual',
								},
							],
							specialAbilities: [
								{
									id: 'fire-breath',
									name: 'Fire Breath',
									recoveryType: 'dice-recharge',
									rechargeType: 'dice',
									rechargeDice: 'd6',
									rechargeOn: [5, 6],
									isAvailable: false,
									lastUsedAtRound: 1,
									lastUsedAtTurnIndex: 0,
								},
							],
							spellSlots: [],
							spells: {},
							sheetFeatures: [],
						},
						{
							id: 'c2',
							name: 'Dodman',
							side: 'enemy',
							initiative: 12,
							turnOrder: 1,
							maxHp: 18,
							currentHp: 18,
							temporaryHp: 0,
							defeated: false,
							hidden: false,
							collapsed: true,
							spellSlotsCollapsed: true,
							pendingAdd: false,
							conditions: [],
							specialAbilities: [],
							spellSlots: [],
							spells: {},
							sheetFeatures: [],
						},
						{
							id: 'c3',
							name: 'Rosa',
							side: 'ally',
							initiative: 9,
							turnOrder: 2,
							maxHp: 30,
							currentHp: 30,
							temporaryHp: 0,
							defeated: false,
							hidden: false,
							collapsed: true,
							spellSlotsCollapsed: true,
							pendingAdd: false,
							conditions: [],
							specialAbilities: [],
							spellSlots: [],
							spells: {},
							sheetFeatures: [],
						},
					],
					pendingCombatants: [],
					lairActions: [],
					traps: [
						{
							id: 'ritual-pulse',
							name: 'Ritual Pulse',
							triggerType: 'initiative',
							initiative: 10,
							active: true,
							frequency: 'every-round',
						},
					],
					turnHistory: [],
					dmNotes: '',
				},
			])
		);

		fixture = TestBed.createComponent(BattleTrackerPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
		expect(storage.getBattleEncounterById('battle-1')).toBeTruthy();
	});

	it('shows quick damage controls while the combatant is collapsed', () => {
		const text = fixture.nativeElement.textContent as string;

		expect(text).toContain('Aplicar dano');
		expect(text).not.toContain('HP atual');
	});

	it('applies damage without expanding the combatant card', () => {
		component.setDamageDraft('c1', '7');
		fixture.detectChanges();

		const buttons = Array.from(
			fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
		);
		const damageButton = buttons.find((button) => (button.textContent || '').includes('Aplicar dano'));

		expect(damageButton).toBeTruthy();
		damageButton?.click();
		fixture.detectChanges();

		expect(component.battle()?.combatants[0].currentHp).toBe(13);
		expect(component.battle()?.combatants[0].collapsed).toBeTrue();
	});

	it('shows the current combatant cockpit and follows next turn', () => {
		const cockpit = fixture.nativeElement.querySelector('[data-testid="current-turn-cockpit"]');
		expect(cockpit?.textContent).toContain('Hero');
		expect(cockpit?.textContent).toContain('HP 20 / 20');
		expect(cockpit?.textContent).toContain('Poisoned');

		fixture.nativeElement.querySelector('[data-testid="cockpit-next-turn"]')?.click();
		fixture.detectChanges();

		expect(component.currentCombatant()?.name).toBe('Dodman');
		expect(fixture.nativeElement.querySelector('[data-testid="current-turn-cockpit"]')?.textContent).toContain(
			'Dodman',
		);
	});

	it('applies cockpit damage and healing through the shared battle state', () => {
		component.setDamageDraft('c1', '7');
		fixture.detectChanges();
		fixture.nativeElement.querySelector('[data-testid="cockpit-apply-damage"]')?.click();
		fixture.detectChanges();
		expect(component.battle()?.combatants[0].currentHp).toBe(13);

		component.setHealingDraft('c1', '4');
		fixture.detectChanges();
		fixture.nativeElement.querySelector('[data-testid="cockpit-apply-healing"]')?.click();
		fixture.detectChanges();
		expect(component.battle()?.combatants[0].currentHp).toBe(17);
	});

	it('adds and removes conditions through the cockpit', () => {
		component.setConditionDraft('c1', { preset: 'stunned' });
		fixture.detectChanges();
		fixture.nativeElement.querySelector('[data-testid="cockpit-add-condition"]')?.click();
		fixture.detectChanges();

		const addedCondition = component.battle()?.combatants[0].conditions.find(
			(condition) => condition.name === 'stunned',
		);
		expect(addedCondition).toBeTruthy();

		fixture.nativeElement
			.querySelector(`[aria-label="Remover condição ${addedCondition?.label}"]`)
			?.click();
		fixture.detectChanges();
		expect(component.battle()?.combatants[0].conditions.some((condition) => condition.id === addedCondition?.id)).toBeFalse();
	});

	it('shows upcoming turns and the next environment event in the cockpit', () => {
		expect(component.upcomingTurns().map((event) => event.combatantId)).toEqual(['c2', 'c3', 'c1']);
		expect(component.nextEnvironmentEvent()?.label).toContain('Ritual Pulse');

		const cockpitText = fixture.nativeElement.querySelector('[data-testid="current-turn-cockpit"]')
			?.textContent as string;
		expect(cockpitText).toContain('Dodman');
		expect(cockpitText).toContain('Rosa');
		expect(cockpitText).toContain('Ritual Pulse');
	});

	it('shows and resolves a pending physical dice recharge once on the owner next turn', () => {
		expect(component.pendingDiceRechargeAbilities()).toEqual([]);
		component.nextTurn();
		component.nextTurn();
		component.nextTurn();
		fixture.detectChanges();

		expect(component.currentCombatant()?.id).toBe('c1');
		expect(component.pendingDiceRechargeAbilities().map((ability) => ability.id)).toEqual(['fire-breath']);

		const cockpit = fixture.nativeElement.querySelector('[data-testid="current-turn-cockpit"]');
		const rollThreeButton = Array.from(cockpit.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(
			(button) => button.textContent?.trim() === '3',
		);
		rollThreeButton?.click();
		fixture.detectChanges();

		expect(component.battle()?.combatants[0].specialAbilities[0].isAvailable).toBeFalse();
		expect(component.pendingDiceRechargeAbilities()).toEqual([]);
		expect(cockpit.textContent).toContain('3 - continua em recarga neste turno');
	});
});
