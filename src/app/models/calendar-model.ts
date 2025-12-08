export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface WorldDate {
	year: number;
	season: Season;
	day: number;
	hour: number;
	minute: number;
}

export type DeityId =
	| 'luuren'
	| 'atronos'
	| 'dreyc'
	| 'ruuz'
	| 'vozc'
	| 'luna'
	| 'pulacc'
	| 'geraldo'
	| 'achos';

export interface CalendarEvent {
	id: string;
	season: Season;
	day: number;
	title: string;
	deity?: DeityId;
	description: string;
	tags?: string[];
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_LABELS: Record<Weekday, string> = {
	0: 'Segunda',
	1: 'Terça',
	2: 'Quarta',
	3: 'Quinta',
	4: 'Sexta',
	5: 'Sábado',
	6: 'Domingo',
};

export type MoonPhase = 'new' | 'waxing' | 'full' | 'waning';

export interface MoonInfo {
	phase: MoonPhase;
	label: string;
}
