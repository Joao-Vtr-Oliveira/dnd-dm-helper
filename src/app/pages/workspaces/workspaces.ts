import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideDatabaseArrowDown, LucideFileDown, LucideGlobe2 } from '@lucide/angular';
import { Router } from '@angular/router';
import { AppBackupService } from '../../services/app-backup-service/app-backup-service';
import { CampaignWorldService } from '../../services/campaign-world-service/campaign-world-service';
import { WorkspaceService } from '../../services/workspace-service/workspace-service';
import { WorkspaceTransferService } from '../../services/workspace-service/workspace-transfer-service';
import { validateCampaignWorld } from '../../models/campaign-world-model';
import { DialogFocusDirective } from '../../directives/dialog-focus';

@Component({
	selector: 'app-workspaces',
	standalone: true,
	imports: [
		CommonModule,
		DialogFocusDirective,
		FormsModule,
		LucideDatabaseArrowDown,
		LucideFileDown,
		LucideGlobe2,
	],
	templateUrl: './workspaces.html',
})
export class WorkspacesPage {
	readonly workspaces = inject(WorkspaceService);
	private readonly transfer = inject(WorkspaceTransferService);
	private readonly backups = inject(AppBackupService);
	private readonly worlds = inject(CampaignWorldService);
	private readonly router = inject(Router);
	newName = '';
	remoteBackupUrl = this.workspaces.activeWorkspace()?.remote?.backupUrl ?? '';
	remoteWorldUrl = this.workspaces.activeWorkspace()?.remote?.worldUrl ?? '';
	message = signal<string | null>(null);
	busy = signal(false);
	removeConfirmationOpen = signal(false);

	create(): void {
		const workspace = this.transfer.createLocalWorkspace(this.newName || 'Nova Campanha');
		this.newName = '';
		this.reload(workspace.id);
	}

	switchTo(workspaceId: string): void {
		if (!this.workspaces.activate(workspaceId)) return;
		this.reload(workspaceId);
	}

	rename(name: string): void {
		const workspace = this.workspaces.activeWorkspace();
		if (workspace) this.workspaces.rename(workspace.id, name);
	}

	requestRemoveActive(): void {
		if (this.workspaces.activeWorkspace()) this.removeConfirmationOpen.set(true);
	}

	cancelRemoveActive(): void {
		this.removeConfirmationOpen.set(false);
	}

	confirmRemoveActive(): void {
		const workspace = this.workspaces.activeWorkspace();
		if (!workspace) return;
		this.removeConfirmationOpen.set(false);
		this.workspaces.remove(workspace.id);
		if (!this.workspaces.activeWorkspace()) {
			void this.router.navigate(['/onboarding']);
			return;
		}
		this.reload(this.workspaces.activeWorkspace()!.id);
	}

	exportBackup(): void {
		this.backups.downloadBackup();
	}

	exportWorld(): void {
		const world = this.worlds.world();
		if (world) this.download('campaign-world.json', world);
	}

	exportManifest(): void {
		const workspace = this.workspaces.activeWorkspace();
		if (!workspace?.remote?.backupUrl || !workspace.remote.worldUrl) {
			this.message.set('Configure as URLs de Backup e Mundo antes de exportar o workspace.json.');
			return;
		}
		this.download('workspace.json', {
			schemaVersion: 1,
			name: workspace.name,
			backupUrl: workspace.remote.backupUrl,
			worldUrl: workspace.remote.worldUrl,
			id: workspace.id,
		});
	}

	async saveRemote(): Promise<void> {
		const workspace = this.workspaces.activeWorkspace();
		if (!workspace) return;
		this.busy.set(true);
		this.message.set(null);
		try {
			await this.transfer.validateRemote(this.remoteBackupUrl.trim(), this.remoteWorldUrl.trim());
			this.workspaces.configureRemote(workspace.id, {
				backupUrl: this.remoteBackupUrl.trim(),
				worldUrl: this.remoteWorldUrl.trim(),
			});
			this.message.set('Sincronização remota configurada.');
		} catch (error) {
			this.message.set(
				error instanceof Error ? error.message : 'Não foi possível validar as URLs.',
			);
		} finally {
			this.busy.set(false);
		}
	}

	async sync(): Promise<void> {
		const workspace = this.workspaces.activeWorkspace();
		if (
			!workspace ||
			!confirm('A sincronização substituirá Backup e Mundo locais desta campanha. Continuar?')
		)
			return;
		this.busy.set(true);
		try {
			await this.transfer.syncActiveWorkspace();
			this.message.set('Backup e Mundo atualizados com sucesso.');
		} catch (error) {
			this.message.set(error instanceof Error ? error.message : 'Não foi possível sincronizar.');
		} finally {
			this.busy.set(false);
		}
	}

	async importFiles(backupFile: File | null, worldFile: File | null): Promise<void> {
		if (!backupFile && !worldFile) return;
		this.busy.set(true);
		try {
			const [backupRaw, worldRaw] = await Promise.all([
				backupFile ? this.readJson(backupFile) : Promise.resolve(null),
				worldFile ? this.readJson(worldFile) : Promise.resolve(null),
			]);
			const backup = backupRaw ? this.backups.validateBackup(backupRaw) : null;
			const world = worldRaw ? validateCampaignWorld(worldRaw) : null;
			if (backup && (!backup.valid || !backup.backup))
				throw new Error(backup.error ?? 'Backup inválido.');
			if (world && (!world.valid || !world.world))
				throw new Error(world.error ?? 'Mundo inválido.');
			this.transfer.applyImport({
				backup: backup?.backup ?? null,
				world: world?.world ?? null,
				warning: null,
			});
			this.message.set('Arquivos importados neste workspace.');
		} catch (error) {
			this.message.set(
				error instanceof Error ? error.message : 'Não foi possível importar os arquivos.',
			);
		} finally {
			this.busy.set(false);
		}
	}

	private reload(workspaceId: string): void {
		void workspaceId;
		window.location.assign('/home/workspaces');
	}

	private download(name: string, value: unknown): void {
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
		);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = name;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	private async readJson(file: File): Promise<unknown> {
		try {
			return JSON.parse(await file.text());
		} catch {
			throw new Error(`${file.name} não contém JSON válido.`);
		}
	}
}
