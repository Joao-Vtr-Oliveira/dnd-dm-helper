import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { Calendar } from '../../pages/calendar/calendar';
import { CampaignClock } from './campaign-clock';

describe('CampaignClock', () => {
	let component: CampaignClock;
	let fixture: ComponentFixture<CampaignClock>;
	let calendar: Calendar;

	beforeEach(async () => {
		localStorage.clear();

		await TestBed.configureTestingModule({
			imports: [CampaignClock, Calendar],
			providers: [
				provideZonelessChangeDetection(),
				provideRouter([{ path: 'home/calendar', component: Calendar }]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(CampaignClock);
		component = fixture.componentInstance;
		calendar = TestBed.createComponent(Calendar).componentInstance;
		fixture.detectChanges();
	});

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
});
