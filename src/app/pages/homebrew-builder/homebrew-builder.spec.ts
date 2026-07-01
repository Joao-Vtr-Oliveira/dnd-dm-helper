import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { HomebrewBuilder } from './homebrew-builder';

describe('HomebrewBuilder', () => {
  let component: HomebrewBuilder;
  let fixture: ComponentFixture<HomebrewBuilder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomebrewBuilder],
      providers: [
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

    fixture = TestBed.createComponent(HomebrewBuilder);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
