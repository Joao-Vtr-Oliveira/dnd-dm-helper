// src/app/services/world-clock/world-clock.service.ts

import { Injectable, effect, signal } from '@angular/core';
import type { Season, WorldDate } from '../../models/calendar-model';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import {
	EPOCH_DATE,
	addDays,
	addHours,
	addMinutes,
	getEventsForDate,
	getMoonInfo,
	getWeekday,
} from '../../utils/calendar-utils/calendar-util';

const STORAGE_KEY = APP_STORAGE_KEYS.worldDate;

@Injectable({ providedIn: 'root' })
export class WorldClockService {
	readonly current = signal<WorldDate>(this.loadInitial());

	readonly weekday = signal<number>(0);
	readonly moon = signal(getMoonInfo(this.current()));
	readonly eventsToday = signal(getEventsForDate(this.current()));

	private loadInitial(): WorldDate {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return { ...EPOCH_DATE };

			return this.normalizeDate(JSON.parse(raw), EPOCH_DATE);
		} catch {
			return { ...EPOCH_DATE };
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

		const season =
			candidate.season === 'spring' ||
			candidate.season === 'summer' ||
			candidate.season === 'autumn' ||
			candidate.season === 'winter'
				? candidate.season
				: fallback.season;

		return {
			year: integerInRange(candidate.year, fallback.year, EPOCH_DATE.year),
			season,
			day: integerInRange(candidate.day, fallback.day, 1, 30),
			hour: integerInRange(candidate.hour, fallback.hour, 0, 23),
			minute: integerInRange(candidate.minute, fallback.minute, 0, 59),
		};
	}

	constructor() {
		effect(() => {
			const d = this.current();

			this.weekday.set(getWeekday(d));
			this.moon.set(getMoonInfo(d));
			this.eventsToday.set(getEventsForDate(d));

			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
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
		this.current.set({ ...EPOCH_DATE });
	}

	advanceMinutes(delta: number) {
		this.setDate(addMinutes(this.current(), delta));
	}

	advanceHours(delta: number) {
		this.setDate(addHours(this.current(), delta));
	}

	advanceDays(delta: number) {
		this.setDate(addDays(this.current(), delta));
	}
}
