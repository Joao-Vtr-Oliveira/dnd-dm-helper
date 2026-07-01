import { TestBed } from '@angular/core/testing';
import { EncounterHubFilterService } from './encounter-hub-filter-service';

describe('EncounterHubFilterService', () => {
	let service: EncounterHubFilterService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(EncounterHubFilterService);
	});

	it('prioritizes active and paused battles in smart sorting', () => {
		const items = service.buildItems(
			[
				{
					id: 'enc-1',
					title: 'Prepared',
					createdAt: Date.parse('2026-01-01T10:00:00.000Z'),
					updatedAt: Date.parse('2026-01-01T10:00:00.000Z'),
					data: {
						creatures: [],
						creatureIdCount: 0,
						round: 0,
						battleCreated: false,
						shareEnabled: false,
						battleTrackerVersion: '5.123.0',
						sharedTimestamp: null,
						loaded: true,
					},
				},
				{
					id: 'enc-2',
					title: 'Running',
					createdAt: Date.parse('2026-01-01T10:00:00.000Z'),
					updatedAt: Date.parse('2026-01-01T10:00:00.000Z'),
					data: {
						creatures: [],
						creatureIdCount: 0,
						round: 0,
						battleCreated: false,
						shareEnabled: false,
						battleTrackerVersion: '5.123.0',
						sharedTimestamp: null,
						loaded: true,
					},
				},
			],
			[
				{
					id: 'battle-1',
					sourceEncounterId: 'enc-2',
					name: 'Running',
					status: 'active',
					round: 3,
					activeTurnIndex: 0,
					createdAt: '2026-01-01T10:00:00.000Z',
					startedAt: '2026-01-01T10:00:00.000Z',
					updatedAt: '2026-01-02T10:00:00.000Z',
					combatants: [],
					turnHistory: [],
				},
			] as any
		);

		const sorted = service.sortItems(items, 'smart');

		expect(sorted[0].encounter.id).toBe('enc-2');
	});

	it('filters by status and query', () => {
		const items = service.buildItems(
			[
				{
					id: 'enc-1',
					title: 'Goblin Roadblock',
					createdAt: 1,
					updatedAt: 1,
					data: {
						creatures: [{ name: 'Goblin Scout' }],
					},
				},
			] as any,
			[]
		);

		const filtered = service.filterItems(items, {
			query: 'goblin',
			status: 'prepared',
			sort: 'smart',
		});

		expect(filtered).toHaveSize(1);
	});
});
