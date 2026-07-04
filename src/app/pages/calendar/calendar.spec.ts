import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Calendar } from './calendar';

describe('Calendar', () => {
	let component: Calendar;
	let fixture: ComponentFixture<Calendar>;

	beforeEach(async () => {
		localStorage.clear();

		await TestBed.configureTestingModule({
			imports: [Calendar],
		}).compileComponents();

		fixture = TestBed.createComponent(Calendar);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('updates the calendar immediately when changing the season select and persists the value', () => {
		const seasonSelect = fixture.debugElement
			.queryAll(By.css('select'))[0]
			.nativeElement as HTMLSelectElement;

		seasonSelect.value = 'winter';
		seasonSelect.dispatchEvent(new Event('change'));
		fixture.detectChanges();

		expect(component.current().season).toBe('winter');
		expect(component.selected().season).toBe('winter');
		expect(JSON.parse(localStorage.getItem('dmh-world-date-v1') || '{}').season).toBe('winter');
	});
});
