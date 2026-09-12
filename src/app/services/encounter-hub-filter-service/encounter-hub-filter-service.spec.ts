import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Encounter } from '../../models/encounter-model';
import { BattleEncounterService } from '../battle-encounter-service/battle-encounter-service';
import { EncounterHubFilterService } from './encounter-hub-filter-service';

describe('EncounterHubFilterService', () => {
	let service: EncounterHubFilterService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideZonelessChangeDetection()],
		});
		service = TestBed.inject(EncounterHubFilterService);
	});

	it('prioritizes active and paused battles in smart sorting', () => {
		const encounters: Encounter[] = [
			{
				schemaVersion: 1,
				type: 'dnd-dm-helper-encounter',
				id: 'enc-1',
				title: 'Prepared',
				createdAt: Date.parse('2026-01-01T10:00:00.000Z'),
				updatedAt: Date.parse('2026-01-01T10:00:00.000Z'),
				tags: [],
				participants: [],
				lairActions: [],
				traps: [],
			},
			{
				schemaVersion: 1,
				type: 'dnd-dm-helper-encounter',
				id: 'enc-2',
				title: 'Running',
				createdAt: Date.parse('2026-01-01T10:00:00.000Z'),
				updatedAt: Date.parse('2026-01-01T10:00:00.000Z'),
				tags: [],
				participants: [],
				lairActions: [],
				traps: [],
			},
		];
		const battle = TestBed.inject(BattleEncounterService).createBattleFromEncounter(encounters[1]);
		const items = service.buildItems(
			encounters,
			[{ ...battle, status: 'active', updatedAt: '2026-01-02T10:00:00.000Z' }],
		);

		const sorted = service.sortItems(items, 'smart');

		expect(sorted[0].encounter.id).toBe('enc-2');
	});

	it('filters direct encounter descriptions, tags, and participant names', () => {
		const items = service.buildItems(
			[
				{
					schemaVersion: 1,
					type: 'dnd-dm-helper-encounter',
					id: 'enc-1',
					title: 'Goblin Roadblock',
					createdAt: 1,
					updatedAt: 1,
					description: 'A broken bridge blocks the forest road.',
					tags: ['forest', 'ambush'],
					participants: [
						{
							id: 'participant-scout',
							name: 'Goblin Scout',
							category: 'monster',
							sheet: {
								name: 'Goblin Scout', armorClass: 13, maxHp: 7, spellSlots: [], spells: [],
								specialAbilities: [], features: [],
							},
						},
					],
					lairActions: [],
					traps: [],
				},
			],
			[]
		);

		for (const query of ['bridge', 'forest', 'goblin scout']) {
			expect(service.filterItems(items, { query, status: 'prepared', sort: 'smart' })).toHaveSize(1);
		}
	});
});
