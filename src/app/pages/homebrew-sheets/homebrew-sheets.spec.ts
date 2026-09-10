import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { HomebrewSheets } from './homebrew-sheets';
import { LocalStorageService } from '../../services/local-storage-service/local-storage-service';
import { FiveEToolsHomebrewService } from '../../services/fiveetools-homebrew-service/fiveetools-homebrew-service';

describe('HomebrewSheets', () => {
  let component: HomebrewSheets;
  let fixture: ComponentFixture<HomebrewSheets>;

  beforeEach(async () => {
		localStorage.clear();
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

	it('requires confirmation before deleting a sheet', () => {
		const storage = TestBed.inject(LocalStorageService);
		const sheet = storage.createSheet({
			title: 'Sheet to delete',
			category: 'monster',
			source: 'HB',
			data: { name: 'Sheet to delete' } as any,
		});
		component.sheets.set(storage.listSheets());

		component.remove(sheet.id);
		expect(component.confirmModal()?.action).toBe('delete-sheet');
		expect(storage.getSheet(sheet.id)).not.toBeNull();
		component.confirmAction();
		expect(storage.getSheet(sheet.id)).toBeNull();
	});

	it('uses an accessible import dialog and closes it with Escape', () => {
		component.openImport();
		fixture.detectChanges();

		const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
		expect(dialog?.getAttribute('aria-labelledby')).toBe('sheet-import-title');
		expect(dialog?.getAttribute('aria-modal')).toBe('true');
		component.onEscape();
		expect(component.importOpen()).toBeFalse();
	});

	it('previews the 5etools write before creating a backup or changing the file', async () => {
		const storage = TestBed.inject(LocalStorageService);
		const fiveETools = TestBed.inject(FiveEToolsHomebrewService);
		const sheet = storage.createSheet({
			title: 'Prepared monster',
			category: 'monster',
			source: 'HB',
			data: { name: 'Prepared monster' } as any,
		});
		component.sheets.set(storage.listSheets());
		const file = { _meta: { sources: [{ json: 'HB' }] }, monster: [] } as any;
		spyOn(fiveETools, 'loadLocalHomebrewJson').and.resolveTo(file);
		spyOn(fiveETools, 'buildSummary').and.returnValue({ primarySource: 'HB' } as any);
		spyOn(fiveETools, 'convertSheetToMonster').and.returnValue({ name: 'Prepared monster', source: 'HB' } as any);
		const createBackup = spyOn(fiveETools, 'createBackup');
		const saveHomebrewFile = spyOn(fiveETools, 'saveHomebrewFile');

		await component.addToFiveETools(sheet.id);

		expect(component.confirmModal()?.action).toBe('add-to-fiveetools');
		expect(component.confirmModal()?.confirmLabel).toBe('Adicionar ao 5etools');
		expect(createBackup).not.toHaveBeenCalled();
		expect(saveHomebrewFile).not.toHaveBeenCalled();
	});
});
