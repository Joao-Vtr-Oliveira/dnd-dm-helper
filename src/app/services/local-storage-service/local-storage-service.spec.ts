import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { LocalStorageService } from './local-storage-service';

describe('LocalStorageService', () => {
  let service: LocalStorageService;

  beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(LocalStorageService);
		localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

	it('stores direct encounters and canonical creature sheets', () => {
		const sheet = service.createSheet({
			title: 'Goblin Shaman',
			category: 'monster',
			tags: ['goblinoid'],
			source: 'Monster Manual',
			data: {
				name: 'Goblin Shaman',
				armorClass: 13,
				maxHp: 12,
				spellSlots: [],
				spells: [],
				specialAbilities: [],
				features: [],
			},
		});
		expect(sheet.externalId).toBeTruthy();

		const encounter = service.createEncounter('Ruins', {
			schemaVersion: 1,
			type: 'dnd-dm-helper-encounter',
			description: 'A goblin patrol guards the ruins.',
			tags: ['ruins', 'goblins'],
			participants: [
				{
					id: 'participant-shaman',
					name: 'Goblin Shaman',
					sourceSheetId: sheet.id,
					initiative: 2,
					category: 'monster',
					sheet: sheet.data,
				},
			],
			lairActions: [],
			traps: [],
		});

		expect(encounter.description).toBe('A goblin patrol guards the ruins.');
		expect(encounter.tags).toEqual(['ruins', 'goblins']);
		expect(encounter.participants[0].id).toBe('participant-shaman');
		expect(encounter.participants[0].sheet).toEqual(sheet.data);
	});
});
