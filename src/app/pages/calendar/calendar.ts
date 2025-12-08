// src/app/pages/world-calendar/world-calendar.ts
import { Component, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
	EPOCH_DATE,
	addDays,
	addHours,
	buildSeasonGrid,
	getEventsForDate,
	getMoonInfo,
	getWeekdayLabel,
	type CalendarDayCell,
} from '../../utils/calendar-utils/calendar-util';

import type { MoonPhase, Season, WorldDate } from '../../models/calendar-model';
import { SEASONS } from '../../utils/calendar-utils/calendar-constants';
import { FormsModule } from '@angular/forms';

type WeekRow = (CalendarDayCell | null)[];

const STORAGE_KEY = 'dmh.currentWorldDate';
const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const DEFAULT_HOUR = 5;
const DEFAULT_MINUTE = 0;

@Component({
	selector: 'app-calendar',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './calendar.html',
})
export class Calendar {
	current = signal<WorldDate>(EPOCH_DATE);
	selected = signal<WorldDate>(EPOCH_DATE);

	jumpYearInput = EPOCH_DATE.year;
	jumpSeasonInput: Season = 'spring';
	jumpDayInput = 1;

	weekdayHeaders = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

	weeks = computed<WeekRow[]>(() => {
		const d = this.current();
		const flat = buildSeasonGrid(d.year, d.season);

		const weeks: WeekRow[] = [];
		let row: WeekRow = [];

		const firstWeekday = flat[0]?.weekday ?? 0;
		for (let i = 0; i < firstWeekday; i++) row.push(null);

		for (const cell of flat) {
			row.push(cell);
			if (row.length === 7) {
				weeks.push(row);
				row = [];
			}
		}

		if (row.length) {
			while (row.length < 7) row.push(null);
			weeks.push(row);
		}

		return weeks;
	});

	seasonLabel = computed(() => {
		const s = SEASONS.find((x) => x.id === this.current().season);
		return s?.label ?? this.current().season;
	});

	weekdayLabelCurrent = computed(() => getWeekdayLabel(this.current()));
	moonCurrent = computed(() => getMoonInfo(this.current()));

	weekdayLabelSelected = computed(() => getWeekdayLabel(this.selected()));
	moonSelected = computed(() => getMoonInfo(this.selected()));
	eventsSelected = computed(() => getEventsForDate(this.selected()));

	timeLabelCurrent = computed(() => {
		const d = this.current();
		const hh = String(d.hour).padStart(2, '0');
		const mm = String(d.minute).padStart(2, '0');
		return `${hh}:${mm}`;
	});

	timeLabelSelected = computed(() => {
		const d = this.selected();
		const hh = String(d.hour).padStart(2, '0');
		const mm = String(d.minute).padStart(2, '0');
		return `${hh}:${mm}`;
	});

	constructor() {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as WorldDate;
				this.current.set(parsed);
				this.selected.set(parsed);
			} catch {}
		}

		const start = this.current();
		this.jumpYearInput = start.year;
		this.jumpSeasonInput = start.season;
		this.jumpDayInput = start.day;

		effect(() => {
			const d = this.current();
			localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
		});
	}

	private setCurrent(updater: (d: WorldDate) => WorldDate) {
		this.current.update(updater);
		this.selected.set(this.current());
	}

	goToday() {
		this.setCurrent(() => ({ ...EPOCH_DATE }));
	}

	changeDay(delta: number) {
		this.setCurrent((d) => {
			const moved = addDays(d, delta);
			return {
				...moved,
				hour: DEFAULT_HOUR,
				minute: DEFAULT_MINUTE,
			};
		});
	}

	changeHour(delta: number) {
		this.setCurrent((d) => addHours(d, delta));
	}

	resetTime() {
		this.setCurrent((d) => ({
			...d,
			hour: DEFAULT_HOUR,
			minute: DEFAULT_MINUTE,
		}));
	}

	changeSeason(delta: number) {
		this.setCurrent((d) => {
			let idx = SEASON_ORDER.indexOf(d.season) + delta;
			let year = d.year;
			const n = SEASON_ORDER.length;

			while (idx < 0) {
				idx += n;
				year--;
			}
			while (idx >= n) {
				idx -= n;
				year++;
			}

			const season = SEASON_ORDER[idx];
			const day = Math.min(d.day, 30);

			return { ...d, year, season, day };
		});
	}

	selectCell(cell: CalendarDayCell | null) {
		if (!cell) return;
		const base = this.current();
		this.selected.set({
			...base,
			day: cell.day,
		});
	}

	isSelected(cell: CalendarDayCell | null): boolean {
		if (!cell) return false;
		const s = this.selected();
		const c = this.current();
		return s.day === cell.day && s.season === c.season && s.year === c.year;
	}

	isCurrent(cell: CalendarDayCell | null): boolean {
		if (!cell) return false;
		const c = this.current();
		return c.day === cell.day;
	}

	moonIcon(phase: MoonPhase): string {
		switch (phase) {
			case 'new':
				return '○';
			case 'waxing':
				return '◐';
			case 'full':
				return '●';
			case 'waning':
				return '◑';
		}
	}

	goToDate() {
		const base = this.current();

		const year = this.jumpYearInput || base.year;
		let day = Math.floor(this.jumpDayInput || 1);
		if (day < 1) day = 1;
		if (day > 30) day = 30;
		const season = this.jumpSeasonInput || base.season;

		const next: WorldDate = { ...base, year, season, day };
		this.current.set(next);
		this.selected.set(next);
	}
}
