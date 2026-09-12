import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CompendiumBestiaryRendererService } from './compendium-bestiary-renderer-service';

describe('CompendiumBestiaryRendererService', () => {
	let service: CompendiumBestiaryRendererService;

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
		service = TestBed.inject(CompendiumBestiaryRendererService);
	});

	it('renders supported tags and leaves unknown tags readable', () => {
		const text = service.renderText(
			'Hit: {@hit 7} to hit. {@damage 2d6 + 3} fire; {@dc 15} {@condition blinded}; {@spell fireball|XPHB}; {@custom Label|value}.',
		);

		expect(text).toBe('Hit: +7 to hit. 2d6 + 3 fire; DC 15 blinded; fireball; Label.');
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
				name: 'Breath Weapon',
				colLabels: ['{@dice d6}', 'Effect'],
				rows: [['1-4', '{@chance 50} {@condition frightened}']],
			},
		]);

		expect(text).toContain('- Claw: Melee Weapon Attack: +8 to hit. Hit: 2d6 slashing.');
		expect(text).toContain('- Save DEX Save; Recharge 4-6.');
		expect(text).toContain('d6 | Effect\n1-4 | 50% chance frightened');
	});
});
