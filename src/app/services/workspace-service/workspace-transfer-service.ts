import { Injectable, inject } from '@angular/core';
import type { AppBackup } from '../app-backup-service/app-backup-service';
import { AppBackupService } from '../app-backup-service/app-backup-service';
import { CampaignWorldService } from '../campaign-world-service/campaign-world-service';
import type { CampaignWorld } from '../../models/campaign-world-model';
import type { Workspace, WorkspaceManifest } from '../../models/workspace-model';
import { isWorkspaceRemoteUrl, validateWorkspaceManifest } from '../../models/workspace-model';
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
		if (!isWorkspaceRemoteUrl(backupUrl) || !isWorkspaceRemoteUrl(worldUrl)) {
			throw new Error('Informe URLs HTTP(S) públicas e válidas para Backup e Mundo.');
		}
		const [backup, world] = await Promise.all([
			this.backups.fetchBackup(backupUrl),
			this.worlds.fetchRemoteWorld(worldUrl),
		]);
		return { backup, world, warning: this.locationWarning(backup, world) };
	}

	connectRemote(name: string, backupUrl: string, worldUrl: string, manifestUrl?: string): Promise<Workspace> {
		return this.validateRemote(backupUrl, worldUrl).then((preview) => {
			const workspace = this.workspaces.createWorkspace(name, { backupUrl, worldUrl, manifestUrl });
			this.worlds.saveWorld(preview.world!);
			this.backups.applyBackup(preview.backup!);
			this.workspaces.markActiveWorkspaceSynced();
			return workspace;
		});
	}

	async connectManifest(manifestUrl: string): Promise<{ manifest: WorkspaceManifest; preview: WorkspaceImportPreview }> {
		if (!isWorkspaceRemoteUrl(manifestUrl)) {
			throw new Error('Informe uma URL HTTP(S) pública e válida para o workspace.');
		}
		let response: Response;
		try {
			response = await fetch(manifestUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' });
		} catch {
			throw new Error('Não foi possível acessar o workspace remoto.');
		}
		if (!response.ok) throw new Error(`O workspace remoto retornou ${response.status}.`);
		const validation = validateWorkspaceManifest(await response.json());
		if (!validation.valid || !validation.manifest) throw new Error(validation.error ?? 'Workspace inválido.');
		return { manifest: validation.manifest, preview: await this.validateRemote(validation.manifest.backupUrl, validation.manifest.worldUrl) };
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
		const preview = await this.validateRemote(workspace.remote.backupUrl, workspace.remote.worldUrl);
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
