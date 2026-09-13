import type { RawFiveEToolsEntry } from './compendium-entry-model';

export interface RawFiveEToolsSpell {
	name: string;
	source: string;
	id?: string;
	alias?: string[];
	page?: number;
	level: number;
	school: string;
	time: Array<{ number: number; unit: string; condition?: string }>;
	range: Record<string, unknown>;
	components: Record<string, unknown>;
	duration: Array<Record<string, unknown>>;
	entries: RawFiveEToolsEntry[];
	entriesHigherLevel?: RawFiveEToolsEntry[];
	meta?: { ritual?: boolean; [key: string]: unknown };
	damageInflict?: string[];
	savingThrow?: string[];
	spellAttack?: string[];
	conditionInflict?: string[];
	[key: string]: unknown;
}

export interface CompendiumSpellIndexEntry {
	source: string;
	path: string;
	count?: number;
}

export interface CompendiumSpellListEntry {
	id: string;
	name: string;
	source: string;
	page?: number;
	level: number;
	school: string;
	ritual: boolean;
	concentration: boolean;
	castingTime?: string;
	range?: string;
	aliases: string[];
	classes: string[];
}

export interface CompendiumSpellIndexQuery {
	search?: string;
	sources?: string[];
	levels?: number[];
	schools?: string[];
	concentration?: boolean;
	ritual?: boolean;
}

export interface CompendiumSpellIndex {
	sources: CompendiumSpellIndexEntry[];
	spells: CompendiumSpellListEntry[];
}

export interface CompendiumSpellComponents {
	verbal: boolean;
	somatic: boolean;
	material?: string;
}

export interface CompendiumSpell {
	id: string;
	name: string;
	source: string;
	aliases: string[];
	page?: number;
	level: number;
	school: string;
	castingTime?: string;
	range?: string;
	components: CompendiumSpellComponents;
	duration?: string;
	concentration: boolean;
	ritual: boolean;
	entries: RawFiveEToolsEntry[];
	entriesHigherLevel: RawFiveEToolsEntry[];
	damageTypes: string[];
	savingThrows: string[];
	attackTypes: string[];
	conditions: string[];
	classes: string[];
	raw: RawFiveEToolsSpell;
}

export interface RawFiveEToolsSpellBundle {
	spells?: RawFiveEToolsSpell[];
	spell?: RawFiveEToolsSpell[];
	classes?: Record<
		string,
		{ class?: Array<{ name?: string }>; classVariant?: Array<{ name?: string }> }
	>;
	[key: string]: unknown;
}
