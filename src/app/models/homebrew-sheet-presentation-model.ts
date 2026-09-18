import type { CampaignWorld } from './campaign-world-model';
import { DND_5E_CHARACTER_CLASSES, type Dnd5eCharacterClass } from './dnd-5e-reference-model';
import type { HomebrewCategory, SavedSheetInterface } from '../services/local-storage-service/local-storage-service';

export type HomebrewSheetPresentation = {
	categoryLabel: string;
	categoryTone: HomebrewCategory;
	challengeRating?: string;
	creatureType?: string;
	classes: string[];
	formalOrganizations: string[];
	formalLocations: string[];
	legacyGroups: string[];
};

const CLASS_ALIASES: ReadonlyArray<readonly [string, string]> = [
	['artificer', 'Artificer'],
	['artificeiro', 'Artificer'],
	['barbarian', 'Barbarian'],
	['barbaro', 'Barbarian'],
	['bárbaro', 'Barbarian'],
	['bard', 'Bard'],
	['bardo', 'Bard'],
	['cleric', 'Cleric'],
	['clérigo', 'Cleric'],
	['druid', 'Druid'],
	['druida', 'Druid'],
	['fighter', 'Fighter'],
	['guerreiro', 'Fighter'],
	['monk', 'Monk'],
	['monge', 'Monk'],
	['paladin', 'Paladin'],
	['paladino', 'Paladin'],
	['ranger', 'Ranger'],
	['patrulheiro', 'Ranger'],
	['rogue', 'Rogue'],
	['ladino', 'Rogue'],
	['sorcerer', 'Sorcerer'],
	['feiticeiro', 'Sorcerer'],
	['warlock', 'Warlock'],
	['bruxo', 'Warlock'],
	['wizard', 'Wizard'],
	['mago', 'Wizard'],
	['assassin', 'Assassin'],
	['assassino', 'Assassin'],
];

export function presentHomebrewSheet(
	sheet: SavedSheetInterface,
	world: CampaignWorld | null,
): HomebrewSheetPresentation {
	return {
		categoryLabel: categoryLabelFor(sheet.category),
		categoryTone: sheet.category,
		challengeRating: cleanText(sheet.data.challengeRating),
		creatureType: creatureTypeFor(sheet.data.creatureType),
		classes: classesFor(sheet),
		formalOrganizations: unique(
			(sheet.organizationRefs ?? [])
				.map((ref) => world?.organizations.find((organization) => organization.id === ref.organizationId)?.name)
				.filter((name): name is string => !!name),
		),
		formalLocations: formalLocationsFor(sheet, world),
		legacyGroups: unique((sheet.data.groups ?? []).map((group) => group.trim()).filter(Boolean)),
	};
}

export function categoryLabelFor(category: HomebrewCategory): string {
	return {
		npc: 'NPC',
		monster: 'MONSTRO',
		pc: 'PC',
		other: 'OUTRO',
	}[category];
}

function classesFor(sheet: SavedSheetInterface): string[] {
	const structured = (sheet.classes ?? []).map(classLabelFor).filter(Boolean);
	if (structured.length) return unique(structured);

	const searchableTags = [...(sheet.tags ?? []), ...(sheet.data.tags ?? []), ...(sheet.data.groups ?? [])];
	const normalizedTags = searchableTags.flatMap((tag) => normalizePresentationText(tag).split(/[^a-z0-9]+/));
	return unique(CLASS_ALIASES.filter(([alias]) => normalizedTags.includes(alias)).map(([, label]) => label));
}

function classLabelFor(value: Dnd5eCharacterClass): string {
	const label = DND_5E_CHARACTER_CLASSES.find((item) => item.id === value)?.label ?? value;
	const englishLabel = label.match(/\(([^)]+)\)/)?.[1];
	return englishLabel ?? label;
}

function formalLocationsFor(sheet: SavedSheetInterface, world: CampaignWorld | null): string[] {
	if (!world) return [];
	return unique(
		(sheet.locationRefs ?? []).flatMap((ref) => {
			if (ref.scopeType === 'empire') {
				const empire = world.empires.find((item) => item.id === ref.scopeId);
				return empire ? [empire.name] : [];
			}
			if (ref.scopeType === 'state') {
				const state = world.states.find((item) => item.id === ref.scopeId);
				const empire = state && world.empires.find((item) => item.id === state.empireId);
				return state && empire ? [`${empire.name} › ${state.name}`] : [];
			}
			const settlement = world.settlements.find((item) => item.id === ref.scopeId);
			const state = settlement && world.states.find((item) => item.id === settlement.stateId);
			const empire = state && world.empires.find((item) => item.id === state.empireId);
			return settlement && state && empire ? [`${empire.name} › ${state.name} › ${settlement.name}`] : [];
		}),
	);
}

function creatureTypeFor(value: string | undefined): string | undefined {
	const clean = cleanText(value)?.split('(', 1)[0].trim();
	return clean ? clean[0].toUpperCase() + clean.slice(1) : undefined;
}

function cleanText(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const clean = value.trim();
	return clean || undefined;
}

function normalizePresentationText(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '');
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}
