import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { LocalStorageService } from './local-storage-service';

describe('LocalStorageService', () => {
  let service: LocalStorageService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
		service = TestBed.inject(LocalStorageService);
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
		expect(service.listSheets()[0].archived).toBeUndefined();
		expect(service.listSheets()[0].locationRefs).toBeUndefined();
		expect(service.listSheets()[0].organizationRefs).toBeUndefined();
		expect(service.listEncounters()[0].participants[0].initiative).toBe(0);
		expect(service.listEncounters()[0].participants[0].sheet.armorClass).toBeNull();
	});

	it('preserves contextual sheet metadata outside stat blocks and during duplication', () => {
		const sheet = service.createSheet({
			title: 'Patrulheiro de Contato C',
			category: 'npc',
			data: {
				name: 'Patrulheiro de Contato C',
				armorClass: 15,
				maxHp: 24,
				spellSlots: [],
				spells: [],
				specialAbilities: [],
				features: [],
			},
			archived: true,
			generic: true,
			organizationRefs: [{ organizationId: 'guard', relation: 'institution' }],
		});
		const duplicate = service.duplicateSheet(sheet.id)!;

		expect(sheet.archived).toBeTrue();
		expect(sheet.generic).toBeTrue();
		expect(duplicate.generic).toBeTrue();
		expect(duplicate.locationRefs).toEqual(sheet.locationRefs);
		expect(duplicate.organizationRefs).toEqual(sheet.organizationRefs);
		expect('locationRefs' in sheet.data).toBeFalse();
		expect('organizationRefs' in sheet.data).toBeFalse();

		const encounter = service.createEncounter('Patrulha', {
			schemaVersion: 1,
			type: 'dnd-dm-helper-encounter',
			tags: [],
			participants: [
				{
					id: 'patrol',
					sourceSheetId: sheet.id,
					name: sheet.title,
					category: 'npc',
					initiative: null,
					sheet: sheet.data,
				},
			],
			lairActions: [],
			traps: [],
		});
		expect('locationRefs' in encounter.participants[0].sheet).toBeFalse();
		expect('organizationRefs' in encounter.participants[0].sheet).toBeFalse();
	});

	it('preserves encounter metadata through creation, editing, duplication, and legacy loading', () => {
		const encounter = service.createEncounter('Ruins Patrol', {
			schemaVersion: 1,
			type: 'dnd-dm-helper-encounter',
			tags: ['ruins'],
			archived: true,
			locationRefs: [
				{ scopeType: 'state', scopeId: 'feng', relation: 'operation' },
				{ scopeType: 'settlement', scopeId: 'feng-city', relation: 'occurrence' },
			],
			organizationRefs: [{ organizationId: 'winterhold', relation: 'affiliated' }],
			participants: [],
			lairActions: [],
			traps: [],
		});

		const duplicate = service.duplicateEncounter(encounter.id)!;
		expect(encounter.archived).toBeTrue();
		expect(duplicate.archived).toBeTrue();
		expect(duplicate.locationRefs).toEqual(encounter.locationRefs);
		expect(duplicate.organizationRefs).toEqual(encounter.organizationRefs);

		service.updateEncounter(encounter.id, { archived: false, tags: ['updated'] });
		expect(service.getEncounter(encounter.id)?.archived).toBeUndefined();
		expect(service.getEncounter(encounter.id)?.tags).toEqual(['updated']);

		localStorage.setItem(
			'dnd-dm-helper.encounters.v2',
			JSON.stringify([
				{
					schemaVersion: 1,
					type: 'dnd-dm-helper-encounter',
					id: 'legacy-encounter',
					title: 'Legacy',
					createdAt: 1,
					updatedAt: 1,
					tags: [],
					participants: [],
					lairActions: [],
					traps: [],
				},
			]),
		);
		const legacy = service.getEncounter('legacy-encounter');
		expect(legacy?.archived).toBeUndefined();
		expect(legacy?.locationRefs).toBeUndefined();
		expect(legacy?.organizationRefs).toBeUndefined();
	});

	it('preserves formal classes through creation, editing, duplication, and normalization', () => {
		const sheet = service.createSheet({
			title: 'Ranger NPC',
			category: 'npc',
			classes: ['ranger'],
			tags: ['Ranger'],
			source: 'Mesa',
			data: {
				name: 'Ranger NPC',
				armorClass: 14,
				maxHp: 20,
				spellSlots: [],
				spells: [],
				specialAbilities: [],
				features: [],
			},
		});
		service.updateSheet(sheet.id, { classes: ['rogue'] });
		const duplicate = service.duplicateSheet(sheet.id)!;

		expect(service.getSheet(sheet.id)?.classes).toEqual(['rogue']);
		expect(duplicate.classes).toEqual(['rogue']);
		expect('classes' in duplicate.data).toBeFalse();

		const pc = service.createSheet({
			title: 'Wizard PC',
			category: 'pc',
			classes: ['wizard'],
			source: 'Mesa',
			data: {
				name: 'Wizard PC',
				armorClass: 12,
				maxHp: 16,
				spellSlots: [],
				spells: [],
				specialAbilities: [],
				features: [],
			},
		});
		expect(service.duplicateSheet(pc.id)?.classes).toEqual(['wizard']);
	});

	it('rejects classes on monsters and rejects classes outside the 13-class catalog', () => {
		const params = {
			title: 'Invalid class sheet',
			category: 'monster' as const,
			data: {
				name: 'Invalid class sheet',
				armorClass: 10,
				maxHp: 1,
				spellSlots: [],
				spells: [],
				specialAbilities: [],
				features: [],
			},
		};
		expect(() => service.createSheet({ ...params, classes: ['ranger'] })).toThrowError(/NPC ou PC/);
		expect(() =>
			service.createSheet({
				...params,
				category: 'npc',
				classes: ['artificer', 'invalid'] as never,
			}),
		).toThrowError(/artificer.*wizard/);
	});
});
