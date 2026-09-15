import { Injectable, inject } from '@angular/core';
import { WorkspaceService } from './workspace-service';
import { workspaceStorageKey } from './workspace-storage-key';

export { workspaceStorageKey } from './workspace-storage-key';

@Injectable({ providedIn: 'root' })
export class WorkspaceStorageService {
	private readonly workspaces = inject(WorkspaceService);

	getItem(key: string): string | null {
		const workspace = this.workspaces.activeWorkspace();
		return localStorage.getItem(workspace ? workspaceStorageKey(workspace.id, key) : key);
	}

	setItem(key: string, value: string): void {
		const workspace = this.workspaces.activeWorkspace();
		const storageKey = workspace ? workspaceStorageKey(workspace.id, key) : key;
		if (localStorage.getItem(storageKey) === value) return;
		localStorage.setItem(storageKey, value);
		if (workspace) this.workspaces.markActiveWorkspaceChanged();
	}

	removeItem(key: string): void {
		const workspace = this.workspaces.activeWorkspace();
		const storageKey = workspace ? workspaceStorageKey(workspace.id, key) : key;
		if (localStorage.getItem(storageKey) === null) return;
		localStorage.removeItem(storageKey);
		if (workspace) this.workspaces.markActiveWorkspaceChanged();
	}

	getItemForWorkspace(workspaceId: string, key: string): string | null {
		return localStorage.getItem(workspaceStorageKey(workspaceId, key));
	}

	setItemForWorkspace(workspaceId: string, key: string, value: string): void {
		localStorage.setItem(workspaceStorageKey(workspaceId, key), value);
	}
}
