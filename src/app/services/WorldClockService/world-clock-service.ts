// src/app/services/world-clock/world-clock.service.ts

import { Injectable, effect, inject, signal } from '@angular/core';
import type { Season, WorldDate } from '../../models/calendar-model';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import {
	addDays,
	addHours,
	addMinutes,
	getEventsForDate,
	getMoonInfo,
	getWeekday,
} from '../../utils/calendar-utils/calendar-util';
import { CampaignCalendarService } from '../campaign-calendar-service/campaign-calendar-service';
import { WorkspaceStorageService } from '../workspace-service/workspace-storage-service';

const STORAGE_KEY = APP_STORAGE_KEYS.worldDate;

@Injectable({ providedIn: 'root' })
export class WorldClockService {
	private readonly calendarRules = inject(CampaignCalendarService);
	private readonly storage = inject(WorkspaceStorageService);
	readonly current = signal<WorldDate>(this.loadInitial());

	readonly weekday = signal<number>(0);
	readonly moon = signal(getMoonInfo(this.calendarRules.calendar(), this.current()));
	readonly eventsToday = signal(getEventsForDate(this.calendarRules.calendar(), this.current()));

	private loadInitial(): WorldDate {
		try {
			const raw = this.storage.getItem(STORAGE_KEY);
			if (!raw) return { ...this.calendarRules.calendar().epochDate };

			return this.normalizeDate(JSON.parse(raw), this.calendarRules.calendar().epochDate);
		} catch {
			return { ...this.calendarRules.calendar().epochDate };
		}
	}

	private normalizeDate(raw: unknown, fallback: WorldDate): WorldDate {
		if (!raw || typeof raw !== 'object') return { ...fallback };

		const candidate = raw as Partial<WorldDate>;
		const integerInRange = (value: unknown, defaultValue: number, min: number, max?: number) => {
			if (typeof value !== 'number' || !Number.isFinite(value)) return defaultValue;
			const normalized = Math.floor(value);
			if (normalized < min) return min;
			if (max !== undefined && normalized > max) return max;
			return normalized;
		};

		const calendar = this.calendarRules.calendar();
		const season = calendar.seasons.some((item) => item.id === candidate.season)
			? (candidate.season as Season)
			: fallback.season;

		return {
			year: integerInRange(candidate.year, fallback.year, calendar.epochDate.year),
			season,
			day: integerInRange(candidate.day, fallback.day, 1, calendar.daysPerSeason),
			hour: integerInRange(candidate.hour, fallback.hour, 0, 23),
			minute: integerInRange(candidate.minute, fallback.minute, 0, 59),
		};
	}

	constructor() {
		effect(() => {
			const d = this.current();

			const calendar = this.calendarRules.calendar();
			this.weekday.set(getWeekday(calendar, d));
			this.moon.set(getMoonInfo(calendar, d));
			this.eventsToday.set(getEventsForDate(calendar, d));

			try {
				this.storage.setItem(STORAGE_KEY, JSON.stringify(d));
			} catch {}
		});
	}

	setDate(d: WorldDate) {
		this.current.set(this.normalizeDate(d, this.current()));
	}

	reloadFromStorage() {
		this.current.set({ ...this.loadInitial() });
	}

	setSeason(season: Season) {
		this.setDate({ ...this.current(), season });
	}

	reset() {
		this.current.set({ ...this.calendarRules.calendar().epochDate });
	}

	advanceMinutes(delta: number) {
		this.setDate(addMinutes(this.calendarRules.calendar(), this.current(), delta));
	}

	advanceHours(delta: number) {
		this.setDate(addHours(this.calendarRules.calendar(), this.current(), delta));
	}

	advanceDays(delta: number) {
		this.setDate(addDays(this.calendarRules.calendar(), this.current(), delta));
	}
}
