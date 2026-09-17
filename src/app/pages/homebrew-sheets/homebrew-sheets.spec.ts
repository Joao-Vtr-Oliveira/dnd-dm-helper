import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { HomebrewSheets } from './homebrew-sheets';
import { LocalStorageService } from '../../services/local-storage-service/local-storage-service';
import { FiveEToolsHomebrewService } from '../../services/fiveetools-homebrew-service/fiveetools-homebrew-service';
import { CreatureStatBlockComponent } from '../../components/creature-stat-block/creature-stat-block';
import { By } from '@angular/platform-browser';

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

	it('opens a full sheet viewer from the blue eye action', () => {
		const storage = TestBed.inject(LocalStorageService);
		const sheet = storage.createSheet({
			title: 'Watcher',
			category: 'monster',
			source: 'HB',
			data: {
				name: 'Watcher', armorClass: 15, maxHp: 30, size: 'Medium', alignment: 'Neutral',
				spellSlots: [], spells: [], specialAbilities: [],
				features: [{ id: 'watch', name: 'Keen Sight', description: 'The watcher sees all.', kind: 'trait' }],
			},
		});
		component.sheets.set(storage.listSheets());
		fixture.detectChanges();

		(fixture.nativeElement.querySelector(`[aria-label="Ver ficha ${sheet.title}"]`) as HTMLButtonElement).click();
		fixture.detectChanges();

		expect(component.viewerSheet()?.id).toBe(sheet.id);
		expect(fixture.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain('Keen Sight');
		component.onEscape();
		expect(component.viewerSheet()).toBeNull();
	});

	it('opens Quick Spell View when a referenced spell is selected in the viewer', async () => {
		const storage = TestBed.inject(LocalStorageService);
		const sheet = storage.createSheet({
			title: 'Mage', category: 'npc', source: 'HB',
			data: {
				name: 'Mage', armorClass: 12, maxHp: 18, spellSlots: [], specialAbilities: [], features: [],
				spells: [{ id: 'aid', name: 'Aid', source: 'PHB', level: 2 }],
			},
		});
		component.sheets.set(storage.listSheets());
		const openSpell = spyOn(component, 'openSpellQuickView').and.resolveTo();
		component.openViewer(sheet.id);
		fixture.detectChanges();

		fixture.debugElement.query(By.directive(CreatureStatBlockComponent)).componentInstance.selectedSpell.emit(sheet.data.spells[0]);

		expect(openSpell).toHaveBeenCalledWith(sheet.data.spells[0]);
	});

	it('exports the current homebrew sheets format with externalId', async () => {
		const storage = TestBed.inject(LocalStorageService);
		const sheet = storage.createSheet({
			title: 'Zhang Huang',
			category: 'npc',
			source: 'Notion',
			externalId: 'npc-zhang-huang',
			archived: true,
			generic: true,
			locationRefs: [],
			organizationRefs: [{ organizationId: 'winterhold', relation: 'institution' }],
			data: {
				name: 'Zhang Huang',
				maxHp: 10,
				armorClass: 12,
				spellSlots: [],
				spells: [],
				specialAbilities: [],
				features: [],
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
		expect(exported.schemaVersion).toBe(2);
		expect(exported.sheets[0].externalId).toBe('npc-zhang-huang');
		expect(exported.sheets[0].archived).toBeTrue();
		expect(exported.sheets[0].generic).toBeTrue();
		expect(exported.sheets[0].locationRefs).toEqual(sheet.locationRefs);
		expect(exported.sheets[0].organizationRefs).toEqual(sheet.organizationRefs);
	});

	it('requires confirmation before deleting a sheet', () => {
		const storage = TestBed.inject(LocalStorageService);
		const sheet = storage.createSheet({
			title: 'Sheet to delete',
			category: 'monster',
			source: 'HB',
			data: {
				name: 'Sheet to delete',
				armorClass: 13,
				maxHp: 20,
				spellSlots: [],
				spells: [],
				specialAbilities: [],
				features: [],
			},
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

	it('cascades location filters from a settlement and clears every filter', () => {
		component.campaignWorld.world.set({
			empires: [{ id: 'empire', name: 'Empire', aliases: [] }],
			states: [{ id: 'state', name: 'State', aliases: [], empireId: 'empire' }],
			settlements: [
				{ id: 'settlement', name: 'Settlement', aliases: [], stateId: 'state', settlementType: 'city' },
			],
			organizations: [],
			pointsOfInterest: [],
		} as never);

		component.setSettlementFilter('settlement');
		component.statusFilter.set('archived');
		component.characterClassFilter.set('wizard');
		component.organizationFilter.set('arcane-order');

		expect(component.empireFilter()).toBe('empire');
		expect(component.stateFilter()).toBe('state');
		expect(component.settlementFilter()).toBe('settlement');
		component.clearFilters();
		expect(component.statusFilter()).toBe('active');
		expect(component.empireFilter()).toBe('all');
		expect(component.stateFilter()).toBe('all');
		expect(component.settlementFilter()).toBe('all');
		expect(component.characterClassFilter()).toBe('all');
		expect(component.organizationFilter()).toBe('all');
	});

	it('previews the 5etools write before creating a backup or changing the file', async () => {
		const storage = TestBed.inject(LocalStorageService);
		const fiveETools = TestBed.inject(FiveEToolsHomebrewService);
		const sheet = storage.createSheet({
			title: 'Prepared monster',
			category: 'monster',
			source: 'HB',
			data: {
				name: 'Prepared monster',
				armorClass: 14,
				maxHp: 30,
				spellSlots: [],
				spells: [],
				specialAbilities: [],
				features: [],
			},
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
