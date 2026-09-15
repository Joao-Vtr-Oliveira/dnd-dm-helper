// src/app/pages/world-calendar/world-calendar.ts
import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
	addDays,
	buildSeasonGrid,
	getEventsForDate,
	getMoonInfo,
	getWeekdayLabel,
	type CalendarDayCell,
} from '../../utils/calendar-utils/calendar-util';

import type { CalendarEvent, MoonPhase, Season, WorldDate } from '../../models/calendar-model';
import { FormsModule } from '@angular/forms';
import { AppSelectComponent } from '../../components/app-select/app-select';
import { WorldClockService } from '../../services/WorldClockService/world-clock-service';
import { CampaignCalendarService } from '../../services/campaign-calendar-service/campaign-calendar-service';
import { CampaignWorldService } from '../../services/campaign-world-service/campaign-world-service';
import {
	LucideCalendarDays,
	LucideChevronLeft,
	LucideChevronRight,
	LucideClock3,
	LucideMoon,
	LucideRotateCcw,
	LucideSparkles,
	LucideX,
} from '@lucide/angular';

type WeekRow = (CalendarDayCell | null)[];

@Component({
	selector: 'app-calendar',
	standalone: true,
	imports: [
		AppSelectComponent,
		CommonModule,
		FormsModule,
		LucideCalendarDays,
		LucideChevronLeft,
		LucideChevronRight,
		LucideClock3,
		LucideMoon,
		LucideRotateCcw,
		LucideSparkles,
		LucideX,
	],
	templateUrl: './calendar.html',
})
export class Calendar {
	private readonly worldClock = inject(WorldClockService);
	readonly calendarRules = inject(CampaignCalendarService);
	private readonly campaignWorld = inject(CampaignWorldService);

	current = this.worldClock.current;
	selected = signal<WorldDate>(this.worldClock.current());

	jumpYearInput = this.calendarRules.calendar().epochDate.year;
	jumpSeasonInput: Season = 'spring';
	jumpDayInput = 1;

	weekdayHeaders = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
	seasonOptions = this.calendarRules
		.calendar()
		.seasons.map((season) => ({ value: season.id, label: season.label }));
	daysPerSeason = this.calendarRules.calendar().daysPerSeason;
	defaultTimeLabel = `${String(this.calendarRules.calendar().epochDate.hour).padStart(2, '0')}:${String(this.calendarRules.calendar().epochDate.minute).padStart(2, '0')}`;
	defaultDateLabel = `${this.calendarRules.calendar().epochDate.day} de ${this.calendarRules.calendar().seasons.find((season) => season.id === this.calendarRules.calendar().epochDate.season)?.label ?? this.calendarRules.calendar().epochDate.season} do ano ${this.calendarRules.calendar().epochDate.year}`;
	calendarManagementOpen = signal(false);
	calendarSettingsOpen = signal(false);
	eventEditorOpen = signal(false);
	eventId = signal<string | null>(null);
	eventTitle = '';
	eventSeason: Season = 'spring';
	eventDay = 1;
	eventDescription = '';
	eventTags: string[] = [];
	eventTagInput = '';
	eventDeity = '';
	settingsDaysPerSeason = this.calendarRules.calendar().daysPerSeason;
	settingsEpochYear = this.calendarRules.calendar().epochDate.year;
	settingsEpochSeason: Season = this.calendarRules.calendar().epochDate.season;
	settingsEpochDay = this.calendarRules.calendar().epochDate.day;

