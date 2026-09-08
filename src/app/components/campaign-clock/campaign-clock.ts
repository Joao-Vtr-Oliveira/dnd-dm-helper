import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { WorldClockService } from '../../services/WorldClockService/world-clock-service';
import { SEASONS } from '../../utils/calendar-utils/calendar-constants';
import { getWeekdayLabel } from '../../utils/calendar-utils/calendar-util';

@Component({
	selector: 'app-campaign-clock',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './campaign-clock.html',
})
export class CampaignClock {
	private readonly destroyRef = inject(DestroyRef);
	private readonly router = inject(Router);
	private readonly worldClock = inject(WorldClockService);

	readonly current = this.worldClock.current;
	readonly isOpen = signal(false);
	readonly isCalendarPage = signal(this.router.url.startsWith('/home/calendar'));
	readonly seasonLabel = computed(
		() => SEASONS.find((season) => season.id === this.current().season)?.label ?? this.current().season,
	);
	readonly weekdayLabel = computed(() => getWeekdayLabel(this.current()));
	readonly timeLabel = computed(() => {
		const { hour, minute } = this.current();
		return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
	});
	readonly eventLabel = computed(() => this.worldClock.eventsToday()[0]?.title ?? null);

	editDay = this.current().day;
	editHour = this.current().hour;
	editMinute = this.current().minute;

	constructor() {
		this.router.events
			.pipe(
				filter((event): event is NavigationEnd => event instanceof NavigationEnd),
				takeUntilDestroyed(this.destroyRef),
			)
			.subscribe((event) => {
				const isCalendarPage = event.urlAfterRedirects.startsWith('/home/calendar');
				this.isCalendarPage.set(isCalendarPage);
				if (isCalendarPage) this.close();
			});
	}

	open() {
		this.syncInputs();
		this.isOpen.set(true);
	}

	close() {
		this.isOpen.set(false);
	}

	advanceMinutes(delta: number) {
		this.worldClock.advanceMinutes(delta);
		this.syncInputs();
	}

	advanceHours(delta: number) {
		this.worldClock.advanceHours(delta);
		this.syncInputs();
	}

	advanceDays(delta: number) {
		this.worldClock.advanceDays(delta);
		this.syncInputs();
	}

	applyDirectTime() {
		this.worldClock.setDate({
			...this.current(),
			day: this.editDay,
			hour: this.editHour,
			minute: this.editMinute,
		});
		this.syncInputs();
	}

	openCalendar() {
		this.close();
		void this.router.navigate(['/home/calendar']);
	}

	private syncInputs() {
		const { day, hour, minute } = this.current();
		this.editDay = day;
		this.editHour = hour;
		this.editMinute = minute;
	}
}
