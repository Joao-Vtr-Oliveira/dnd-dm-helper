import {
	CalendarEvent,
	MoonInfo,
	MoonPhase,
	Season,
	Weekday,
	WEEKDAY_LABELS,
	WorldDate,
} from '../../models/calendar-model';
import {
	CALENDAR_EVENTS,
	DAYS_PER_SEASON,
	EPOCH_DATE,
	SEASON_ORDER,
} from './calendar-constants';

const SEASONS_PER_YEAR = SEASON_ORDER.length;
const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS_PER_YEAR;

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;

export { EPOCH_DATE } from './calendar-constants';

function seasonIndex(season: Season): number {
	return SEASON_ORDER.indexOf(season);
}

function clampMinute(min: number): number {
	const x = Math.floor(min);
	if (x < 0) return 0;
	if (x >= MINUTES_PER_HOUR) return MINUTES_PER_HOUR - 1;
	return x;
}

function absoluteDayIndex(d: WorldDate): number {
	return d.year * DAYS_PER_YEAR + seasonIndex(d.season) * DAYS_PER_SEASON + (d.day - 1);
}

const EPOCH_DAY_INDEX = absoluteDayIndex(EPOCH_DATE);

export function worldDateToDayIndex(d: WorldDate): number {
	return absoluteDayIndex(d) - EPOCH_DAY_INDEX;
}

export function dayIndexToWorldDate(idx: number, hour = 6, minute = 0): WorldDate {
	if (idx < 0) idx = 0;

	const absoluteIndex = EPOCH_DAY_INDEX + idx;
	const year = Math.floor(absoluteIndex / DAYS_PER_YEAR);

	const dayOfYear = absoluteIndex % DAYS_PER_YEAR;
	const sIdx = Math.floor(dayOfYear / DAYS_PER_SEASON);
	const dayInSeason = (dayOfYear % DAYS_PER_SEASON) + 1;

	return {
		year,
		season: SEASON_ORDER[sIdx],
		day: dayInSeason,
		hour,
		minute,
	};
}

export function worldDateToMinutesSinceEpoch(d: WorldDate): number {
	const dayIndex = worldDateToDayIndex(d);
	return dayIndex * MINUTES_PER_DAY + d.hour * MINUTES_PER_HOUR + d.minute;
}

export function minutesSinceEpochToWorldDate(totalMinutes: number): WorldDate {
	if (totalMinutes < 0) totalMinutes = 0;

	const dayIndex = Math.floor(totalMinutes / MINUTES_PER_DAY);
	const minutesInDay = totalMinutes % MINUTES_PER_DAY;

	const hour = Math.floor(minutesInDay / MINUTES_PER_HOUR);
	const minute = minutesInDay % MINUTES_PER_HOUR;

	const base = dayIndexToWorldDate(dayIndex, hour, minute);
	return {
		...base,
		hour,
		minute,
	};
}

export function addMinutes(d: WorldDate, delta: number): WorldDate {
	const total = worldDateToMinutesSinceEpoch(d) + delta;
	return minutesSinceEpochToWorldDate(total);
}

export function addHours(d: WorldDate, delta: number): WorldDate {
	return addMinutes(d, delta * MINUTES_PER_HOUR);
}

export function addDays(d: WorldDate, delta: number): WorldDate {
	return addMinutes(d, delta * MINUTES_PER_DAY);
}

export function getWeekday(d: WorldDate): Weekday {
	const idx = worldDateToDayIndex(d);
	return (idx % 7) as Weekday;
}

export function getWeekdayLabel(d: WorldDate): string {
	return WEEKDAY_LABELS[getWeekday(d)];
}

export function getEventsForDate(d: WorldDate): CalendarEvent[] {
	return CALENDAR_EVENTS.filter((e) => e.season === d.season && e.day === d.day);
}

export function getMoonPhaseForDayIndex(dayIndex: number): MoonPhase {
	const dayInCycle = (dayIndex % DAYS_PER_SEASON) + 1;
	const waxingEnd = Math.max(2, Math.floor((DAYS_PER_SEASON * 7) / 30));
	const fullEnd = Math.max(waxingEnd + 1, Math.floor((DAYS_PER_SEASON * 17) / 30));

	if (dayInCycle === 1 || dayInCycle === DAYS_PER_SEASON) return 'new';
	if (dayInCycle >= 2 && dayInCycle <= waxingEnd) return 'waxing';
	if (dayInCycle <= fullEnd) return 'full';
	if (dayInCycle < DAYS_PER_SEASON) return 'waning';

	return 'new';
}

export function getMoonInfo(d: WorldDate): MoonInfo {
	const idx = worldDateToDayIndex(d);
	const phase = getMoonPhaseForDayIndex(idx);

	let label: string;
	switch (phase) {
		case 'new':
			label = 'Lua Nova';
			break;
		case 'waxing':
			label = 'Lua Crescente';
			break;
		case 'full':
			label = 'Lua Cheia';
			break;
		case 'waning':
			label = 'Lua Minguante';
			break;
	}

	return { phase, label };
}

export interface CalendarDayCell {
	day: number;
	weekday: Weekday;
	moon: MoonInfo;
	events: CalendarEvent[];
}

export function buildSeasonGrid(year: number, season: Season): CalendarDayCell[] {
	const result: CalendarDayCell[] = [];

	for (let day = 1; day <= DAYS_PER_SEASON; day++) {
		const date: WorldDate = {
			year,
			season,
			day,
			hour: 6,
			minute: 0,
		};

		result.push({
			day,
			weekday: getWeekday(date),
			moon: getMoonInfo(date),
			events: getEventsForDate(date),
		});
	}

	return result;
}
