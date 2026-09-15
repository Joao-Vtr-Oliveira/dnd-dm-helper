import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
	LucideAlertCircle,
	LucideCheck,
	LucideCloudDownload,
	LucideFileUp,
	LucideLink,
	LucidePlus,
} from '@lucide/angular';
import { Router } from '@angular/router';
import { AppBackupService } from '../../services/app-backup-service/app-backup-service';
import { CampaignWorldService } from '../../services/campaign-world-service/campaign-world-service';
import {
	WorkspaceTransferService,
	type WorkspaceImportPreview,
} from '../../services/workspace-service/workspace-transfer-service';
import { validateCampaignWorld } from '../../models/campaign-world-model';

type ImportFileKind = 'backup' | 'world';
type ImportFileValidation = {
	status: 'valid' | 'invalid';
	message: string;
};

@Component({
	selector: 'app-onboarding',
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		LucideAlertCircle,
		LucideCheck,
		LucideCloudDownload,
		LucideFileUp,
		LucideLink,
		LucidePlus,
	],
	templateUrl: './onboarding.html',
})
export class OnboardingPage {
	private readonly router = inject(Router);
	private readonly transfer = inject(WorkspaceTransferService);
	private readonly backups = inject(AppBackupService);
	private readonly worlds = inject(CampaignWorldService);

	mode = signal<'start' | 'local' | 'remote' | 'import'>('start');
	name = 'Minha Campanha';
	backupUrl = '';
	worldUrl = '';
	manifestUrl = '';
	preview = signal<WorkspaceImportPreview | null>(null);
	message = signal<string | null>(null);
	loading = signal(false);
	remoteValidation = signal<'idle' | 'valid' | 'invalid'>('idle');
	backupFileValidation = signal<ImportFileValidation | null>(null);
	worldFileValidation = signal<ImportFileValidation | null>(null);

	create(): void {
		const workspace = this.transfer.createLocalWorkspace(this.name);
		this.router.navigate(['/home/encounter-builder']);
		void workspace;
	}

	async validateRemote(): Promise<void> {
		this.loading.set(true);
		this.message.set(null);
		this.remoteValidation.set('idle');
		try {
			if (this.manifestUrl.trim()) {
				const result = await this.transfer.connectManifest(this.manifestUrl.trim());
				this.name = result.manifest.name;
				this.backupUrl = result.manifest.backupUrl;
				this.worldUrl = result.manifest.worldUrl;
				this.preview.set(result.preview);
			} else {
				this.preview.set(
					await this.transfer.validateRemote(this.backupUrl.trim(), this.worldUrl.trim()),
				);
			}
			this.remoteValidation.set('valid');
		} catch (error) {
			this.message.set(
				error instanceof Error ? error.message : 'Não foi possível validar a campanha remota.',
			);
			this.remoteValidation.set('invalid');
		} finally {
			this.loading.set(false);
		}
	}

	resetRemoteValidation(): void {
		if (this.loading()) return;
		this.preview.set(null);
		this.remoteValidation.set('idle');
		this.message.set(null);
	}

	async connect(): Promise<void> {
		if (!this.preview()) return;
		this.loading.set(true);
		try {
			await this.transfer.connectRemote(
				this.name,
				this.backupUrl.trim(),
				this.worldUrl.trim(),
				this.manifestUrl.trim() || undefined,
			);
			await this.router.navigate(['/home']);
		} catch (error) {
			this.message.set(
				error instanceof Error ? error.message : 'Não foi possível conectar a campanha.',
			);
		} finally {
			this.loading.set(false);
		}
	}

	async importFiles(backupFile: File | null, worldFile: File | null): Promise<void> {
		this.message.set(null);
		if (!backupFile && !worldFile) {
			this.message.set('Escolha pelo menos um arquivo para importar.');
			return;
		}
		this.loading.set(true);
		try {
			const [backupRaw, worldRaw] = await Promise.all([
				backupFile ? this.readJson(backupFile) : Promise.resolve(null),
				worldFile ? this.readJson(worldFile) : Promise.resolve(null),
			]);
			const backupValidation = backupRaw ? this.backups.validateBackup(backupRaw) : null;
			if (backupValidation && (!backupValidation.valid || !backupValidation.backup)) {
				throw new Error(backupValidation.error ?? 'Backup inválido.');
			}
			const worldValidation = worldRaw ? this.worldsValidation(worldRaw) : null;
			if (worldValidation && !worldValidation.valid)
				throw new Error(worldValidation.error ?? 'Mundo inválido.');
			const workspace = this.transfer.createLocalWorkspace(this.name);
			this.transfer.applyImport({
				backup: backupValidation?.backup ?? null,
				world: worldValidation?.world ?? null,
				warning: null,
			});
			void workspace;
			await this.router.navigate(['/home']);
		} catch (error) {
			this.message.set(
				error instanceof Error ? error.message : 'Não foi possível importar os arquivos.',
			);
		} finally {
			this.loading.set(false);
		}
	}

	async validateImportFile(kind: ImportFileKind, file: File | null): Promise<void> {
		this.message.set(null);
		if (!file) {
			this.setImportFileValidation(kind, null);
			return;
		}

		try {
			const raw = await this.readJson(file);
			if (kind === 'backup') {
				const validation = this.backups.validateBackup(raw);
				if (validation.valid) {
					this.setImportFileValidation(kind, { status: 'valid', message: 'Backup V2 válido.' });
					return;
				}
				this.setImportFileValidation(kind, {
					status: 'invalid',
					message: validateCampaignWorld(raw).valid
						? 'Este é um arquivo de Mundo. Selecione-o no campo Arquivo de Mundo.'
						: (validation.error ?? 'Este arquivo não é um Backup V2 válido.'),
				});
				return;
			}

			const validation = this.worldsValidation(raw);
			if (validation.valid) {
				this.setImportFileValidation(kind, {
					status: 'valid',
					message: 'Arquivo de Mundo válido.',
				});
				return;
			}
			this.setImportFileValidation(kind, {
				status: 'invalid',
				message: this.backups.validateBackup(raw).valid
					? 'Este é um Backup V2. Selecione-o no campo Arquivo de Backup.'
					: (validation.error ?? 'Este arquivo de Mundo não é válido.'),
			});
		} catch (error) {
			this.setImportFileValidation(kind, {
				status: 'invalid',
				message: error instanceof Error ? error.message : 'Não foi possível ler o arquivo.',
			});
		}
	}

	hasInvalidImportSelection(): boolean {
		return (
			this.backupFileValidation()?.status === 'invalid' ||
			this.worldFileValidation()?.status === 'invalid'
		);
	}

	private worldsValidation(raw: unknown) {
		return validateCampaignWorld(raw);
	}

	private setImportFileValidation(
		kind: ImportFileKind,
		validation: ImportFileValidation | null,
	): void {
		if (kind === 'backup') this.backupFileValidation.set(validation);
		else this.worldFileValidation.set(validation);
	}

	private async readJson(file: File): Promise<unknown> {
		try {
			return JSON.parse(await file.text());
		} catch {
			throw new Error(`${file.name} não contém JSON válido.`);
		}
	}
}
