export type ConditionReference = { label: string; description: string };

export const CONDITION_REFERENCES: Readonly<Record<string, ConditionReference>> = {
	blinded: {
		label: 'Cego / Blinded',
		description:
			'A criatura não consegue ver e falha automaticamente em testes de habilidade que exigem visão. Jogadas de ataque contra ela têm vantagem, e as jogadas de ataque dela têm desvantagem.',
	},
	charmed: {
		label: 'Enfeitiçado / Charmed',
		description:
			'A criatura não pode atacar quem a enfeitiçou nem usar habilidades ou efeitos mágicos prejudiciais contra essa criatura. Quem a enfeitiçou tem vantagem em testes de habilidade para interagir socialmente com ela.',
	},
	deafened: {
		label: 'Surdo / Deafened',
		description: 'A criatura não consegue ouvir e falha automaticamente em testes de habilidade que exigem audição.',
	},
	incapacitated: {
		label: 'Incapacitado / Incapacitated',
		description: 'A criatura não pode realizar ações nem reações.',
	},
	poisoned: {
		label: 'Envenenado / Poisoned',
		description: 'A criatura tem desvantagem nas jogadas de ataque e testes de habilidade.',
	},
	prone: {
		label: 'Caído / Prone',
		description: 'A criatura só pode se mover rastejando. Tem desvantagem em ataques; ataques corpo a corpo contra ela têm vantagem.',
	},
	grappled: {
		label: 'Agarrado / Grappled',
		description: 'O deslocamento da criatura se torna 0. A condição termina se o agarrador ficar incapacitado.',
	},
	restrained: {
		label: 'Impedido / Restrained',
		description: 'O deslocamento fica 0. Ataques contra a criatura têm vantagem, e ela tem desvantagem em ataques e testes de resistência de Destreza.',
	},
	stunned: {
		label: 'Atordoado / Stunned',
		description: 'A criatura fica incapacitada, não pode se mover e falha em testes de resistência de Força e Destreza. Ataques contra ela têm vantagem.',
	},
	unconscious: {
		label: 'Inconsciente / Unconscious',
		description: 'A criatura fica incapacitada, não pode se mover ou falar, larga o que segura e cai prone. Ataques contra ela têm vantagem.',
	},
	frightened: {
		label: 'Amedrontado / Frightened',
		description: 'A criatura tem desvantagem em testes de habilidade e ataques enquanto vê a fonte do medo e não pode se aproximar voluntariamente dela.',
	},
	invisible: {
		label: 'Invisível / Invisible',
		description: 'A criatura é impossível de ver sem magia ou sentido especial. Ataques contra ela têm desvantagem e os ataques dela têm vantagem.',
	},
	paralyzed: {
		label: 'Paralisado / Paralyzed',
		description:
			'A criatura fica incapacitada, não pode se mover ou falar e falha automaticamente em testes de resistência de Força e Destreza. Ataques contra ela têm vantagem; qualquer ataque que atinja a criatura é um acerto crítico se o atacante estiver a até 1,5 m.',
	},
	petrified: {
		label: 'Petrificado / Petrified',
		description:
			'A criatura é transformada, junto com objetos não mágicos que veste ou carrega, em uma substância sólida inanimada. Ela fica incapacitada, não pode se mover ou falar, não percebe o ambiente, tem resistência a todo dano e é imune a veneno e doença.',
	},
};

export function conditionReferenceFor(name: string): ConditionReference {
	const key = name.trim().toLocaleLowerCase();
	return CONDITION_REFERENCES[key] ?? {
		label: name.trim() || 'Condição',
		description: 'Esta é uma condição personalizada sem regras de referência cadastradas.',
	};
}
