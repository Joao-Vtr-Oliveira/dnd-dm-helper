export type HomebrewCategory = 'monster' | 'npc' | 'pc' | 'other';

export interface HomebrewStats {
	ac?: number | null;
	hp?: number | null;
	cr?: string | null;
	level?: number | null;
}

export interface HomebrewSheet {
	id: string;
	name: string;
	category: HomebrewCategory;
	tags: string[];
	source?: string;
	content: string;
	stats?: HomebrewStats;
}
