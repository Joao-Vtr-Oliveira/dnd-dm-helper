import type { RawFiveEToolsEntry } from './compendium-entry-model';

export interface RawFiveEToolsFeature {
	name?: string;
	entries?: RawFiveEToolsEntry[];
	[key: string]: unknown;
}

export interface RawFiveEToolsSpellLevel {
	spells?: string[];
	slots?: number;
	[key: string]: unknown;
}

export interface RawFiveEToolsSpellcasting {
	name?: string;
	type?: string;
	headerEntries?: RawFiveEToolsEntry[];
	footerEntries?: RawFiveEToolsEntry[];
	spells?: Record<string, RawFiveEToolsSpellLevel>;
	will?: string[];
	constant?: string[];
	daily?: Record<string, string[]>;
	rest?: Record<string, string[]>;
	weekly?: Record<string, string[]>;
	[key: string]: unknown;
}

export interface RawFiveEToolsLegendaryGroup {
	name: string;
	source: string;
	lairActions?: RawFiveEToolsEntry[];
	regionalEffects?: RawFiveEToolsEntry[];
	mythicEncounter?: RawFiveEToolsEntry[];
	[key: string]: unknown;
}

export interface RawFiveEToolsMonster {
	name: string;
	source: string;
	id?: string;
	alias?: string[];
	page?: number;
	size?: string[];
	ac?: unknown[];
	hp?: { average?: number; formula?: string; [key: string]: unknown };
	type?: string | { type?: string; tags?: unknown[]; [key: string]: unknown };
	alignment?: unknown[];
	speed?: Record<string, unknown>;
	str?: number;
	dex?: number;
	con?: number;
	int?: number;
	wis?: number;
	cha?: number;
	save?: Record<string, string>;
	skill?: Record<string, string>;
	vulnerable?: unknown[];
	resist?: unknown[];
	immune?: unknown[];
	conditionImmune?: unknown[];
	senses?: string[];
	passive?: number;
	languages?: string[];
	pbNote?: string;
	pb?: number;
	cr?: string | number | { cr?: string | number; [key: string]: unknown };
	trait?: RawFiveEToolsFeature[];
	action?: RawFiveEToolsFeature[];
	bonus?: RawFiveEToolsFeature[];
	reaction?: RawFiveEToolsFeature[];
	legendary?: RawFiveEToolsFeature[];
	mythic?: RawFiveEToolsFeature[];
	spellcasting?: RawFiveEToolsSpellcasting[];
	legendaryGroup?: { name?: string; source?: string } | string;
	[key: string]: unknown;
}

export interface RawFiveEToolsBestiaryBundle {
	monster?: RawFiveEToolsMonster[];
	monsters?: RawFiveEToolsMonster[];
	legendaryGroup?: RawFiveEToolsLegendaryGroup[];
	images?: Array<{ name?: string; source?: string; url?: string }>;
	[key: string]: unknown;
}

export interface CompendiumBestiaryIndexEntry {
	source: string;
	path: string;
	count?: number;
}

export interface CompendiumBestiaryMonsterIndexEntry {
	id: string;
	name: string;
	source: string;
	type?: string;
	size?: string;
	challengeRating?: string;
	page?: number;
	aliases: string[];
	armorClass: number | null;
	averageHp: number | null;
	hasSpellcasting: boolean;
	hasLegendaryActions: boolean;
	hasLairActions: boolean;
}

export interface CompendiumBestiaryIndexQuery {
	search?: string;
	sources?: string[];
	types?: string[];
	sizes?: string[];
	challengeRatings?: string[];
}

export interface CompendiumBestiaryIndex {
	sources: CompendiumBestiaryIndexEntry[];
	monsters: CompendiumBestiaryMonsterIndexEntry[];
}

export interface CompendiumFeature {
	name: string;
	entries: RawFiveEToolsEntry[];
}

export interface CompendiumSpellcasting {
	name: string;
	type?: string;
	headerEntries: RawFiveEToolsEntry[];
	footerEntries: RawFiveEToolsEntry[];
	spells: Record<string, RawFiveEToolsSpellLevel>;
	spellLists: Record<string, string[]>;
	displayAs?: string;
}

export interface CompendiumLegendaryGroupSnapshot {
	name: string;
	source: string;
	lairActions: RawFiveEToolsEntry[];
	regionalEffects: RawFiveEToolsEntry[];
	mythicEncounter: RawFiveEToolsEntry[];
}

/** Normalized official data, kept independent from editable homebrew 5etools data. */
export interface CompendiumMonster {
	id: string;
	name: string;
	source: string;
	aliases: string[];
	page?: number;
	sizes: string[];
	type?: string;
	subtypes: string[];
	alignment: unknown[];
	speed: Record<string, unknown>;
	abilities: {
		str?: number;
		dex?: number;
		con?: number;
		int?: number;
		wis?: number;
		cha?: number;
	};
	saves: Record<string, string>;
	skills: Record<string, string>;
	vulnerable: unknown[];
	resist: unknown[];
	immune: unknown[];
	conditionImmune: unknown[];
	senses: string[];
	passive?: number;
	languages: string[];
	proficiency?: string | number;
	challengeRating?: string;
	level?: number;
	armorClass: number | null;
	hitPoints: number;
	hitPointFormula?: string;
	traits: CompendiumFeature[];
	actions: CompendiumFeature[];
	bonusActions: CompendiumFeature[];
	reactions: CompendiumFeature[];
	legendaryActions: CompendiumFeature[];
	legendaryHeader?: RawFiveEToolsEntry[];
	mythicActions: CompendiumFeature[];
	spellcasting: CompendiumSpellcasting[];
	legendaryGroup?: CompendiumLegendaryGroupSnapshot;
	imageUrl?: string;
	tags: Record<string, string[]>;
	raw: RawFiveEToolsMonster;
}
