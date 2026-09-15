import { Injectable, inject } from '@angular/core';
import type { AppBackup } from '../app-backup-service/app-backup-service';
import { AppBackupService } from '../app-backup-service/app-backup-service';
import { CampaignWorldService } from '../campaign-world-service/campaign-world-service';
import type { CampaignWorld } from '../../models/campaign-world-model';
import type { Workspace, WorkspaceManifest } from '../../models/workspace-model';
import {
	isWorkspaceRemoteUrl,
	normalizeWorkspaceRemoteUrl,
	validateWorkspaceManifest,
} from '../../models/workspace-model';
import { createEmptyBackupV2, createEmptyCampaignWorld } from './workspace-factory';
import { WorkspaceService } from './workspace-service';

export interface WorkspaceImportPreview {
	backup: AppBackup | null;
	world: CampaignWorld | null;
	warning: string | null;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceTransferService {
	private readonly workspaces = inject(WorkspaceService);
	private readonly backups = inject(AppBackupService);
	private readonly worlds = inject(CampaignWorldService);

	createLocalWorkspace(name: string): Workspace {
		const workspace = this.workspaces.createWorkspace(name);
		const world = createEmptyCampaignWorld();
		this.worlds.saveWorld(world);
		this.backups.applyBackup(createEmptyBackupV2(world));
		return workspace;
	}

	async validateRemote(backupUrl: string, worldUrl: string): Promise<WorkspaceImportPreview> {
		const [backup, world] = await Promise.all([
			this.validateBackupUrl(backupUrl),
			this.validateWorldUrl(worldUrl),
		]);
		return { backup, world, warning: this.locationWarning(backup, world) };
	}

	async validateBackupUrl(backupUrl: string): Promise<AppBackup> {
		const normalizedUrl = normalizeWorkspaceRemoteUrl(backupUrl);
		if (!isWorkspaceRemoteUrl(normalizedUrl)) {
			throw new Error('Informe uma URL HTTP(S) pública e válida para o Backup.');
		}
		return this.backups.fetchBackup(normalizedUrl);
	}

	async validateWorldUrl(worldUrl: string): Promise<CampaignWorld> {
		const normalizedUrl = normalizeWorkspaceRemoteUrl(worldUrl);
		if (!isWorkspaceRemoteUrl(normalizedUrl)) {
			throw new Error('Informe uma URL HTTP(S) pública e válida para o Mundo.');
		}
		return this.worlds.fetchRemoteWorld(normalizedUrl);
	}

	connectRemote(
		name: string,
		backupUrl: string,
		worldUrl: string,
		manifestUrl?: string,
	): Promise<Workspace> {
		const normalizedBackupUrl = normalizeWorkspaceRemoteUrl(backupUrl);
		const normalizedWorldUrl = normalizeWorkspaceRemoteUrl(worldUrl);
		const normalizedManifestUrl = manifestUrl
			? normalizeWorkspaceRemoteUrl(manifestUrl)
			: undefined;
		return this.validateRemote(normalizedBackupUrl, normalizedWorldUrl).then((preview) => {
			const workspace = this.workspaces.createWorkspace(name, {
				backupUrl: normalizedBackupUrl,
				worldUrl: normalizedWorldUrl,
				...(normalizedManifestUrl ? { manifestUrl: normalizedManifestUrl } : {}),
			});
			this.worlds.saveWorld(preview.world!);
			this.backups.applyBackup(preview.backup!);
			this.workspaces.markActiveWorkspaceSynced();
			return workspace;
		});
	}

	async connectManifest(
		manifestUrl: string,
	): Promise<{ manifest: WorkspaceManifest; preview: WorkspaceImportPreview }> {
		const normalizedManifestUrl = normalizeWorkspaceRemoteUrl(manifestUrl);
		if (!isWorkspaceRemoteUrl(normalizedManifestUrl)) {
			throw new Error('Informe uma URL HTTP(S) pública e válida para o workspace.');
		}
		let response: Response;
		try {
			response = await fetch(normalizedManifestUrl, {
				headers: { Accept: 'application/json' },
				cache: 'no-store',
			});
		} catch {
			throw new Error('Não foi possível acessar o workspace remoto.');
		}
		if (!response.ok) throw new Error(`O workspace remoto retornou ${response.status}.`);
		const validation = validateWorkspaceManifest(await response.json());
		if (!validation.valid || !validation.manifest)
			throw new Error(validation.error ?? 'Workspace inválido.');
		return {
			manifest: validation.manifest,
			preview: await this.validateRemote(
				validation.manifest.backupUrl,
				validation.manifest.worldUrl,
			),
		};
	}

	applyImport(preview: WorkspaceImportPreview): void {
		if (preview.world) {
			this.worlds.createSafetyBackup();
			this.worlds.saveWorld(preview.world);
		}
		if (preview.backup) {
			this.backups.createSafetyBackupBeforeSync();
			this.backups.applyBackup(preview.backup);
		}
	}

	async syncActiveWorkspace(): Promise<WorkspaceImportPreview> {
		const workspace = this.workspaces.activeWorkspace();
		if (!workspace?.remote?.backupUrl || !workspace.remote.worldUrl) {
			throw new Error('Esta campanha ainda não possui sincronização remota configurada.');
		}
		const preview = await this.validateRemote(
			workspace.remote.backupUrl,
			workspace.remote.worldUrl,
		);
		this.applyImport(preview);
		this.workspaces.markActiveWorkspaceSynced();
		return preview;
	}

	private locationWarning(backup: AppBackup, world: CampaignWorld): string | null {
		const location = backup.data.campaignContext?.currentLocation;
		if (!location) return null;
		const ids = new Set([
			...world.empires.map((item) => item.id),
			...world.states.map((item) => item.id),
			...world.settlements.map((item) => item.id),
		]);
		return ids.has(location.scopeId)
			? null
			: 'A posição atual da party não existe no mundo importado e poderá ser corrigida depois.';
	}
}
