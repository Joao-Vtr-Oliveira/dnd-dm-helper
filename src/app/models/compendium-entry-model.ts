export type RawFiveEToolsEntry = string | RawFiveEToolsEntryObject;

export interface RawFiveEToolsRoll {
	exact?: number | string;
	min?: number | string;
	max?: number | string;
	[key: string]: unknown;
}

export interface RawFiveEToolsEntryObject {
	type?: string;
	name?: string;
	caption?: string;
	by?: string;
	entries?: RawFiveEToolsEntry[];
	items?: RawFiveEToolsEntry[];
	entry?: RawFiveEToolsEntry;
	rows?: unknown[][];
	colLabels?: string[];
	roll?: RawFiveEToolsRoll;
	[key: string]: unknown;
}
