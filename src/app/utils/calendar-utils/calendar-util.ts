import {
	CalendarEvent,
	CampaignCalendar,
	MoonInfo,
	MoonPhase,
	Season,
	Weekday,
	WEEKDAY_LABELS,
	WorldDate,
} from '../../models/calendar-model';
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;

function seasonIndex(calendar: CampaignCalendar, season: Season): number {
	return calendar.seasons.findIndex((item) => item.id === season);
}

function clampMinute(min: number): number {
	const x = Math.floor(min);
	if (x < 0) return 0;
	if (x >= MINUTES_PER_HOUR) return MINUTES_PER_HOUR - 1;
	return x;
}

function absoluteDayIndex(calendar: CampaignCalendar, d: WorldDate): number {
	const daysPerYear = calendar.daysPerSeason * calendar.seasons.length;
	return d.year * daysPerYear + seasonIndex(calendar, d.season) * calendar.daysPerSeason + (d.day - 1);
}

export function worldDateToDayIndex(calendar: CampaignCalendar, d: WorldDate): number {
	return absoluteDayIndex(calendar, d) - absoluteDayIndex(calendar, calendar.epochDate);
}

export function dayIndexToWorldDate(calendar: CampaignCalendar, idx: number, hour = 6, minute = 0): WorldDate {
	if (idx < 0) idx = 0;

	const daysPerYear = calendar.daysPerSeason * calendar.seasons.length;
	const absoluteIndex = absoluteDayIndex(calendar, calendar.epochDate) + idx;
	const year = Math.floor(absoluteIndex / daysPerYear);

	const dayOfYear = absoluteIndex % daysPerYear;
	const sIdx = Math.floor(dayOfYear / calendar.daysPerSeason);
	const dayInSeason = (dayOfYear % calendar.daysPerSeason) + 1;

	return {
		year,
		season: calendar.seasons[sIdx]?.id ?? calendar.epochDate.season,
		day: dayInSeason,
		hour,
		minute,
	};
}

export function worldDateToMinutesSinceEpoch(calendar: CampaignCalendar, d: WorldDate): number {
	const dayIndex = worldDateToDayIndex(calendar, d);
	return dayIndex * MINUTES_PER_DAY + d.hour * MINUTES_PER_HOUR + d.minute;
}

export function minutesSinceEpochToWorldDate(calendar: CampaignCalendar, totalMinutes: number): WorldDate {
	if (totalMinutes < 0) totalMinutes = 0;

	const dayIndex = Math.floor(totalMinutes / MINUTES_PER_DAY);
	const minutesInDay = totalMinutes % MINUTES_PER_DAY;

	const hour = Math.floor(minutesInDay / MINUTES_PER_HOUR);
	const minute = minutesInDay % MINUTES_PER_HOUR;

	const base = dayIndexToWorldDate(calendar, dayIndex, hour, minute);
	return {
		...base,
		hour,
		minute,
	};
}

export function addMinutes(calendar: CampaignCalendar, d: WorldDate, delta: number): WorldDate {
	const total = worldDateToMinutesSinceEpoch(calendar, d) + delta;
	return minutesSinceEpochToWorldDate(calendar, total);
}

export function addHours(calendar: CampaignCalendar, d: WorldDate, delta: number): WorldDate {
	return addMinutes(calendar, d, delta * MINUTES_PER_HOUR);
}

export function addDays(calendar: CampaignCalendar, d: WorldDate, delta: number): WorldDate {
	return addMinutes(calendar, d, delta * MINUTES_PER_DAY);
}

export function getWeekday(calendar: CampaignCalendar, d: WorldDate): Weekday {
	const idx = worldDateToDayIndex(calendar, d);
	return (idx % 7) as Weekday;
}

export function getWeekdayLabel(calendar: CampaignCalendar, d: WorldDate): string {
	return WEEKDAY_LABELS[getWeekday(calendar, d)];
}

export function getEventsForDate(calendar: CampaignCalendar, d: WorldDate): CalendarEvent[] {
	return calendar.events.filter((e) => e.season === d.season && e.day === d.day);
}

export function getMoonPhaseForDayIndex(calendar: CampaignCalendar, dayIndex: number): MoonPhase {
	const dayInCycle = (dayIndex % calendar.daysPerSeason) + 1;
	const waxingEnd = Math.max(2, Math.floor((calendar.daysPerSeason * 7) / 30));
	const fullEnd = Math.max(waxingEnd + 1, Math.floor((calendar.daysPerSeason * 17) / 30));

	if (dayInCycle === 1 || dayInCycle === calendar.daysPerSeason) return 'new';
	if (dayInCycle >= 2 && dayInCycle <= waxingEnd) return 'waxing';
	if (dayInCycle <= fullEnd) return 'full';
	if (dayInCycle < calendar.daysPerSeason) return 'waning';

	return 'new';
}

export function getMoonInfo(calendar: CampaignCalendar, d: WorldDate): MoonInfo {
	const idx = worldDateToDayIndex(calendar, d);
	const phase = getMoonPhaseForDayIndex(calendar, idx);

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

export function buildSeasonGrid(calendar: CampaignCalendar, year: number, season: Season): CalendarDayCell[] {
	const result: CalendarDayCell[] = [];

	for (let day = 1; day <= calendar.daysPerSeason; day++) {
		const date: WorldDate = {
			year,
			season,
			day,
			hour: 6,
			minute: 0,
		};

		result.push({
			day,
			weekday: getWeekday(calendar, date),
			moon: getMoonInfo(calendar, date),
			events: getEventsForDate(calendar, date),
		});
	}

	return result;
}