	weeks = computed<WeekRow[]>(() => {
		const d = this.current();
		const flat = buildSeasonGrid(this.calendarRules.calendar(), d.year, d.season);

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
		this.worldClock.advanceMinutes(delta);
		this.selected.set(this.current());
	}

	seasonLabel = computed(() => {
		const s = this.calendarRules.calendar().seasons.find((x) => x.id === this.current().season);
		return s?.label ?? this.current().season;
	});

	weekdayLabelCurrent = computed(() =>
		getWeekdayLabel(this.calendarRules.calendar(), this.current()),
	);
	moonCurrent = computed(() => getMoonInfo(this.calendarRules.calendar(), this.current()));
	eventsCurrent = computed(() => getEventsForDate(this.calendarRules.calendar(), this.current()));
	seasonTheme = computed(() => {
		switch (this.current().season) {
			case 'spring':
				return 'calendar-spring';
			case 'summer':
				return 'calendar-summer';
			case 'autumn':
				return 'calendar-autumn';
			case 'winter':
				return 'calendar-winter';
		}
	});

	weekdayLabelSelected = computed(() =>
		getWeekdayLabel(this.calendarRules.calendar(), this.selected()),
	);
	moonSelected = computed(() => getMoonInfo(this.calendarRules.calendar(), this.selected()));
	eventsSelected = computed(() => getEventsForDate(this.calendarRules.calendar(), this.selected()));

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
	resetConfirmation = signal<'date' | 'time' | null>(null);

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

	private goToday() {
		this.setCurrent(() => ({ ...this.calendarRules.calendar().epochDate }));
	}

	changeDay(delta: number) {
		this.setCurrent((d) => {
			const moved = addDays(this.calendarRules.calendar(), d, delta);
			return {
				...moved,
				hour: this.calendarRules.calendar().epochDate.hour,
				minute: this.calendarRules.calendar().epochDate.minute,
			};
		});
	}

	changeHour(delta: number) {
		this.worldClock.advanceHours(delta);
		this.selected.set(this.current());
	}

	private resetTime() {
		this.setCurrent((d) => ({
			...d,
			hour: this.calendarRules.calendar().epochDate.hour,
			minute: this.calendarRules.calendar().epochDate.minute,
		}));
	}

	requestReset(kind: 'date' | 'time') {
		this.resetConfirmation.set(kind);
	}

	cancelReset() {
		this.resetConfirmation.set(null);
	}

	confirmReset() {
		const kind = this.resetConfirmation();
		this.resetConfirmation.set(null);
		if (kind === 'date') this.goToday();
		if (kind === 'time') this.resetTime();
	}

	@HostListener('window:keydown.escape')
	onEscape() {
		if (this.resetConfirmation()) this.cancelReset();
	}

	changeSeason(delta: number) {
		this.setCurrent((d) => {
			const seasonOrder = this.calendarRules.calendar().seasons.map((season) => season.id);
			let idx = seasonOrder.indexOf(d.season) + delta;
			let year = d.year;
			const n = seasonOrder.length;

			while (idx < 0) {
				idx += n;
				year--;
			}
			while (idx >= n) {
				idx -= n;
				year++;
			}

			const season = seasonOrder[idx];
			const day = Math.min(d.day, this.calendarRules.calendar().daysPerSeason);

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
		if (day > this.calendarRules.calendar().daysPerSeason)
			day = this.calendarRules.calendar().daysPerSeason;
		const season = this.jumpSeasonInput || base.season;

		const next: WorldDate = { ...base, year, season, day };
		this.worldClock.setDate(next);
		this.selected.set(next);
	}

	openEventEditor(event?: CalendarEvent): void {
		this.calendarManagementOpen.set(true);
		this.eventId.set(event?.id ?? null);
		this.eventTitle = event?.title ?? '';
		this.eventSeason = event?.season ?? this.current().season;
		this.eventDay = event?.day ?? this.current().day;
		this.eventDescription = event?.description ?? '';
		this.eventTags = [...(event?.tags ?? [])];
		this.eventTagInput = '';
		this.eventDeity = event?.deity ?? '';
		this.eventEditorOpen.set(true);
	}

	toggleCalendarManagement(): void {
		this.calendarManagementOpen.update((open) => !open);
		if (this.calendarManagementOpen()) return;
		this.calendarSettingsOpen.set(false);
		this.eventEditorOpen.set(false);
	}

	toggleCalendarSettings(): void {
		this.calendarManagementOpen.set(true);
		this.calendarSettingsOpen.update((open) => !open);
	}

	commitEventTag(): void {
		const tag = this.eventTagInput.trim().replace(/,$/, '').trim();
		if (
			tag &&
			!this.eventTags.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase())
		) {
			this.eventTags = [...this.eventTags, tag];
		}
		this.eventTagInput = '';
	}

	commitEventTagOnKeydown(event: KeyboardEvent): void {
		if (event.key !== ',' && event.key !== 'Enter') return;
		event.preventDefault();
		this.commitEventTag();
	}

	removeEventTag(tag: string): void {
		this.eventTags = this.eventTags.filter((item) => item !== tag);
	}

	saveEvent(): void {
		const world = this.campaignWorld.world();
		if (!world || !this.eventTitle.trim() || !this.eventDescription.trim()) return;
		this.commitEventTag();
		const day = Math.floor(Number(this.eventDay));
		if (!Number.isInteger(day) || day < 1 || day > world.calendar.daysPerSeason) return;
		const event: CalendarEvent = {
			id: this.eventId() ?? `event-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`,
			season: this.eventSeason,
			day,
			title: this.eventTitle.trim(),
			description: this.eventDescription.trim(),
			...(this.eventTags.length ? { tags: this.eventTags } : {}),
			...(this.eventDeity.trim()
				? { deity: this.eventDeity.trim() as CalendarEvent['deity'] }
				: {}),
		};
		const next = structuredClone(world);
		const index = next.calendar.events.findIndex((item) => item.id === event.id);
		if (index >= 0) next.calendar.events[index] = event;
		else next.calendar.events.push(event);
		this.campaignWorld.saveWorld(next);
		this.eventEditorOpen.set(false);
	}

	deleteEvent(id: string): void {
		const world = this.campaignWorld.world();
		if (!world || !confirm('Excluir esta data comemorativa?')) return;
		const next = structuredClone(world);
		next.calendar.events = next.calendar.events.filter((item) => item.id !== id);
		this.campaignWorld.saveWorld(next);
	}

	saveCalendarSettings(): void {
		const world = this.campaignWorld.world();
		const daysPerSeason = Math.floor(Number(this.settingsDaysPerSeason));
		const epochDay = Math.floor(Number(this.settingsEpochDay));
		const epochYear = Math.floor(Number(this.settingsEpochYear));
		if (
			!world ||
			!Number.isInteger(daysPerSeason) ||
			daysPerSeason < 1 ||
			epochDay < 1 ||
			epochDay > daysPerSeason ||
			epochYear < 0
		)
			return;
		if (
			this.current().day > daysPerSeason &&
			!confirm('A data atual será ajustada ao último dia da estação. Continuar?')
		)
			return;
		const next = structuredClone(world);
		next.calendar.daysPerSeason = daysPerSeason;
		next.calendar.epochDate = {
			...next.calendar.epochDate,
			year: epochYear,
			season: this.settingsEpochSeason,
			day: epochDay,
		};
		next.calendar.events = next.calendar.events.filter((event) => event.day <= daysPerSeason);
		this.campaignWorld.saveWorld(next);
		this.worldClock.setDate(this.current());
		this.calendarSettingsOpen.set(false);
	}
}
