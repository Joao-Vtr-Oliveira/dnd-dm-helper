export const DND_5E_CREATURE_TYPES = [
	'aberration',
	'beast',
	'celestial',
	'construct',
	'dragon',
	'elemental',
	'fey',
	'fiend',
	'giant',
	'humanoid',
	'monstrosity',
	'ooze',
	'plant',
	'undead',
] as const;

export type Dnd5eCreatureType = (typeof DND_5E_CREATURE_TYPES)[number];

export const DND_5E_CHARACTER_CLASSES = [
	{ id: 'artificer', label: 'Artificer' },
	{ id: 'barbarian', label: 'Bárbaro (Barbarian)' },
	{ id: 'bard', label: 'Bardo (Bard)' },
	{ id: 'cleric', label: 'Clérigo (Cleric)' },
	{ id: 'druid', label: 'Druida (Druid)' },
	{ id: 'fighter', label: 'Guerreiro (Fighter)' },
	{ id: 'monk', label: 'Monge (Monk)' },
	{ id: 'paladin', label: 'Paladino (Paladin)' },
	{ id: 'ranger', label: 'Patrulheiro (Ranger)' },
	{ id: 'rogue', label: 'Ladino (Rogue)' },
	{ id: 'sorcerer', label: 'Feiticeiro (Sorcerer)' },
	{ id: 'warlock', label: 'Bruxo (Warlock)' },
	{ id: 'wizard', label: 'Mago (Wizard)' },
] as const;

export type Dnd5eCharacterClass = (typeof DND_5E_CHARACTER_CLASSES)[number]['id'];
