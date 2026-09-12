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

	it('normalizes legacy armor class values and preserves an explicit zero initiative', () => {
		localStorage.setItem(
			'dnd-dm-helper.sheets.v2',
			JSON.stringify([
				{
					id: 'sheet-string-ac', title: 'String AC', createdAt: 1, updatedAt: 1, category: 'monster', tags: [], source: '',
					data: { name: 'String AC', armorClass: '15', maxHp: 1, spellSlots: [], spells: [], specialAbilities: [], features: [] },
				},
				{
					id: 'sheet-invalid-ac', title: 'Invalid AC', createdAt: 1, updatedAt: 1, category: 'monster', tags: [], source: '',
					data: { name: 'Invalid AC', armorClass: 'unknown', maxHp: 1, spellSlots: [], spells: [], specialAbilities: [], features: [] },
				},
			]),
		);
		localStorage.setItem(
			'dnd-dm-helper.encounters.v2',
			JSON.stringify([{
				schemaVersion: 1, type: 'dnd-dm-helper-encounter', id: 'enc', title: 'Encounter', createdAt: 1, updatedAt: 1, tags: [], lairActions: [], traps: [],
				participants: [{ id: 'participant', name: 'Zero', category: 'monster', initiative: 0, sheet: { name: 'Zero', armorClass: '', maxHp: 1, spellSlots: [], spells: [], specialAbilities: [], features: [] } }],
			}]),
		);

		expect(service.listSheets().map((sheet) => sheet.data.armorClass)).toEqual([15, null]);
		expect(service.listEncounters()[0].participants[0].initiative).toBe(0);
		expect(service.listEncounters()[0].participants[0].sheet.armorClass).toBeNull();
	});
});
