import type { CreatureAbilityKey, CreatureSheet, CreatureSkill } from './creature-sheet-model';

const skillAbilities: Record<string, CreatureAbilityKey> = {
	acrobatics: 'dex',
	'animal handling': 'wis',
	arcana: 'int',
	athletics: 'str',
	deception: 'cha',
	history: 'int',
	insight: 'wis',
	intimidation: 'cha',
	investigation: 'int',
	medicine: 'wis',
	nature: 'int',
	perception: 'wis',
	performance: 'cha',
	persuasion: 'cha',
	religion: 'int',
	'sleight of hand': 'dex',
	stealth: 'dex',
	survival: 'wis',
};

export interface CreatureSheetValidationIssue {
	field: string;
	message: string;
}

export function abilityModifier(score: unknown): number | null {
	return typeof score === 'number' && Number.isFinite(score) ? Math.floor((score - 10) / 2) : null;
}

export function proficiencyBonusForChallengeRating(challengeRating: unknown): number | null {
	const text = String(challengeRating ?? '').trim();
	if (!text) return null;
	if (!['0', '1/8', '1/4', '1/2'].includes(text) && !/^(?:[1-9]|[12]\d|30)$/.test(text)) {
		return null;
	}
	const numeric = text === '1/8' ? 0.125 : text === '1/4' ? 0.25 : text === '1/2' ? 0.5 : Number(text);
	if (!Number.isFinite(numeric) || numeric < 0 || numeric > 30) return null;
	if (numeric <= 4) return 2;
	if (numeric <= 8) return 3;
	if (numeric <= 12) return 4;
	if (numeric <= 16) return 5;
	if (numeric <= 20) return 6;
	if (numeric <= 24) return 7;
	if (numeric <= 28) return 8;
	return 9;
}

/** Character sheets without a CR use the equivalent 1-20 level progression. */
export function proficiencyBonusForCreature(
	creature: Pick<CreatureSheet, 'challengeRating' | 'level'>,
): number | null {
	const challengeRatingBonus = proficiencyBonusForChallengeRating(creature.challengeRating);
	if (challengeRatingBonus != null) return challengeRatingBonus;
	return Number.isInteger(creature.level) && creature.level! >= 1 && creature.level! <= 20
		? proficiencyBonusForChallengeRating(String(creature.level))
		: null;
}

export function skillAbilityForName(name: unknown): CreatureAbilityKey | undefined {
	return typeof name === 'string' ? skillAbilities[name.trim().toLocaleLowerCase()] : undefined;
}

export function skillAbility(skill: CreatureSkill): CreatureAbilityKey | undefined {
	return skill.ability ?? skillAbilityForName(skill.name);
}

export function skillProficiencyMultiplier(skill: CreatureSkill): 1 | 2 {
	return skill.proficiencyMultiplier === 2 ? 2 : 1;
}

export function calculatedSavingThrowBonus(
	ability: CreatureAbilityKey,
	creature: Pick<CreatureSheet, 'abilityScores' | 'challengeRating' | 'level'>,
): number | null {
	const modifier = abilityModifier(creature.abilityScores?.[ability]);
	const proficiency = proficiencyBonusForCreature(creature);
	return modifier == null || proficiency == null ? null : modifier + proficiency;
}

export function calculatedSkillBonus(
	skill: CreatureSkill,
	creature: Pick<CreatureSheet, 'abilityScores' | 'challengeRating' | 'level'>,
): number | null {
	const ability = skillAbility(skill);
	if (!ability) return null;
	const modifier = abilityModifier(creature.abilityScores?.[ability]);
	const proficiency = proficiencyBonusForCreature(creature);
	return modifier == null || proficiency == null
		? null
		: modifier + proficiency * skillProficiencyMultiplier(skill);
}

/** Keeps cached stat-block values in sync with their CR, ability, and proficiency inputs. */
export function applyCreatureDerivedValues(creature: CreatureSheet): CreatureSheet {
	const savingThrows = creature.savingThrows?.map((save) => ({
		...save,
		bonus: calculatedSavingThrowBonus(save.ability, creature) ?? save.bonus,
	}));
	const skills = creature.skills?.map((skill) => {
		const ability = skillAbility(skill);
		const next = {
			...skill,
			...(ability ? { ability } : {}),
			proficiencyMultiplier: skillProficiencyMultiplier(skill),
		};
		return { ...next, bonus: calculatedSkillBonus(next, creature) ?? skill.bonus };
	});
	return {
		...creature,
		...(savingThrows?.length ? { savingThrows } : {}),
		...(skills?.length ? { skills } : {}),
		passivePerception: resolvePassivePerception({ abilityScores: creature.abilityScores, skills }),
	};
}

export function resolvePassivePerception(creature: Pick<CreatureSheet, 'abilityScores' | 'skills'>): number {
	const perception = creature.skills?.find(
		(skill) => skill.name.trim().toLocaleLowerCase() === 'perception',
	);
	if (perception && Number.isFinite(perception.bonus)) return 10 + perception.bonus;
	return 10 + (abilityModifier(creature.abilityScores?.wis) ?? 0);
}

export function validateCreatureSheet(sheet: CreatureSheet): CreatureSheetValidationIssue[] {
	const checks = [...(sheet.savingThrows ?? []), ...(sheet.skills ?? [])];
	if (!checks.length) return [];
	const issues: CreatureSheetValidationIssue[] = [];
	if (proficiencyBonusForCreature(sheet) == null) {
		issues.push({ field: 'challengeRating', message: 'Defina um ND ou nível válido para calcular a proficiência.' });
	}
	for (const save of sheet.savingThrows ?? []) {
		if (abilityModifier(sheet.abilityScores?.[save.ability]) == null) {
			issues.push({ field: `savingThrows.${save.ability}`, message: `Defina ${save.ability.toUpperCase()} para a salvaguarda.` });
		}
	}
	for (const skill of sheet.skills ?? []) {
		const ability = skillAbility(skill);
		if (!ability) {
			issues.push({ field: `skills.${skill.name}`, message: `Selecione a habilidade de ${skill.name}.` });
		} else if (abilityModifier(sheet.abilityScores?.[ability]) == null) {
			issues.push({ field: `skills.${skill.name}`, message: `Defina ${ability.toUpperCase()} para ${skill.name}.` });
		}
	}
	return issues;
}
