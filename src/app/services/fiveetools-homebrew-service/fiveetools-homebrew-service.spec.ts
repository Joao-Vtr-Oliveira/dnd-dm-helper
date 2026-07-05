import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { FiveEToolsHomebrewService } from './fiveetools-homebrew-service';

describe('FiveEToolsHomebrewService', () => {
	let service: FiveEToolsHomebrewService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			providers: [provideHttpClient()],
		});
		service = TestBed.inject(FiveEToolsHomebrewService);
	});

	it('parses a valid 5etools file and preserves unknown collections', () => {
		const parsed = service.parseHomebrewJson({
			siteVersion: '2.24.1',
			_meta: {
				sources: [{ json: 'Notion', abbreviation: 'NT', full: 'Notion', version: '1.0.0' }],
			},
			monster: [{ name: 'Mage Test', source: 'Notion', ac: [12], hp: { average: 22, formula: '5d8' } }],
			trap: [{ name: 'Arcane Pulse', source: 'Notion', trapHazType: 'MAG', entries: ['Pulse on initiative 20.'] }],
			hazard: [{ name: 'Extra Hazard' }],
		});

		expect(parsed.monster).toHaveSize(1);
		expect(parsed.trap).toHaveSize(1);
		expect(Array.isArray(parsed['hazard'])).toBeTrue();
	});

	it('lists monsters and traps in a unified summary', () => {
		const file = service.parseHomebrewJson({
			_meta: { sources: [{ json: 'Notion', abbreviation: 'NT', full: 'Notion', version: '1.0.0' }] },
			monster: [{ name: 'Elyra', source: 'Notion', group: ['Nagawoods'], type: 'humanoid' }],
			trap: [{ name: 'Arcane Pulse', source: 'Notion', trapHazType: 'MAG', entries: ['Pulse'] }],
		});

		const entities = service.listEntities(file);

		expect(entities).toHaveSize(2);
		expect(entities.some((entity) => entity.type === 'monster' && entity.name === 'Elyra')).toBeTrue();
		expect(entities.some((entity) => entity.type === 'trap' && entity.name === 'Arcane Pulse')).toBeTrue();
	});

	it('merges a partial file and resolves conflicts by duplication', () => {
		const file = service.parseHomebrewJson({
			_meta: { sources: [{ json: 'Notion', abbreviation: 'NT', full: 'Notion', version: '1.0.0' }] },
			monster: [{ name: 'Breath Test', source: 'Notion', ac: [15] }],
			trap: [],
		});

		const preview = service.prepareImportPartialJson(file, {
			monster: [{ name: 'Breath Test', source: 'Notion', ac: [16] }],
		});

		const merged = service.mergePartialJsonIntoFullFile(file, preview, {
			[preview.conflicts[0].id]: 'duplicate',
		});

		expect(merged.monster).toHaveSize(2);
		expect(merged.monster?.some((monster) => monster.name === 'Breath Test (1)')).toBeTrue();
	});

	it('creates spell tags and updates dateLastModified on export', () => {
		const file = service.createEmptyFile('Notion');
		const before = file._meta.dateLastModified ?? 0;
		const json = service.exportFullJson(file);
		const parsed = JSON.parse(json);

		expect(service.toSpellTag('Fire Bolt', 'XPHB')).toBe('{@spell Fire Bolt|XPHB}');
		expect(parsed._meta.dateLastModified).toBeGreaterThanOrEqual(before);
	});

	it('converts a 5etools monster into an internal creature with spells and special abilities', () => {
		const creature = service.convertMonsterToCreature({
			name: 'Breath Test',
			source: 'Notion',
			type: 'dragon',
			ac: [15],
			hp: { average: 85, formula: '10d10 + 30' },
			dex: 12,
			action: [
				{ name: 'Fire Breath (Recharge 5–6)', entries: ['{@damage 6d6} fire damage.'] },
			],
			spellcasting: [
				{
					name: 'Spellcasting',
					type: 'spellcasting',
					spells: {
						'0': { spells: ['{@spell Fire Bolt|XPHB}'] },
						'1': { spells: ['{@spell Shield|XPHB}'], slots: 4 },
					},
				},
			],
		});

		expect(creature.armorClass).toBe(15);
		expect(creature.maxHealthPoints).toBe(85);
		expect(creature.totalSpellSlots?.['1st']).toBe(4);
		expect(Object.values(creature.spells).some((spell) => spell.label === 'Fire Bolt')).toBeTrue();
		expect(creature.specialAbilities[0].rechargeType).toBe('dice');
	});
});
