import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { LucideClock, LucideX } from '@lucide/angular';
import { filter } from 'rxjs';
import { WorldClockService } from '../../services/WorldClockService/world-clock-service';
import { CampaignContextService } from '../../services/campaign-context-service/campaign-context-service';
import { DialogFocusDirective } from '../../directives/dialog-focus';
import { CampaignWorldService } from '../../services/campaign-world-service/campaign-world-service';
import { SEASONS } from '../../utils/calendar-utils/calendar-constants';
import { getWeekdayLabel } from '../../utils/calendar-utils/calendar-util';

@Component({
	selector: 'app-campaign-clock',
	standalone: true,
	imports: [CommonModule, DialogFocusDirective, FormsModule, LucideClock, LucideX],
	templateUrl: './campaign-clock.html',
})
export class CampaignClock {
	private readonly destroyRef = inject(DestroyRef);
	private readonly router = inject(Router);
	private readonly worldClock = inject(WorldClockService);
	private readonly campaignContext = inject(CampaignContextService);
	readonly campaignWorld = inject(CampaignWorldService);

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
	readonly worldStatus = this.campaignWorld.status;
	readonly worldError = this.campaignWorld.error;
	readonly currentLocation = this.campaignContext.resolvedCurrentLocation;
	readonly locationError = this.campaignContext.locationError;
	readonly locationLabel = computed(
		() => this.currentLocation()?.label ?? this.savedLocationLabel() ?? 'Definir posição',
	);
	readonly locationBreadcrumbLabel = computed(
		() => this.currentLocation()?.breadcrumb.join(' › ') ?? this.savedLocationLabel() ?? 'Sem posição definida',
	);
	readonly isEditingLocation = signal(false);
	readonly locationSearchQuery = signal('');
	readonly locationSearchResults = computed(() =>
		this.campaignWorld.searchLocations(this.locationSearchQuery()).slice(0, 7),
	);

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

	beginLocationEdit() {
		this.locationSearchQuery.set('');
		this.isEditingLocation.set(true);
	}

	cancelLocationEdit() {
		this.isEditingLocation.set(false);
	}

	setLocationFromSearch(ref: { scopeType: 'empire' | 'state' | 'settlement'; scopeId: string }) {
		this.campaignContext.setCurrentLocation(ref);
		this.isEditingLocation.set(false);
	}

	openWorld() {
		this.close();
		void this.router.navigate(['/home/world']);
	}

	clearLocation() {
		this.campaignContext.clearCurrentLocation();
		this.isEditingLocation.set(false);
	}

	private syncInputs() {
		const { day, hour, minute } = this.current();
		this.editDay = day;
		this.editHour = hour;
		this.editMinute = minute;
	}

	private savedLocationLabel(): string | null {
		const location = this.campaignContext.currentLocationRef();
		if (!location) return null;
		const type = location.scopeType === 'empire' ? 'Império' : location.scopeType === 'state' ? 'Estado' : 'Localidade';
		const name = location.scopeId
			.split('-')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
		return `${type}: ${name}`;
	}
}
