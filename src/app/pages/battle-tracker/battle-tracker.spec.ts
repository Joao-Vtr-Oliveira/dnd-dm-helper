import { ComponentFixture, TestBed } from '@angular/core/testing';
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
							collapsed: false,
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
});
