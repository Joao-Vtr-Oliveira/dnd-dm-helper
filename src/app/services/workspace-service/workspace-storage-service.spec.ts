import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import { WorkspaceService } from './workspace-service';
import { workspaceStorageKey, WorkspaceStorageService } from './workspace-storage-service';

describe('WorkspaceStorageService', () => {
	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
	});

	it('uses the legacy key when no workspace is active', () => {
		const storage = TestBed.inject(WorkspaceStorageService);

		storage.setItem(APP_STORAGE_KEYS.sheets, 'legacy');

		expect(localStorage.getItem(APP_STORAGE_KEYS.sheets)).toBe('legacy');
		expect(storage.getItem(APP_STORAGE_KEYS.sheets)).toBe('legacy');
	});

	it('isolates reads and writes between active workspaces', () => {
		const workspaces = TestBed.inject(WorkspaceService);
		const storage = TestBed.inject(WorkspaceStorageService);
		const first = workspaces.createWorkspace('Primeira');
		storage.setItem(APP_STORAGE_KEYS.sheets, 'first');
		const second = workspaces.createWorkspace('Segunda');

		expect(storage.getItem(APP_STORAGE_KEYS.sheets)).toBeNull();
		storage.setItem(APP_STORAGE_KEYS.sheets, 'second');
		workspaces.activate(first.id);

		expect(storage.getItem(APP_STORAGE_KEYS.sheets)).toBe('first');
		expect(localStorage.getItem(workspaceStorageKey(second.id, APP_STORAGE_KEYS.sheets))).toBe('second');
	});

	it('keeps contextual preparation, filters, position, and battles isolated', () => {
		const workspaces = TestBed.inject(WorkspaceService);
		const storage = TestBed.inject(WorkspaceStorageService);
		const first = workspaces.createWorkspace('Primeira');
		for (const [key, value] of [
			[APP_STORAGE_KEYS.sheets, 'sheet-first'],
			[APP_STORAGE_KEYS.encounters, 'encounter-first'],
			[APP_STORAGE_KEYS.encounterHubFilters, 'filters-first'],
			[APP_STORAGE_KEYS.campaignContext, 'context-first'],
			[APP_STORAGE_KEYS.battleEncounters, 'battle-first'],
		] as const) storage.setItem(key, value);
		const second = workspaces.createWorkspace('Segunda');
		for (const [key, value] of [
			[APP_STORAGE_KEYS.sheets, 'sheet-second'],
			[APP_STORAGE_KEYS.encounters, 'encounter-second'],
			[APP_STORAGE_KEYS.encounterHubFilters, 'filters-second'],
			[APP_STORAGE_KEYS.campaignContext, 'context-second'],
			[APP_STORAGE_KEYS.battleEncounters, 'battle-second'],
		] as const) storage.setItem(key, value);

		workspaces.activate(first.id);
		expect(storage.getItem(APP_STORAGE_KEYS.sheets)).toBe('sheet-first');
		expect(storage.getItem(APP_STORAGE_KEYS.encounters)).toBe('encounter-first');
		expect(storage.getItem(APP_STORAGE_KEYS.encounterHubFilters)).toBe('filters-first');
		expect(storage.getItem(APP_STORAGE_KEYS.campaignContext)).toBe('context-first');
		expect(storage.getItem(APP_STORAGE_KEYS.battleEncounters)).toBe('battle-first');
		workspaces.activate(second.id);
		expect(storage.getItem(APP_STORAGE_KEYS.sheets)).toBe('sheet-second');
	});

	it('does not rewrite or mark a workspace changed for an unchanged value', () => {
		const workspaces = TestBed.inject(WorkspaceService);
		const storage = TestBed.inject(WorkspaceStorageService);
		const workspace = workspaces.createWorkspace('Campanha');
		const before = workspaces.activeWorkspace()?.updatedAt;

		storage.setItem(APP_STORAGE_KEYS.sheets, 'same');
		const afterFirstWrite = workspaces.activeWorkspace()?.updatedAt;
		storage.setItem(APP_STORAGE_KEYS.sheets, 'same');

		expect(afterFirstWrite).toBeGreaterThanOrEqual(before ?? 0);
		expect(workspaces.activeWorkspace()?.updatedAt).toBe(afterFirstWrite);
		expect(storage.getItemForWorkspace(workspace.id, APP_STORAGE_KEYS.sheets)).toBe('same');
	});
});
