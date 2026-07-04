// src/app/pages/world-calendar/world-calendar.ts
import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
	EPOCH_DATE,
	addDays,
	buildSeasonGrid,
	getEventsForDate,
	getMoonInfo,
	getWeekdayLabel,
	type CalendarDayCell,
} from '../../utils/calendar-utils/calendar-util';

import type { MoonPhase, Season, WorldDate } from '../../models/calendar-model';
import { SEASONS } from '../../utils/calendar-utils/calendar-constants';
import { FormsModule } from '@angular/forms';
import { WorldClockService } from '../../services/WorldClockService/world-clock-service';

type WeekRow = (CalendarDayCell | null)[];

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
	private readonly worldClock = inject(WorldClockService);

	current = this.worldClock.current;
	selected = signal<WorldDate>(this.worldClock.current());

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

	changeMinutes(delta: number) {
		this.setCurrent((d) => {
			const total = d.hour * 60 + d.minute + delta;

			let dayDelta = Math.floor(total / 1440);
			let minOfDay = total % 1440;

			if (minOfDay < 0) {
				minOfDay += 1440;
				dayDelta -= 1;
			}

			const hour = Math.floor(minOfDay / 60);
			const minute = minOfDay % 60;

			const movedDay = addDays(d, dayDelta);
			return { ...movedDay, hour, minute };
		});
	}

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
		const start = this.current();
		this.selected.set(start);
		this.jumpYearInput = start.year;
		this.jumpSeasonInput = start.season;
		this.jumpDayInput = start.day;

		effect(() => {
			const d = this.current();
			this.jumpYearInput = d.year;
			this.jumpSeasonInput = d.season;
			this.jumpDayInput = d.day;

			this.selected.update((selected) => {
				if (
					selected.year === d.year &&
					selected.season === d.season &&
					selected.day === d.day &&
					selected.hour === d.hour &&
					selected.minute === d.minute
				) {
					return selected;
				}

				return { ...selected, ...d };
			});
		});
	}

	private setCurrent(updater: (d: WorldDate) => WorldDate) {
		this.worldClock.setDate(updater(this.current()));
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
		this.worldClock.advanceHours(delta);
		this.selected.set(this.current());
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

	setSeason(season: Season) {
		this.worldClock.setSeason(season);
		this.selected.set(this.current());
		this.jumpSeasonInput = season;
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
		this.worldClock.setDate(next);
		this.selected.set(next);
	}
}
