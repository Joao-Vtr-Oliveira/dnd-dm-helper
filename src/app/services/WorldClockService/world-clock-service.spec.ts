import { TestBed } from '@angular/core/testing';
import { WorldClockService } from './world-clock-service';

describe('WorldClockService', () => {
	let service: WorldClockService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({});
		service = TestBed.inject(WorldClockService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('persists the selected season', () => {
		service.setSeason('autumn');

		expect(service.current().season).toBe('autumn');
		expect(JSON.parse(localStorage.getItem('dmh-world-date-v1') || '{}').season).toBe('autumn');
	});
});
