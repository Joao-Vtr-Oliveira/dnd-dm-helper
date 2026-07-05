import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { EncounterBuilder } from './encounter-builder';

describe('EncounterBuilder', () => {
  let component: EncounterBuilder;
  let fixture: ComponentFixture<EncounterBuilder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
		imports: [EncounterBuilder],
		providers: [
			provideHttpClient(),
			provideRouter([]),
			{
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({}),
            },
          },
        },
      ],
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
