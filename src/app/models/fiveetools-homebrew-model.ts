import type { CreatureCategory, CreatureFeature, CreatureSpecialAbility } from './battleTracker-model';

export type FiveEToolsEntityType = 'monster' | 'trap';
export type FiveEToolsConflictResolution = 'replace' | 'keep-existing' | 'duplicate' | 'cancel';

export interface FiveEToolsHomebrewFile {
	siteVersion?: string;
	_meta: FiveEToolsMeta;
	monster?: FiveEToolsMonster[];
	trap?: FiveEToolsTrap[];
	[key: string]: unknown;
}

export interface FiveEToolsMeta {
	sources: FiveEToolsSource[];
	dateAdded?: number;
	dateLastModified?: number;
	edition?: string;
	[key: string]: unknown;
}

export interface FiveEToolsSource {
	json: string;
	abbreviation: string;
	full: string;
	version?: string;
	authors?: string[];
	color?: string;
	edition?: string;
	[key: string]: unknown;
}

export type FiveEToolsEntry = string | FiveEToolsEntryObject;

export interface FiveEToolsEntryObject {
	type?: string;
	name?: string;
	entries?: FiveEToolsEntry[];
	[key: string]: unknown;
}

export interface FiveEToolsMonsterFeatureBlock {
	name?: string;
	entries?: FiveEToolsEntry[];
	[key: string]: unknown;
}

export interface FiveEToolsSpellcastingLevelBlock {
	spells?: string[];
	slots?: number;
	[key: string]: unknown;
}

export interface FiveEToolsSpellcastingBlock {
	name?: string;
	type?: string;
	headerEntries?: FiveEToolsEntry[];
	footerEntries?: FiveEToolsEntry[];
	spells?: Record<string, FiveEToolsSpellcastingLevelBlock>;
	displayAs?: string;
	[key: string]: unknown;
}

export interface FiveEToolsMonster {
	name: string;
	source: string;
	alias?: string[];
	group?: string[];
	size?: string[];
	type?: string | Record<string, unknown>;
	alignment?: string[];
	ac?: unknown[];
	hp?: {
		average?: number;
		formula?: string;
		[key: string]: unknown;
	};
	speed?: Record<string, unknown>;
	str?: number;
	dex?: number;
	con?: number;
	int?: number;
	wis?: number;
	cha?: number;
	save?: Record<string, string>;
	skill?: Record<string, string>;
	senses?: string[];
	passive?: number;
	languages?: string[];
	cr?: string;
	level?: number;
	resist?: unknown[];
	immune?: unknown[];
	vulnerable?: unknown[];
	conditionImmune?: unknown[];
	trait?: FiveEToolsMonsterFeatureBlock[];
	action?: FiveEToolsMonsterFeatureBlock[];
	bonus?: FiveEToolsMonsterFeatureBlock[];
	reaction?: FiveEToolsMonsterFeatureBlock[];
	legendary?: FiveEToolsMonsterFeatureBlock[];
	spellcasting?: FiveEToolsSpellcastingBlock[];
	[key: string]: unknown;
}

export interface FiveEToolsTrap {
	name: string;
	source: string;
	trapHazType?: string;
	entries: FiveEToolsEntry[];
	[key: string]: unknown;
}

export interface FiveEToolsValidationResult {
	valid: boolean;
	file?: FiveEToolsHomebrewFile;
	warnings: string[];
	error?: string;
}

export interface FiveEToolsEntitySummary {
	id: string;
	type: FiveEToolsEntityType;
	name: string;
	source: string;
	groups: string[];
	labels: string[];
	description: string;
	trapHazType?: string;
	creatureType?: string;
	cr?: string;
	level?: number;
	acLabel?: string;
	hpAverage?: number;
	firstDetailTitle?: string;
	firstDetailText?: string;
	initiativeHint?: string;
	searchText?: string;
}

export interface FiveEToolsImportConflict {
	id: string;
	type: FiveEToolsEntityType;
	name: string;
	source: string;
	resolution: FiveEToolsConflictResolution;
}

export interface FiveEToolsImportPreview {
	partial: Partial<FiveEToolsHomebrewFile>;
	conflicts: FiveEToolsImportConflict[];
	warnings: string[];
	primarySource: string;
	summary: {
		monsters: number;
		traps: number;
		sources: string[];
	};
}

export interface FiveEToolsStoredBackup {
	id: string;
	label: string;
	createdAt: string;
	file: FiveEToolsHomebrewFile;
}

export interface FiveEToolsHomebrewSummary {
	primarySource: string;
	siteVersion: string | null;
	dateLastModified: number | null;
	monsterCount: number;
	trapCount: number;
	otherCollections: Array<{ key: string; count: number }>;
	availableSources: string[];
	availableGroups: string[];
	availableCreatureTypes: string[];
}

export interface FiveEToolsValidationIssue {
	level: 'warning' | 'error';
	field: string;
	message: string;
}

export interface FiveEToolsConflictComparisonRow {
	label: string;
	existing: string;
	incoming: string;
	changed: boolean;
}

export interface FiveEToolsConvertedCreatureExtras {
	category: CreatureCategory;
	features: CreatureFeature[];
	specialAbilities: CreatureSpecialAbility[];
}
