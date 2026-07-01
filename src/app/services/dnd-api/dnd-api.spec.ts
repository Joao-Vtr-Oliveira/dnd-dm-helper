import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { Dnd5eApiService } from './dnd-api';

describe('Dnd5eApiService', () => {
  let service: Dnd5eApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
    service = TestBed.inject(Dnd5eApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
