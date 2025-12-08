// src/app/services/world-clock/world-clock.service.ts

import { Injectable, effect, signal } from '@angular/core';
import type { WorldDate } from '../../models/calendar-model';
import {
	EPOCH_DATE,
	addDays,
	addHours,
	addMinutes,
	getEventsForDate,
	getMoonInfo,
	getWeekday,
} from '../../utils/calendar-utils/calendar-util';

const STORAGE_KEY = 'dmh-world-date-v1';

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

			const parsed = JSON.parse(raw);
			if (
				typeof parsed.year === 'number' &&
				typeof parsed.season === 'string' &&
				typeof parsed.day === 'number' &&
				typeof parsed.hour === 'number' &&
				typeof parsed.minute === 'number'
			) {
				return parsed as WorldDate;
			}

			return { ...EPOCH_DATE };
		} catch {
			return { ...EPOCH_DATE };
		}
	}

	constructor() {
		effect(() => {
			const d = this.current();

			this.weekday.set(getWeekday(d));
			this.moon.set(getMoonInfo(d));
			this.eventsToday.set(getEventsForDate(d));

			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
			} catch {
			}
		});
	}


	setDate(d: WorldDate) {
		this.current.set({ ...d });
	}

	reset() {
		this.current.set({ ...EPOCH_DATE });
	}

	advanceMinutes(delta: number) {
		this.current.update((d) => addMinutes(d, delta));
	}

	advanceHours(delta: number) {
		this.current.update((d) => addHours(d, delta));
	}

	advanceDays(delta: number) {
		this.current.update((d) => addDays(d, delta));
	}
}
