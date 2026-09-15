import { Injectable, computed, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
	APP_PRIMARY_STORAGE_KEYS,
	APP_STORAGE_KEYS,
} from '../../constants/app-storage-keys';
import type { Workspace, WorkspaceRegistry } from '../../models/workspace-model';
import { workspaceStorageKey } from './workspace-storage-key';
import legacyCampaignWorld from '../../../../rpg_files/campaign-world.json';
import { validateCampaignWorld } from '../../models/campaign-world-model';

export const WORKSPACE_REGISTRY_KEY = 'dnd-dm-helper.workspaces.v1';

const EMPTY_REGISTRY: WorkspaceRegistry = {
	schemaVersion: 1,
	activeWorkspaceId: null,
	workspaces: [],
	legacyMigrationCompleted: false,
};

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
	private readonly registry = signal<WorkspaceRegistry>(this.loadRegistry());
	readonly workspaces = computed(() => this.registry().workspaces);
	readonly activeWorkspace = computed(() => {
		const activeWorkspaceId = this.registry().activeWorkspaceId;
		return this.registry().workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
	});

	initialize(): void {
		if (!this.registry().legacyMigrationCompleted) this.migrateLegacyCampaign();
	}

	createWorkspace(name: string, remote?: Workspace['remote']): Workspace {
		const now = Date.now();
		const workspace: Workspace = {
			id: globalThis.crypto?.randomUUID?.() ?? `workspace-${now}`,
			name: name.trim() || 'Nova Campanha',
			type: remote?.backupUrl || remote?.worldUrl ? 'remote' : 'local',
			createdAt: now,
			updatedAt: now,
			...(remote ? { remote } : {}),
		};
		this.updateRegistry({
			...this.registry(),
			activeWorkspaceId: workspace.id,
			workspaces: [...this.registry().workspaces, workspace],
		});
		return workspace;
	}

	activate(workspaceId: string): boolean {
		if (!this.registry().workspaces.some((workspace) => workspace.id === workspaceId)) return false;
		this.updateRegistry({ ...this.registry(), activeWorkspaceId: workspaceId });
		return true;
	}

	rename(workspaceId: string, name: string): boolean {
		const normalizedName = name.trim();
		if (!normalizedName) return false;
		this.updateWorkspace(workspaceId, (workspace) => ({ ...workspace, name: normalizedName }));
		return true;
	}

	configureRemote(workspaceId: string, remote: Workspace['remote']): void {
		this.updateWorkspace(workspaceId, (workspace) => ({
			...workspace,
			type: remote?.backupUrl || remote?.worldUrl ? 'remote' : 'local',
			remote,
		}));
	}

	markActiveWorkspaceChanged(): void {
		const active = this.activeWorkspace();
		if (!active) return;
		this.updateWorkspace(active.id, (workspace) => ({ ...workspace, updatedAt: Date.now() }));
	}

	markActiveWorkspaceSynced(): void {
		const active = this.activeWorkspace();
		if (!active) return;
		this.updateWorkspace(active.id, (workspace) => ({
			...workspace,
			updatedAt: Date.now(),
			lastSyncedAt: Date.now(),
		}));
	}

	hasLocalChanges(workspace: Workspace): boolean {
		return !!workspace.updatedAt && (!workspace.lastSyncedAt || workspace.updatedAt > workspace.lastSyncedAt);
	}

	remove(workspaceId: string): void {
		const workspaceKeys: string[] = [];
		const prefix = `dnd-dm-helper.workspace:${workspaceId}:`;
		for (let index = 0; index < localStorage.length; index += 1) {
			const key = localStorage.key(index);
			if (key?.startsWith(prefix)) workspaceKeys.push(key);
		}
		for (const key of workspaceKeys) localStorage.removeItem(key);
		const workspaces = this.registry().workspaces.filter((workspace) => workspace.id !== workspaceId);
		this.updateRegistry({
			...this.registry(),
			workspaces,
			activeWorkspaceId:
				this.registry().activeWorkspaceId === workspaceId ? (workspaces[0]?.id ?? null) : this.registry().activeWorkspaceId,
		});
	}

	private migrateLegacyCampaign(): void {
		const hasLegacyData = APP_PRIMARY_STORAGE_KEYS.some((key) => localStorage.getItem(key) !== null);
		if (!hasLegacyData) {
			this.updateRegistry({ ...this.registry(), legacyMigrationCompleted: true });
			return;
		}

		const workspace = this.createWorkspace('Campanha Principal', {
			backupUrl: environment.defaultSyncBackupUrl,
			worldUrl: environment.defaultSyncWorldUrl,
		});
		for (const key of APP_PRIMARY_STORAGE_KEYS) {
			const value = localStorage.getItem(key);
			if (value !== null) localStorage.setItem(workspaceStorageKey(workspace.id, key), value);
		}
		const legacyWorld = validateCampaignWorld(legacyCampaignWorld);
		if (legacyWorld.valid && legacyWorld.world) {
			localStorage.setItem(
				workspaceStorageKey(workspace.id, APP_STORAGE_KEYS.campaignWorld),
				JSON.stringify(legacyWorld.world),
			);
		}
		const safetyBackup = localStorage.getItem(APP_STORAGE_KEYS.safetyBackupBeforeSync);
		if (safetyBackup !== null) {
			localStorage.setItem(workspaceStorageKey(workspace.id, APP_STORAGE_KEYS.safetyBackupBeforeSync), safetyBackup);
		}
		this.updateRegistry({ ...this.registry(), legacyMigrationCompleted: true });
	}

	private updateWorkspace(workspaceId: string, updater: (workspace: Workspace) => Workspace): void {
		this.updateRegistry({
			...this.registry(),
			workspaces: this.registry().workspaces.map((workspace) =>
				workspace.id === workspaceId ? updater(workspace) : workspace,
			),
		});
	}

	private loadRegistry(): WorkspaceRegistry {
		try {
			const raw = localStorage.getItem(WORKSPACE_REGISTRY_KEY);
			if (!raw) return structuredClone(EMPTY_REGISTRY);
			const parsed = JSON.parse(raw) as Partial<WorkspaceRegistry>;
			if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.workspaces)) return structuredClone(EMPTY_REGISTRY);
			const workspaces = parsed.workspaces.filter(
				(workspace): workspace is Workspace =>
					!!workspace &&
					typeof workspace.id === 'string' &&
					typeof workspace.name === 'string' &&
					(workspace.type === 'local' || workspace.type === 'remote') &&
					typeof workspace.createdAt === 'number',
			);
			return {
				schemaVersion: 1,
				activeWorkspaceId:
					typeof parsed.activeWorkspaceId === 'string' && workspaces.some((item) => item.id === parsed.activeWorkspaceId)
						? parsed.activeWorkspaceId
						: null,
				workspaces,
				legacyMigrationCompleted: parsed.legacyMigrationCompleted === true,
			};
		} catch {
			return structuredClone(EMPTY_REGISTRY);
		}
	}

	private updateRegistry(registry: WorkspaceRegistry): void {
		this.registry.set(registry);
		localStorage.setItem(WORKSPACE_REGISTRY_KEY, JSON.stringify(registry));
	}
}
