import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Calendar } from '../../pages/calendar/calendar';
import { CampaignClock } from './campaign-clock';
import { CampaignContextService } from '../../services/campaign-context-service/campaign-context-service';

describe('CampaignClock', () => {
	let component: CampaignClock;
	let fixture: ComponentFixture<CampaignClock>;
	let calendar: Calendar;
	let campaignContext: CampaignContextService;
	let http: HttpTestingController;

	beforeEach(async () => {
		localStorage.clear();

		await TestBed.configureTestingModule({
			imports: [CampaignClock, Calendar],
			providers: [
				provideZonelessChangeDetection(),
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([{ path: 'home/calendar', component: Calendar }]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(CampaignClock);
		component = fixture.componentInstance;
		calendar = TestBed.createComponent(Calendar).componentInstance;
		campaignContext = TestBed.inject(CampaignContextService);
		http = TestBed.inject(HttpTestingController);
		http.expectOne('/rpg_files/campaign-world.json').flush({
			schemaVersion: 1,
			empires: [
				{ id: 'mornk', name: 'Mornk', aliases: [], sourcePath: 'Mornk.md' },
				{ id: 'komic', name: 'Komic', aliases: [], sourcePath: 'Komic.md' },
			],
			states: [{ id: 'nagazav', name: 'Nagazav', empireId: 'mornk', aliases: [], sourcePath: 'Nagazav.md' }],
			settlements: [{ id: 'nagawoods', name: 'Nagawoods', stateId: 'nagazav', settlementType: 'village', aliases: [], sourcePath: 'Nagawoods.md' }],
			organizations: [],
		});
		fixture.detectChanges();
	});

	afterEach(() => http.verify());

	it('shows the current campaign time and applies quick actions', () => {
		component.open();
		component.advanceMinutes(10);
		expect(component.timeLabel()).toBe('05:10');

		component.advanceMinutes(-10);
		component.advanceHours(1);
		expect(component.timeLabel()).toBe('06:00');

		component.advanceDays(1);
		expect(component.current().day).toBe(2);
	});

	it('shares changes with the full calendar in both directions', () => {
		component.open();
		component.editDay = 15;
		component.editHour = 14;
		component.editMinute = 30;
		component.applyDirectTime();

		expect(calendar.current()).toEqual({
			year: 1000,
			season: 'spring',
			day: 15,
			hour: 14,
			minute: 30,
		});

		calendar.changeHour(1);
		expect(component.timeLabel()).toBe('15:30');
	});

	it('normalizes invalid direct input through the world clock service', () => {
		component.open();
		component.editDay = 99;
		component.editHour = -5;
		component.editMinute = 61;
		component.applyDirectTime();

		expect(component.current().day).toBe(30);
		expect(component.current().hour).toBe(0);
		expect(component.current().minute).toBe(59);
	});

	it('closes the panel and opens the full calendar on request', async () => {
		const router = TestBed.inject(Router);
		const navigate = spyOn(router, 'navigate').and.resolveTo(true);
		component.open();

		component.openCalendar();

		expect(component.isOpen()).toBeFalse();
		expect(navigate).toHaveBeenCalledWith(['/home/calendar']);
	});

	it('hides itself on the full calendar route', async () => {
		const router = TestBed.inject(Router);
		component.open();

		await router.navigateByUrl('/home/calendar');

		expect(component.isCalendarPage()).toBeTrue();
		expect(component.isOpen()).toBeFalse();
	});

	it('filters and clears hierarchical location selections before applying the most specific ref', () => {
		component.beginLocationEdit();
		component.selectEmpire('mornk');
		expect(component.availableStates().map((state) => state.id)).toEqual(['nagazav']);
		component.selectState('nagazav');
		expect(component.availableSettlements().map((settlement) => settlement.id)).toEqual(['nagawoods']);
		component.selectSettlement('nagawoods');
		component.applyLocation();
		expect(campaignContext.currentLocationRef()).toEqual({ scopeType: 'settlement', scopeId: 'nagawoods' });

		component.beginLocationEdit();
		component.selectEmpire('komic');
		expect(component.selectedStateId()).toBe('');
		expect(component.selectedSettlementId()).toBe('');
		component.applyLocation();
		expect(campaignContext.currentLocationRef()).toEqual({ scopeType: 'empire', scopeId: 'komic' });
	});

	it('applies empire-only and state-only locations', () => {
		component.beginLocationEdit();
		component.selectEmpire('mornk');
		component.applyLocation();
		expect(campaignContext.currentLocationRef()).toEqual({ scopeType: 'empire', scopeId: 'mornk' });

		component.beginLocationEdit();
		component.selectEmpire('mornk');
		component.selectState('nagazav');
		component.applyLocation();
		expect(campaignContext.currentLocationRef()).toEqual({ scopeType: 'state', scopeId: 'nagazav' });
	});

	it('renders current location, neutral state, recovery message, and compact trigger classes', () => {
		expect(component.locationLabel()).toBe('Definir posição');
		campaignContext.setCurrentLocation({ scopeType: 'settlement', scopeId: 'nagawoods' });
		expect(component.locationBreadcrumbLabel()).toBe('Mornk › Nagazav › Nagawoods');
		campaignContext.setCurrentLocation({ scopeType: 'settlement', scopeId: 'old-village' });
		expect(component.locationError()).toContain('não encontrada');
		component.open();
		fixture.detectChanges();
		const trigger = fixture.nativeElement.querySelector('button');
		expect(trigger.className).toContain('max-w-[calc(100vw-2rem)]');
		expect(fixture.nativeElement.textContent).toContain('Posição salva não encontrada no catálogo atual.');
	});
});
