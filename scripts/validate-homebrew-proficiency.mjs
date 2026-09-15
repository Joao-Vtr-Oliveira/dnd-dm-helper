import { readFile, writeFile } from 'node:fs/promises';

const inputUrl = new URL('../rpg_files/homebrew.json', import.meta.url);
const fix = process.argv.includes('--fix');
const skillAbilities = {
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

const abilityModifier = (score) => (Number.isFinite(score) ? Math.floor((score - 10) / 2) : null);
const proficiencyBonus = (cr) => {
	const text = String(cr ?? '').trim();
	if (!['0', '1/8', '1/4', '1/2'].includes(text) && !/^(?:[1-9]|[12]\d|30)$/.test(text)) return null;
	const value = text === '1/8' ? 0.125 : text === '1/4' ? 0.25 : text === '1/2' ? 0.5 : Number(text);
	if (!Number.isFinite(value) || value < 0 || value > 30) return null;
	if (value <= 4) return 2;
	if (value <= 8) return 3;
	if (value <= 12) return 4;
	if (value <= 16) return 5;
	if (value <= 20) return 6;
	if (value <= 24) return 7;
	if (value <= 28) return 8;
	return 9;
};
const bonus = (value) => (value >= 0 ? `+${value}` : String(value));
const parseBonus = (value) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
};

const file = JSON.parse(await readFile(inputUrl, 'utf8'));
const issues = [];
let changes = 0;

for (const monster of file.monster ?? []) {
	const proficiency = proficiencyBonus(monster.cr ?? monster.level);
	const hasChecks = Object.keys(monster.save ?? {}).length > 0 || Object.keys(monster.skill ?? {}).length > 0;
	if (hasChecks && proficiency == null) {
		issues.push(`${monster.name}: ND ou nível inválido ou ausente.`);
		continue;
	}
	if (proficiency == null) continue;

	for (const [ability, current] of Object.entries(monster.save ?? {})) {
		const modifier = abilityModifier(monster[ability]);
		if (modifier == null) {
			issues.push(`${monster.name}: ${ability.toUpperCase()} ausente para a salvaguarda.`);
			continue;
		}
		const expected = bonus(modifier + proficiency);
		if (current !== expected) {
			issues.push(`${monster.name}: salvaguarda ${ability.toUpperCase()} é ${current}, deveria ser ${expected}.`);
			if (fix) {
				monster.save[ability] = expected;
				changes++;
			}
		}
	}

	for (const [name, current] of Object.entries(monster.skill ?? {})) {
		const ability = skillAbilities[name.toLocaleLowerCase()];
		if (!ability) {
			issues.push(`${monster.name}: perícia ${name} não possui habilidade conhecida.`);
			continue;
		}
		const modifier = abilityModifier(monster[ability]);
		if (modifier == null) {
			issues.push(`${monster.name}: ${ability.toUpperCase()} ausente para ${name}.`);
			continue;
		}
		const currentBonus = parseBonus(current);
		const multiplier = currentBonus !== null && currentBonus - modifier >= proficiency * 2 ? 2 : 1;
		const expected = bonus(modifier + proficiency * multiplier);
		if (current !== expected) {
			issues.push(`${monster.name}: perícia ${name} é ${current}, deveria ser ${expected}.`);
			if (fix) {
				monster.skill[name] = expected;
				changes++;
			}
		}
	}

	const perception = monster.skill?.perception;
	const perceptionBonus = perception === undefined ? null : parseBonus(perception);
	const passive = 10 + (perceptionBonus ?? abilityModifier(monster.wis) ?? 0);
	if (monster.passive !== passive) {
		issues.push(`${monster.name}: percepção passiva é ${monster.passive}, deveria ser ${passive}.`);
		if (fix) {
			monster.passive = passive;
			changes++;
		}
	}
}

if (fix && changes) await writeFile(inputUrl, `${JSON.stringify(file, null, 2)}\n`);
for (const issue of issues) console.log(issue);
if (fix) console.log(`${changes} correções aplicadas em rpg_files/homebrew.json.`);
if (issues.length && !fix) process.exitCode = 1;
