import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import { LocalStorageService } from '../local-storage-service/local-storage-service';
import { HomebrewSheetImportService } from './homebrew-sheet-import-service';

describe('HomebrewSheetImportService', () => {
	let service: HomebrewSheetImportService;
	let storage: LocalStorageService;

	const creature = (overrides: Record<string, unknown> = {}) => ({
		name: 'Zhang Huang',
		maxHp: 108,
		armorClass: 17,
		spellSlots: [{ level: 1, max: 2 }],
		spells: [{ id: 'fire', name: 'Fire Bolt', level: 0, uses: 2 }],
		specialAbilities: [{ id: 'ability-1', name: 'Comando', recoveryType: 'manual' }],
		features: [{ id: 'feature-1', name: 'Tática', kind: 'trait' }],
		rawFiveETools: { name: 'Zhang Huang', source: 'Notion' },
		fiveEToolsIdentity: { name: 'Zhang Huang', source: 'Notion' },
		...overrides,
	});

	const payload = (sheets: unknown[]) => ({
		app: 'dnd-dm-helper',
		type: 'homebrew-sheets',
		schemaVersion: 2,
		exportedAt: '2026-09-07T00:00:00.000Z',
		sheets,
	});

	const sheet = (overrides: Record<string, unknown> = {}) => ({
		externalId: 'npc-zhang-huang',
		title: 'Zhang Huang',
		category: 'npc',
		tags: ['AI-generated'],
		source: 'Notion',
		data: creature(),
		...overrides,
	});

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			providers: [provideZonelessChangeDetection(), provideHttpClient()],
		});
		service = TestBed.inject(HomebrewSheetImportService);
		storage = TestBed.inject(LocalStorageService);
	});

	it('accepts the current schema and preserves canonical creature data', () => {
		const current = service.prepareImport(payload([sheet()]));

		expect(current.format).toBe('current');
		expect(current.candidates).toHaveSize(1);

		service.apply(current);
		const saved = storage.listSheets()[0];
		expect(saved.externalId).toBe('npc-zhang-huang');
		expect(saved.data.specialAbilities[0].name).toBe('Comando');
		expect(saved.data.features[0].name).toBe('Tática');
		expect(saved.data.spells[0].name).toBe('Fire Bolt');
		expect(saved.data.spellSlots[0].max).toBe(2);
		expect(saved.data.rawFiveETools?.source).toBe('Notion');
		expect('category' in saved.data).toBeFalse();
	});

	it('rejects invalid JSON, complete backups, and invalid rows without partial row writes', () => {
		expect(() => service.parseText('{')).toThrowError(/JSON inválido/);
		expect(() =>
			service.prepareImport({
				app: 'dnd-dm-helper',
				type: 'campaign-backup',
				schemaVersion: 1,
				data: { homebrewSheets: [] },
			}),
		).toThrowError(/importador de backup/);

		const preview = service.prepareImport(
			payload([sheet(), sheet({ title: '', data: creature({ name: '' }) })]),
		);
		expect(preview.candidates).toHaveSize(1);
		expect(preview.invalid).toHaveSize(1);
		service.apply(preview);
		expect(storage.listSheets()).toHaveSize(1);
		expect(() => service.prepareImport({ ...payload([]), schemaVersion: 1 })).toThrowError(
			/incompatível/,
		);
	});

	it('resolves externalId and normalized name conflicts as replace, keep, and duplicate', () => {
		const existing = storage.createSheet({
			title: 'Zhang Huang',
			category: 'npc',
			source: 'Notion',
			externalId: 'npc-zhang-huang',
			data: creature({ name: 'Zhang Huang' }) as any,
		});

		const replacePreview = service.prepareImport(
			payload([sheet({ data: creature({ name: 'Zhang Novo' }) })]),
		);
		expect(replacePreview.conflicts[0].matchedBy).toBe('externalId');
		service.apply(replacePreview);
		expect(storage.listSheets()[0].id).toBe(existing.id);
		expect(storage.listSheets()[0].data.name).toBe('Zhang Novo');

		const namePreview = service.prepareImport(
			payload([
				sheet({
					externalId: 'different',
					title: 'Zhang Huang',
					source: 'NOTION',
					data: creature({ name: 'Zhang Novo' }),
				}),
			]),
		);
		expect(namePreview.conflicts[0].matchedBy).toBe('name');
		service.apply(namePreview, { [namePreview.candidates[0].index]: 'keep-existing' });
		expect(storage.listSheets()).toHaveSize(1);

		const copyPreview = service.prepareImport(
			payload([sheet({ data: creature({ name: 'Zhang Novo' }) })]),
		);
		service.apply(copyPreview, { [copyPreview.candidates[0].index]: 'duplicate' });
		expect(storage.listSheets()).toHaveSize(2);
		expect(new Set(storage.listSheets().map((item) => item.externalId)).size).toBe(2);
	});

	it('round-trips an exported sheet without losing relevant data', () => {
		const preview = service.prepareImport(payload([sheet()]));
		service.apply(preview);
		const saved = storage.listSheets()[0];
		const roundTrip = service.prepareImport(
			payload([
				{
					externalId: saved.externalId,
					title: saved.title,
					category: saved.category,
					tags: saved.tags,
					source: saved.source,
					data: saved.data,
				},
			]),
		);

		expect(roundTrip.invalid).toHaveSize(0);
		expect(roundTrip.candidates[0].data.specialAbilities[0].name).toBe('Comando');
		expect(roundTrip.candidates[0].data.rawFiveETools?.source).toBe('Notion');
	});

	it('does not write when a batch is cancelled by the caller', () => {
		const before = JSON.stringify(storage.listSheets());
		const preview = service.prepareImport(payload([sheet()]));
		void preview;
		expect(JSON.stringify(storage.listSheets())).toBe(before);
		expect(localStorage.getItem(APP_STORAGE_KEYS.sheets)).toBeNull();
	});
});
