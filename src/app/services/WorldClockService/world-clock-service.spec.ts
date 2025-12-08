import { TestBed } from '@angular/core/testing';

import { WorldClockService } from './world-clock-service';

describe('WorldClockService', () => {
  let service: WorldClockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WorldClockService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
