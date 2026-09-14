export type ConditionReference = { label: string; description: string };

export const CONDITION_REFERENCES: Readonly<Record<string, ConditionReference>> = {
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
};

export function conditionReferenceFor(name: string): ConditionReference {
	const key = name.trim().toLocaleLowerCase();
	return CONDITION_REFERENCES[key] ?? {
		label: name.trim() || 'Condição',
		description: 'Esta é uma condição personalizada sem regras de referência cadastradas.',
	};
}
