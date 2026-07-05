import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { FiveEToolsHomebrewPage } from './fiveetools-homebrew';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';

describe('FiveEToolsHomebrewPage', () => {
	let component: FiveEToolsHomebrewPage;
	let fixture: ComponentFixture<FiveEToolsHomebrewPage>;

	beforeEach(async () => {
		localStorage.clear();
		localStorage.setItem(
			APP_STORAGE_KEYS.fiveEToolsHomebrew,
			JSON.stringify({
				_meta: {
					sources: [{ json: 'Notion', abbreviation: 'NT', full: 'Notion', version: '1.0.0' }],
				},
				monster: [],
				trap: [],
			}),
		);

		await TestBed.configureTestingModule({
			imports: [FiveEToolsHomebrewPage],
			providers: [provideRouter([]), provideHttpClient()],
		}).compileComponents();

		fixture = TestBed.createComponent(FiveEToolsHomebrewPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
