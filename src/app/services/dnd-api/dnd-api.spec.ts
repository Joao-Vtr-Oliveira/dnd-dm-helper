import { TestBed } from '@angular/core/testing';

import { DndApi } from './dnd-api';

describe('DndApi', () => {
  let service: DndApi;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DndApi);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
