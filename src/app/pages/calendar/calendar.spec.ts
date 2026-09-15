import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { Calendar } from './calendar';

describe('Calendar', () => {
	let component: Calendar;
	let fixture: ComponentFixture<Calendar>;

	beforeEach(async () => {
		localStorage.clear();

		await TestBed.configureTestingModule({
			imports: [Calendar],
			providers: [provideZonelessChangeDetection()],
		}).compileComponents();

		fixture = TestBed.createComponent(Calendar);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('updates the calendar immediately when changing the season select and persists the value', () => {
		const seasonSelect = fixture.debugElement.query(By.css('app-select')).componentInstance;
		seasonSelect.valueChange.emit('winter');
		fixture.detectChanges();

		expect(component.current().season).toBe('winter');
		expect(component.selected().season).toBe('winter');
		expect(JSON.parse(localStorage.getItem('dmh-world-date-v1') || '{}').season).toBe('winter');
	});

	it('keeps the selected date aligned with the current world date without re-entering the effect loop', () => {
		expect(() => {
			component.changeHour(1);
			fixture.detectChanges();
		}).not.toThrow();

		expect(component.selected().hour).toBe(component.current().hour);
		expect(component.selected().day).toBe(component.current().day);
	});

	it('selects a day for inspection without changing the world clock', () => {
		const currentDay = component.current().day;
		const cell =
			component
				.weeks()
				.flat()
				.find((candidate) => candidate?.day !== currentDay) ?? null;

		expect(cell).not.toBeNull();
		component.selectCell(cell);

		expect(component.selected().day).toBe(cell!.day);
		expect(component.current().day).toBe(currentDay);
	});

	it('keeps the header event summary tied to the current world date', () => {
		component.jumpSeasonInput = 'spring';
		component.jumpDayInput = 18;
		component.goToDate();
		const otherDay =
			component
				.weeks()
				.flat()
				.find((candidate) => candidate?.day === 17) ?? null;

		component.selectCell(otherDay);

		expect(component.eventsCurrent()).toHaveSize(1);
		expect(component.eventsSelected()).toHaveSize(0);
	});

	it('moves across the year boundary when navigating to the previous season', () => {
		component.jumpYearInput = 1001;
		component.jumpSeasonInput = 'spring';
		component.goToDate();
		const year = component.current().year;

		component.changeSeason(-1);

		expect(component.current().season).toBe('winter');
		expect(component.current().year).toBe(year - 1);
	});

	it('only resets time after confirming the action', () => {
		component.changeHour(4);
		expect(component.current().hour).toBe(9);

		component.requestReset('time');
		expect(component.resetConfirmation()).toBe('time');
		expect(component.current().hour).toBe(9);

		component.confirmReset();
		expect(component.resetConfirmation()).toBeNull();
		expect(component.current().hour).toBe(5);
	});

	it('keeps calendar management closed until explicitly requested', () => {
		expect(component.calendarManagementOpen()).toBeFalse();
		component.openEventEditor();
		expect(component.calendarManagementOpen()).toBeTrue();
		expect(component.eventEditorOpen()).toBeTrue();
		component.toggleCalendarManagement();
		expect(component.calendarManagementOpen()).toBeFalse();
		expect(component.eventEditorOpen()).toBeFalse();
	});

	it('stores event tags as distinct chips', () => {
		component.openEventEditor();
		component.eventTagInput = 'Festival de Colheita';
		component.commitEventTag();
		component.eventTagInput = 'festival de colheita';
		component.commitEventTag();

		expect(component.eventTags).toEqual(['Festival de Colheita']);
	});
});
