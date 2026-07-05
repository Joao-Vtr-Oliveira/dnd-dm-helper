import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { HomebrewSheets } from './homebrew-sheets';

describe('HomebrewSheets', () => {
  let component: HomebrewSheets;
  let fixture: ComponentFixture<HomebrewSheets>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
		imports: [HomebrewSheets],
		providers: [provideRouter([]), provideHttpClient()],
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
