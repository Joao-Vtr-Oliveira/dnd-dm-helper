import type { CreatureSheet } from './creature-sheet-model';
import {
	applyCreatureDerivedValues,
	calculatedSpellAttackBonus,
	calculatedSpellSaveDc,
	proficiencyBonusForCreature,
	proficiencyBonusForChallengeRating,
	spellcastingAbilityForClasses,
	validateCreatureSheet,
} from './creature-sheet-rules';

function creature(overrides: Partial<CreatureSheet> = {}): CreatureSheet {
	return {
		name: 'Test creature',
		armorClass: 12,
		maxHp: 10,
		spellSlots: [],
		spells: [],
		specialAbilities: [],
		features: [],
		...overrides,
	};
}

describe('creature sheet rules', () => {
	it('maps all challenge-rating proficiency boundaries', () => {
		expect(proficiencyBonusForChallengeRating('0')).toBe(2);
		expect(proficiencyBonusForChallengeRating('4')).toBe(2);
		expect(proficiencyBonusForChallengeRating('5')).toBe(3);
		expect(proficiencyBonusForChallengeRating('8')).toBe(3);
		expect(proficiencyBonusForChallengeRating('9')).toBe(4);
		expect(proficiencyBonusForChallengeRating('16')).toBe(5);
		expect(proficiencyBonusForChallengeRating('20')).toBe(6);
		expect(proficiencyBonusForChallengeRating('24')).toBe(7);
		expect(proficiencyBonusForChallengeRating('28')).toBe(8);
		expect(proficiencyBonusForChallengeRating('30')).toBe(9);
		expect(proficiencyBonusForChallengeRating('5.5')).toBeNull();
		expect(proficiencyBonusForChallengeRating('31')).toBeNull();
		expect(proficiencyBonusForCreature(creature({ level: 5 }))).toBe(3);
	});

	it('calculates saves, skills, expertise, and passive perception from the source fields', () => {
		const resolved = applyCreatureDerivedValues(
			creature({
				challengeRating: '5',
				abilityScores: { dex: 14, wis: 12 },
				savingThrows: [{ ability: 'dex', bonus: 0 }],
				skills: [
					{ name: 'Acrobatics', ability: 'dex', bonus: 0 },
					{ name: 'Perception', ability: 'wis', proficiencyMultiplier: 2, bonus: 0 },
				],
			}),
		);

		expect(resolved.savingThrows).toEqual([{ ability: 'dex', bonus: 5 }]);
		expect(resolved.skills).toEqual([
			{ name: 'Acrobatics', ability: 'dex', proficiencyMultiplier: 1, bonus: 5 },
			{ name: 'Perception', ability: 'wis', proficiencyMultiplier: 2, bonus: 7 },
		]);
		expect(resolved.passivePerception).toBe(17);
	});

	it('calculates spell save DC and spell attack from ability and proficiency', () => {
		const source = creature({
			level: 5,
			abilityScores: { int: 18 },
			spellcasting: { ability: 'int' },
		});

		expect(calculatedSpellSaveDc(source)).toBe(15);
		expect(calculatedSpellAttackBonus(source)).toBe(7);
		expect(spellcastingAbilityForClasses(['wizard'])).toBe('int');
		expect(spellcastingAbilityForClasses(['wizard', 'cleric'])).toBeUndefined();
	});

	it('requires valid calculation sources only when a proficiency entry exists', () => {
		const issues = validateCreatureSheet(
			creature({ skills: [{ name: 'Custom', bonus: 0 }] }),
		);

		expect(issues.map((issue) => issue.field)).toEqual(['challengeRating', 'skills.Custom']);
	});
});
