import type { CompendiumSpell } from './compendium-spell-model';

export interface SpellReference {
	name: string;
	source?: string;
}

export interface ParsedSpellReference {
	displayText: string;
	reference: SpellReference | null;
}

export interface ResolvedSpellReference {
	reference: SpellReference;
	spell: CompendiumSpell;
}
