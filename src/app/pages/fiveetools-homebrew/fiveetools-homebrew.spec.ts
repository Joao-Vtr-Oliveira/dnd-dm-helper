import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { FiveEToolsHomebrewPage } from './fiveetools-homebrew';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import { FiveEToolsHomebrewService } from '../../services/fiveetools-homebrew-service/fiveetools-homebrew-service';

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
			providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient()],
		}).compileComponents();

		fixture = TestBed.createComponent(FiveEToolsHomebrewPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('clears all browse filters together', () => {
		component.search.set('owl');
		component.collectionTab.set('trap');
		component.sourceFilter.set('NT');
		component.groupFilter.set('construct');
		component.creatureTypeFilter.set('construct');
		component.crFilter.set('2-4');
		component.advancedFiltersOpen.set(true);

		component.clearFilters();

		expect(component.search()).toBe('');
		expect(component.collectionTab()).toBe('all');
		expect(component.sourceFilter()).toBe('all');
		expect(component.groupFilter()).toBe('all');
		expect(component.creatureTypeFilter()).toBe('all');
		expect(component.crFilter()).toBe('all');
		expect(component.advancedFiltersOpen()).toBeFalse();
	});

	it('opens a preview and hands an entity to the Encounter Builder', () => {
		const service = TestBed.inject(FiveEToolsHomebrewService);
		const router = TestBed.inject(Router);
		const navigate = spyOn(router, 'navigate').and.resolveTo(true);
		const file = service.createEmptyFile('Notion');
		const monster = service.createEmptyMonster('Notion');
		monster.name = 'Clockwork Owl';
		file.monster = [monster];
		component.file.set(file);
		const entity = component.monsterSummaries()[0];

		component.openPreview(entity);
		expect(component.previewModal()?.summary.id).toBe(entity.id);

		component.addEntityToEncounter(entity);
		expect(navigate).toHaveBeenCalledWith(['/home/encounter-builder'], {
			state: { fiveEToolsImport: { entityId: entity.id } },
		});
	});
});
