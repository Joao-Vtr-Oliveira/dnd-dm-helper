import type { BattleCombatant } from './battle-encounter-model';
import type { CreatureDamageDefense } from './creature-sheet-model';

export type DamageDefenseKind = 'vulnerability' | 'resistance' | 'immunity';

export type DamageDefenseMatch = {
	kind: DamageDefenseKind;
	label: string;
	multiplier: 0 | 0.5 | 2;
	note?: string;
};

export type DamageDefenseResolution = {
	matches: DamageDefenseMatch[];
	suggestedMultiplier?: 0 | 0.5 | 2;
	conflicted: boolean;
};

const DEFENSES: readonly { key: keyof Pick<BattleCombatant, 'damageVulnerabilities' | 'damageResistances' | 'damageImmunities'>; kind: DamageDefenseKind; label: string; multiplier: 0 | 0.5 | 2 }[] = [
	{ key: 'damageVulnerabilities', kind: 'vulnerability', label: 'Vulnerabilidade', multiplier: 2 },
	{ key: 'damageResistances', kind: 'resistance', label: 'Resistência', multiplier: 0.5 },
	{ key: 'damageImmunities', kind: 'immunity', label: 'Imunidade', multiplier: 0 },
];

export function resolveDamageDefenses(
	combatant: BattleCombatant,
	damageType: string,
): DamageDefenseResolution {
	const normalizedType = damageType.trim().toLocaleLowerCase();
	if (!normalizedType) return { matches: [], conflicted: false };

	const matches = DEFENSES.flatMap(({ key, kind, label, multiplier }) =>
		(combatant[key] ?? [])
			.filter((defense) => matchesDamageType(defense, normalizedType))
			.map((defense) => ({ kind, label, multiplier, ...(defense.note ? { note: defense.note } : {}) })),
	);
	const unconditional = matches.filter((match) => !match.note);
	const multipliers = new Set(unconditional.map((match) => match.multiplier));
	return {
		matches,
		suggestedMultiplier:
			matches.length && !matches.some((match) => match.note) && multipliers.size === 1
				? unconditional[0]?.multiplier
				: undefined,
		conflicted: multipliers.size > 1,
	};
}

export function adjustedDamage(amount: number, multiplier: 0 | 0.5 | 1 | 2): number {
	return Math.floor(Math.max(0, amount) * multiplier);
}

function matchesDamageType(defense: CreatureDamageDefense, damageType: string) {
	return defense.types.some((type) => type.trim().toLocaleLowerCase() === damageType);
}
