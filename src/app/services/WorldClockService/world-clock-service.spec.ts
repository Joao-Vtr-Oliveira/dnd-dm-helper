import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { WorldClockService } from './world-clock-service';

describe('WorldClockService', () => {
	let service: WorldClockService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			providers: [provideZonelessChangeDetection()],
		});
		service = TestBed.inject(WorldClockService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('persists the selected season', () => {
		service.setSeason('autumn');
		TestBed.flushEffects();

		expect(service.current().season).toBe('autumn');
		expect(JSON.parse(localStorage.getItem('dmh-world-date-v1') || '{}').season).toBe('autumn');
	});

	it('advances and rewinds time in shared calendar increments', () => {
		service.setDate({ year: 1000, season: 'spring', day: 2, hour: 10, minute: 0 });

		service.advanceMinutes(10);
		expect(service.current()).toEqual({ year: 1000, season: 'spring', day: 2, hour: 10, minute: 10 });

		service.advanceMinutes(-10);
		expect(service.current()).toEqual({ year: 1000, season: 'spring', day: 2, hour: 10, minute: 0 });

		service.advanceHours(1);
		expect(service.current()).toEqual({ year: 1000, season: 'spring', day: 2, hour: 11, minute: 0 });
	});

	it('crosses day boundaries when changing minutes', () => {
		service.setDate({ year: 1000, season: 'spring', day: 2, hour: 23, minute: 50 });
		service.advanceMinutes(10);
		expect(service.current()).toEqual({ year: 1000, season: 'spring', day: 3, hour: 0, minute: 0 });

		service.advanceMinutes(-10);
		expect(service.current()).toEqual({ year: 1000, season: 'spring', day: 2, hour: 23, minute: 50 });
	});

	it('normalizes direct date changes and keeps them persisted after reload', () => {
		service.setDate({ year: 999, season: 'spring', day: 31, hour: 24, minute: -1 });

		expect(service.current()).toEqual({ year: 1000, season: 'spring', day: 30, hour: 23, minute: 0 });

		service.setDate({ year: 1002, season: 'winter', day: 12, hour: 14, minute: 30 });
		TestBed.flushEffects();
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			providers: [provideZonelessChangeDetection()],
		});
		service = TestBed.inject(WorldClockService);

		expect(service.current()).toEqual({ year: 1002, season: 'winter', day: 12, hour: 14, minute: 30 });
	});
});
