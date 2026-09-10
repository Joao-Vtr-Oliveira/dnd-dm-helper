import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { WorldClockService } from '../../services/WorldClockService/world-clock-service';
import { CampaignContextService } from '../../services/campaign-context-service/campaign-context-service';
import { CampaignWorldService } from '../../services/campaign-world-service/campaign-world-service';
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
	readonly locationLabel = computed(() => this.currentLocation()?.label ?? 'Definir posição');
	readonly locationBreadcrumbLabel = computed(() => this.currentLocation()?.breadcrumb.join(' › ') ?? 'Sem posição definida');
	readonly availableStates = computed(() => this.campaignWorld.getStatesByEmpire(this.selectedEmpireId()));
	readonly availableSettlements = computed(() =>
		this.campaignWorld.getSettlementsByState(this.selectedStateId()),
	);
	readonly isEditingLocation = signal(false);
	readonly selectedEmpireId = signal('');
	readonly selectedStateId = signal('');
	readonly selectedSettlementId = signal('');

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
		const location = this.currentLocation();
		this.selectedEmpireId.set(location?.empire?.id ?? '');
		this.selectedStateId.set(location?.state?.id ?? '');
		this.selectedSettlementId.set(location?.settlement?.id ?? '');
		this.isEditingLocation.set(true);
	}

	cancelLocationEdit() {
		this.isEditingLocation.set(false);
	}

	selectEmpire(empireId: string) {
		this.selectedEmpireId.set(empireId);
		this.selectedStateId.set('');
		this.selectedSettlementId.set('');
	}

	selectState(stateId: string) {
		this.selectedStateId.set(stateId);
		this.selectedSettlementId.set('');
	}

	selectSettlement(settlementId: string) {
		this.selectedSettlementId.set(settlementId);
	}

	applyLocation() {
		const empireId = this.selectedEmpireId();
		if (!empireId) return;
		const settlementId = this.selectedSettlementId();
		const stateId = this.selectedStateId();
		if (settlementId) {
			this.campaignContext.setCurrentLocation({ scopeType: 'settlement', scopeId: settlementId });
		} else if (stateId) {
			this.campaignContext.setCurrentLocation({ scopeType: 'state', scopeId: stateId });
		} else {
			this.campaignContext.setCurrentLocation({ scopeType: 'empire', scopeId: empireId });
		}
		this.isEditingLocation.set(false);
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
}
