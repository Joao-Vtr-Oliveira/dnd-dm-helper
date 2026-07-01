import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EncounterHub } from './encounter-hub';

describe('EncounterHub', () => {
  let component: EncounterHub;
  let fixture: ComponentFixture<EncounterHub>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EncounterHub],
      providers: [provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(EncounterHub);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
