import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import { WorkspaceService } from './workspace-service';
import { workspaceStorageKey } from './workspace-storage-key';

describe('WorkspaceService', () => {
	beforeEach(() => localStorage.clear());

	it('keeps a clean browser without a default campaign', () => {
		const service = new WorkspaceService();
		service.initialize();

		expect(service.workspaces()).toEqual([]);
		expect(service.activeWorkspace()).toBeNull();
	});

	it('creates isolated workspace identities', () => {
		const service = new WorkspaceService();
		const first = service.createWorkspace('Primeira');
		localStorage.setItem(workspaceStorageKey(first.id, APP_STORAGE_KEYS.sheets), JSON.stringify([{ id: 'a' }]));
		const second = service.createWorkspace('Segunda');

		expect(service.activeWorkspace()?.id).toBe(second.id);
		expect(localStorage.getItem(workspaceStorageKey(second.id, APP_STORAGE_KEYS.sheets))).toBeNull();
		expect(localStorage.getItem(workspaceStorageKey(first.id, APP_STORAGE_KEYS.sheets))).toContain('"a"');
	});

	it('migrates detectable legacy data once into Campanha Principal', () => {
		localStorage.setItem(APP_STORAGE_KEYS.encounters, '[]');
		const service = new WorkspaceService();
		service.initialize();
		const workspace = service.activeWorkspace();

		expect(workspace?.name).toBe('Campanha Principal');
		expect(localStorage.getItem(workspaceStorageKey(workspace!.id, APP_STORAGE_KEYS.encounters))).toBe('[]');
		service.initialize();
		expect(service.workspaces()).toHaveSize(1);
	});
});
