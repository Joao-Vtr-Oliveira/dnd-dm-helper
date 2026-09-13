import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { CreatureStatBlockComponent } from '../../components/creature-stat-block/creature-stat-block';
import { BattleTrackerPage } from './battle-tracker';
import { BattleEncounterStorageService } from '../../services/battle-encounter-storage-service/battle-encounter-storage-service';
import { SpellReferenceResolverService } from '../../services/spell-reference-resolver-service/spell-reference-resolver-service';

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
					provide: SpellReferenceResolverService,
					useValue: {
						resolveReference: async () => ({
							reference: { name: 'Aid', source: 'PHB' },
							spell: {
								id: 'PHB:aid',
								name: 'Aid',
								source: 'PHB',
								aliases: [],
								level: 2,
								school: 'A',
								components: { verbal: true, somatic: true },
								concentration: false,
								ritual: false,
								entries: [],
								entriesHigherLevel: [],
								damageTypes: [],
								savingThrows: [],
								attackTypes: [],
								conditions: [],
								classes: [],
								raw: {} as never,
							},
						}),
					},
				},
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
							category: 'pc',
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
							spells: [{ id: 'spell-aid', name: 'Aid', source: 'PHB', level: 2, uses: 1 }],
							features: [],
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
							spells: [],
							features: [],
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
							spells: [],
							features: [],
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
			]),
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
		const damageButton = buttons.find((button) =>
			(button.textContent || '').includes('Aplicar dano'),
		);

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
		expect(
			fixture.nativeElement.querySelector('[data-testid="current-turn-cockpit"]')?.textContent,
		).toContain('Dodman');
	});

	it('allows collapsing cockpit details while keeping the current turn header available', () => {
		const cockpit = fixture.nativeElement.querySelector('[data-testid="current-turn-cockpit"]');
		const details = cockpit.querySelector('details') as HTMLDetailsElement;
		const summary = details.querySelector('summary') as HTMLElement;

		expect(details.open).toBeTrue();
		expect(cockpit.textContent).toContain('Hero');
		expect(cockpit.textContent).toContain('Próximo turno');

		summary.click();
		fixture.detectChanges();
		expect(details.open).toBeFalse();
	});

	it('opens only the selected combatant inspector while keeping other combatants compact', () => {
		component.toggleCombatantInspector('c1');
		fixture.detectChanges();
		expect(component.selectedCombatantId()).toBe('c1');
		expect(fixture.nativeElement.textContent).toContain('HP atual');

		component.toggleCombatantInspector('c2');
		fixture.detectChanges();
		expect(component.selectedCombatantId()).toBe('c2');
		const heroCard = fixture.nativeElement.querySelector(
			'[data-testid="combatant-card"][data-combatant-id="c1"]',
		) as HTMLElement;
		expect(heroCard?.textContent).toContain('Dano rapido');
		expect(heroCard?.textContent).not.toContain('Notas privadas');
	});

	it('opens a synthesized full sheet for legacy combatants without a reference snapshot', () => {
		const hero = component.battle()!.combatants[0];

		component.openReferenceSheetViewer(hero);
		fixture.detectChanges();

		const dialog = fixture.nativeElement.querySelector('[data-battle-modal]') as HTMLElement;
		const statBlock = fixture.debugElement.query(By.directive(CreatureStatBlockComponent));
		expect(component.referenceSheetViewer()?.creature).toEqual(
			jasmine.objectContaining({
				name: 'Hero',
				maxHp: 20,
				spells: hero.spells,
			}),
		);
		expect(dialog.getAttribute('aria-labelledby')).toBe('battle-reference-sheet-title');
		expect(dialog.classList).toContain('max-w-7xl');
		expect(dialog.querySelector('#battle-reference-sheet-title')?.textContent).toContain('Hero');
		expect(statBlock.componentInstance.variant).toBe('embedded');

		component.closeReferenceSheetViewer();
		fixture.detectChanges();
	});

	it('closes the reference sheet with Escape and releases the dialog body lock', () => {
		component.openReferenceSheetViewer(component.battle()!.combatants[0]);
		fixture.detectChanges();

		expect(document.body.classList.contains('app-dialog-open')).toBeTrue();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		fixture.detectChanges();

		expect(component.referenceSheetViewer()).toBeNull();
		expect(document.body.classList.contains('app-dialog-open')).toBeFalse();
	});

	it('hands a reference sheet spell selection to Quick Spell View', async () => {
		component.openReferenceSheetViewer(component.battle()!.combatants[0]);
		fixture.detectChanges();

		const statBlock = fixture.debugElement.query(By.directive(CreatureStatBlockComponent));
		statBlock.componentInstance.selectedSpell.emit(component.battle()!.combatants[0].spells[0]);
		await fixture.whenStable();
		fixture.detectChanges();

		expect(component.referenceSheetViewer()).toBeNull();
		expect(component.quickSpell()?.spell.name).toBe('Aid');
	});

	it('keeps undefined tie breakers and empty ability states out of the combatant view', () => {
		expect(component.initiativeSummary(component.battle()!.combatants[0])).toBe('Iniciativa 15');

		component.toggleCombatantInspector('c2');
		fixture.detectChanges();
		const dodmanCard = fixture.nativeElement.querySelector(
			'[data-testid="combatant-card"][data-combatant-id="c2"]',
		) as HTMLElement;
		expect(dodmanCard?.textContent).toContain('Adicionar habilidade especial');
		expect(dodmanCard?.textContent).not.toContain('Habilidades especiais');
	});

	it('uses an accessible dialog that closes with Escape', () => {
		component.openAddCombatantModal();
		fixture.detectChanges();

		const dialog = fixture.nativeElement.querySelector('[data-battle-modal]') as HTMLElement;
		expect(dialog?.getAttribute('role')).toBe('dialog');
		expect(dialog?.getAttribute('aria-modal')).toBe('true');
		expect(dialog?.getAttribute('aria-labelledby')).toBe('add-combatant-title');

		component.onDocumentKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
		fixture.detectChanges();
		expect(component.addCombatantModalOpen()).toBeFalse();
	});

	it('restores the cockpit state through real turn undo and disables undo without a snapshot', () => {
		const undoButton = Array.from(
			fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
		).find((button) => button.textContent?.includes('Desfazer turno'));
		expect(undoButton?.disabled).toBeTrue();

		component.nextTurn();
		fixture.detectChanges();
		expect(component.currentCombatant()?.name).toBe('Dodman');

		component.undoTurn();
		fixture.detectChanges();
		expect(component.currentCombatant()?.name).toBe('Hero');
		expect(component.battle()?.turnSnapshots).toEqual([]);
		expect(undoButton?.disabled).toBeTrue();
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

		const addedCondition = component
			.battle()
			?.combatants[0].conditions.find((condition) => condition.name === 'stunned');
		expect(addedCondition).toBeTruthy();

		fixture.nativeElement
			.querySelector(`[aria-label="Remover condição ${addedCondition?.label}"]`)
			?.click();
		fixture.detectChanges();
		expect(
			component
				.battle()
				?.combatants[0].conditions.some((condition) => condition.id === addedCondition?.id),
		).toBeFalse();
	});

	it('controls concentration from the cockpit and creates a check through quick damage', () => {
		fixture.nativeElement.querySelector('[data-testid="cockpit-concentration-toggle"]')?.click();
		component.setDamageDraft('c1', '24');
		fixture.detectChanges();
		fixture.nativeElement.querySelector('[data-testid="cockpit-apply-damage"]')?.click();
		fixture.detectChanges();

		const action = component.battle()?.pendingActions[0];
		expect(
			component
				.battle()
				?.combatants[0].conditions.some((condition) => condition.name === 'concentrating'),
		).toBeTrue();
		expect(action?.type === 'concentration-check' && action.difficultyClass).toBe(12);
		expect(
			fixture.nativeElement.querySelector('[data-testid="pending-actions"]')?.textContent,
		).toContain('Hero');
	});

	it('shows and resolves a concentration check for a combatant outside the current turn', () => {
		component.startConcentration('c3');
		component.setDamageDraft('c3', '28');
		component.applyDamage('c3');
		fixture.detectChanges();

		const cockpit = fixture.nativeElement.querySelector('[data-testid="current-turn-cockpit"]');
		expect(component.currentCombatant()?.id).toBe('c1');
		expect(cockpit.textContent).toContain('Rosa');
		expect(cockpit.textContent).toContain('CD 14');

		fixture.nativeElement.querySelector('[data-testid="concentration-failure"]')?.click();
		fixture.detectChanges();
		expect(component.battle()?.pendingActions).toEqual([]);
		expect(
			component
				.battle()
				?.combatants[2].conditions.some((condition) => condition.name === 'concentrating'),
		).toBeFalse();
	});

	it('resolves a non-current combatant concentration check from that combatant card', () => {
		component.startConcentration('c3');
		component.setDamageDraft('c3', '28');
		component.applyDamage('c3');
		fixture.detectChanges();

		const check = fixture.nativeElement.querySelector(
			'[data-testid="combatant-concentration-check"]',
		) as HTMLElement;
		expect(check?.textContent).toContain('CD 14');
		expect(check?.textContent).toContain('Teste de concentração pendente');

		Array.from(check.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
			.find((button) => button.textContent?.trim() === 'Falha')
			?.click();
		fixture.detectChanges();

		expect(component.battle()?.pendingActions).toEqual([]);
		expect(
			component
				.battle()
				?.combatants[2].conditions.some((condition) => condition.name === 'concentrating'),
		).toBeFalse();
	});

	it('uses compact accessible concentration switches without showing it as a removable generic condition', () => {
		const cardSwitch = Array.from(
			fixture.nativeElement.querySelectorAll(
				'[data-testid="combatant-concentration-toggle"]',
			) as NodeListOf<HTMLButtonElement>,
		).find((element) => element.getAttribute('aria-label') === 'Concentração de Hero');

		expect(cardSwitch?.getAttribute('role')).toBe('switch');
		expect(cardSwitch?.getAttribute('aria-checked')).toBe('false');
		cardSwitch?.click();
		fixture.detectChanges();

		expect(cardSwitch?.getAttribute('aria-checked')).toBe('true');
		expect(
			component
				.battle()
				?.combatants[0].conditions.some((condition) => condition.name === 'concentrating'),
		).toBeTrue();
		expect(
			component.conditionOptions.some((condition) => condition.name === 'concentrating'),
		).toBeFalse();
	});

	it('starts death saves from a PC card and records the physical d20 in the cockpit', () => {
		expect(fixture.nativeElement.querySelector('[data-testid="start-death-saves"]')).toBeNull();
		component.toggleCombatantInspector('c1');
		fixture.detectChanges();
		fixture.nativeElement.querySelector('[data-testid="start-death-saves"]')?.click();
		fixture.detectChanges();
		expect(component.battle()?.combatants[0].deathSaves).toEqual({
			status: 'active',
			successes: 0,
			failures: 0,
		});
		expect(component.battle()?.pendingActions).toEqual([]);

		component.nextTurn();
		component.nextTurn();
		component.nextTurn();
		fixture.detectChanges();
		const results = fixture.nativeElement.querySelectorAll(
			'[data-testid="death-save-result"]',
		) as NodeListOf<HTMLButtonElement>;

		expect(results).toHaveSize(20);
		Array.from(results)
			.find((button) => button.textContent?.trim() === '20')
			?.click();
		fixture.detectChanges();
		expect(component.battle()?.combatants[0].deathSaves).toBeUndefined();
	});

	it('hides empty spell slots, spells, and sheet data from expanded cards', () => {
		component.toggleCombatantInspector('c2');
		fixture.detectChanges();

		const text = fixture.nativeElement.querySelector(
			'[data-testid="combatant-card"][data-combatant-id="c2"]',
		)?.textContent as string;
		expect(text).not.toContain('Espaços de magia');
		expect(text).not.toContain('Magias conhecidas');
		expect(text).not.toContain('Dados da ficha');
		expect(text).not.toContain('Ativar slots');
	});

	it('opens a linked spell from the combatant spell list', async () => {
		component.toggleCombatantInspector('c1');
		fixture.detectChanges();
		const card = fixture.nativeElement.querySelector(
			'[data-testid="combatant-card"][data-combatant-id="c1"]',
		) as HTMLElement;
		const quickView = card.querySelector('[data-testid="quick-spell-view"]') as HTMLButtonElement;

		expect(quickView?.textContent).toContain('Ver detalhes');
		quickView.click();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(component.quickSpell()?.spell.name).toBe('Aid');
		expect(fixture.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain('Aid');
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
		expect(component.pendingDiceRechargeAbilities().map((ability) => ability.id)).toEqual([
			'fire-breath',
		]);

		const cockpit = fixture.nativeElement.querySelector('[data-testid="current-turn-cockpit"]');
		const rollThreeButton = Array.from(
			cockpit.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
		).find((button) => button.textContent?.trim() === '3');
		rollThreeButton?.click();
		fixture.detectChanges();

		expect(component.battle()?.combatants[0].specialAbilities[0].isAvailable).toBeFalse();
		expect(component.pendingDiceRechargeAbilities()).toEqual([]);
		expect(cockpit.textContent).toContain('3 - continua em recarga neste turno');
	});
});
