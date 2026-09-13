import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CompendiumRendererService } from './compendium-renderer-service';

describe('CompendiumRendererService', () => {
	let service: CompendiumRendererService;

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
		service = TestBed.inject(CompendiumRendererService);
	});

	it('renders supported tags and leaves unknown tags readable', () => {
		const text = service.renderText(
			'Hit: {@hit 7} to hit. {@damage 2d6 + 3} fire; {@dc 15} {@condition blinded}; {@spell fireball|XPHB}; {@custom Label|value}.',
		);

		expect(text).toBe('Hit: +7 to hit. 2d6 + 3 fire; DC 15 blinded; fireball; Label.');
	});

	it('renders nested and pipe-tag labels plus d20 and scaling fallbacks', () => {
		const text = service.renderText(
			'{@i Cast {@spell shield|PHB|Shield Spell}} with {@d20 8}; {@scaledamage 2d6|1-9|1d6}.',
		);

		expect(text).toBe('Cast Shield Spell with +8; 2d6.');
	});

	it('extracts spell references only from complete spell tags', () => {
		expect(service.spellReference('{@spell shield|XPHB}')).toEqual({ name: 'shield', source: 'XPHB' });
		expect(service.spellReference('shield')).toBeNull();
	});

	it('renders common combat tags plus nested lists and tables', () => {
		const text = service.renderEntries([
			{
				type: 'list',
				items: [
					{ type: 'item', name: 'Claw', entries: ['{@atk mw} {@hit 8} to hit. {@h}{@damage 2d6} slashing.'] },
					'Save {@actSave dex}; {@recharge 4}.',
				],
			},
			{
				type: 'table',
				caption: 'Breath Weapon',
				colLabels: ['{@dice d6}', 'Effect'],
				rows: [[{ type: 'cell', roll: { min: 1, max: 4 } }, '{@chance 50} {@condition frightened}']],
			},
		]);

		expect(text).toContain('- Claw: Melee Weapon Attack: +8 to hit. Hit: 2d6 slashing.');
		expect(text).toContain('- Save DEX Save; Recharge 4-6.');
		expect(text).toContain('Breath Weapon\nd6 | Effect\n1-4 | 50% chance frightened');
	});

	it('preserves quote, inset, and item content', () => {
		const text = service.renderEntries([
			{ type: 'quote', entries: ['{@i Arcane words.}'], by: 'Mordenkainen' },
			{ type: 'inset', name: 'At Higher Levels', entries: ['The damage increases.'] },
			{ type: 'item', name: 'Choice', entries: ['Choose {@spell light|PHB|Light}.'] },
		]);

		expect(text).toBe('"Arcane words." - Mordenkainen\nAt Higher Levels: The damage increases.\nChoice: Choose Light.');
	});
});
