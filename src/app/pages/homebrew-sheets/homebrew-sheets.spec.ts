import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { HomebrewSheets } from './homebrew-sheets';
import { LocalStorageService } from '../../services/local-storage-service/local-storage-service';

describe('HomebrewSheets', () => {
  let component: HomebrewSheets;
  let fixture: ComponentFixture<HomebrewSheets>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
		imports: [HomebrewSheets],
		providers: [provideRouter([]), provideHttpClient(), provideZonelessChangeDetection()],
		})
    .compileComponents();

    fixture = TestBed.createComponent(HomebrewSheets);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('exports the current homebrew sheets format with externalId', async () => {
		const storage = TestBed.inject(LocalStorageService);
		const sheet = storage.createSheet({
			title: 'Zhang Huang',
			category: 'npc',
			source: 'Notion',
			externalId: 'npc-zhang-huang',
			data: {
				id: 0,
				name: 'Zhang Huang',
				initiative: null,
				healthPoints: 10,
				maxHealthPoints: 10,
				armorClass: 12,
				temporaryHealthPoints: null,
				alive: true,
				conditions: [],
				notes: [],
				shared: true,
				hitPointsShared: true,
				totalSpellSlots: null,
				usedSpellSlots: null,
				spells: {},
				specialAbilities: [],
				sheetFeatures: [],
				category: 'npc',
			},
		});
		component.sheets.set(storage.listSheets());
		const anchor = { href: '', download: '', click: jasmine.createSpy('click') } as unknown as HTMLAnchorElement;
		spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
		spyOn(URL, 'revokeObjectURL').and.stub();
		const createElement = document.createElement.bind(document);
		spyOn(document, 'createElement').and.callFake(((tagName: string) =>
			tagName.toLowerCase() === 'a' ? anchor : createElement(tagName)) as typeof document.createElement);

		component.exportOne(sheet.id);

		expect(anchor.download).toContain('homebrew-zhang-huang');
		expect(anchor.click).toHaveBeenCalled();
		const blob = (URL.createObjectURL as jasmine.Spy).calls.mostRecent().args[0] as Blob;
		const exported = JSON.parse(await blob.text());
		expect(exported.app).toBe('dnd-dm-helper');
		expect(exported.type).toBe('homebrew-sheets');
		expect(exported.schemaVersion).toBe(1);
		expect(exported.sheets[0].externalId).toBe('npc-zhang-huang');
	});
});
