import type { BattleCombatant } from './battle-encounter-model';
import { adjustedDamage, resolveDamageDefenses } from './battle-damage-defense-model';

describe('resolveDamageDefenses', () => {
	const combatant = (defenses: Partial<BattleCombatant>) => defenses as BattleCombatant;

	it('suggests a single unconditional matching defense', () => {
		const resolution = resolveDamageDefenses(
			combatant({ damageResistances: [{ types: ['Fire'] }] }),
			'fire',
		);

		expect(resolution.suggestedMultiplier).toBe(0.5);
		expect(adjustedDamage(7, resolution.suggestedMultiplier!)).toBe(3);
	});

	it('suggests vulnerability and immunity adjustments, including zero', () => {
		const vulnerable = resolveDamageDefenses(
			combatant({ damageVulnerabilities: [{ types: ['fire'] }] }),
			'fire',
		);
		const immune = resolveDamageDefenses(
			combatant({ damageImmunities: [{ types: ['poison'] }] }),
			'poison',
		);

		expect(vulnerable.suggestedMultiplier).toBe(2);
		expect(adjustedDamage(7, vulnerable.suggestedMultiplier!)).toBe(14);
		expect(immune.suggestedMultiplier).toBe(0);
		expect(adjustedDamage(7, immune.suggestedMultiplier!)).toBe(0);
	});

	it('keeps noted defenses manual', () => {
		const resolution = resolveDamageDefenses(
			combatant({ damageImmunities: [{ types: ['poison'], note: 'against inhaled poison' }] }),
			'poison',
		);

		expect(resolution.suggestedMultiplier).toBeUndefined();
		expect(resolution.matches[0].note).toBe('against inhaled poison');
	});

	it('does not choose between conflicting defenses', () => {
		const resolution = resolveDamageDefenses(
			combatant({
				damageResistances: [{ types: ['cold'] }],
				damageVulnerabilities: [{ types: ['cold'] }],
			}),
			'cold',
		);

		expect(resolution.conflicted).toBeTrue();
		expect(resolution.suggestedMultiplier).toBeUndefined();
	});
});
