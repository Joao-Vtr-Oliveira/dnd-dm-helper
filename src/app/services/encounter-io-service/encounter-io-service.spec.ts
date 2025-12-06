import { TestBed } from '@angular/core/testing';

import { EncounterIoService } from './encounter-io-service';

describe('EncounterIoService', () => {
  let service: EncounterIoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EncounterIoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
