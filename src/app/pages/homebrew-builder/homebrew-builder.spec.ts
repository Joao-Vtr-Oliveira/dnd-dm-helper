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

	it('syncs title into creature name until the user edits the name manually', () => {
		component.setTitle('Rosa V.');
		expect(component.creature().name).toBe('Rosa V.');

		component.setTitle('Rosa Vermelha');
		expect(component.creature().name).toBe('Rosa Vermelha');

		component.setName('Lady Rosa');
		component.setTitle('Rosa Final');
		expect(component.creature().name).toBe('Lady Rosa');
	});
});
