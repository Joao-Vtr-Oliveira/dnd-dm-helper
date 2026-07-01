import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HomebrewSheets } from './homebrew-sheets';

describe('HomebrewSheets', () => {
  let component: HomebrewSheets;
  let fixture: ComponentFixture<HomebrewSheets>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomebrewSheets],
      providers: [provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(HomebrewSheets);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
