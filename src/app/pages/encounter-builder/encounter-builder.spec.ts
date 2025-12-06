import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EncounterBuilder } from './encounter-builder';

describe('EncounterBuilder', () => {
  let component: EncounterBuilder;
  let fixture: ComponentFixture<EncounterBuilder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EncounterBuilder]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EncounterBuilder);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
