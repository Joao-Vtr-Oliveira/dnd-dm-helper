import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { environment } from '../../../environments/environment';
import {
	AppBackupService,
	type AppBackup,
	type AppBackupSummary,
} from '../../services/app-backup-service/app-backup-service';

type IconName =
	| 'layout'
	| 'calendar'
	| 'swords'
	| 'plus-square'
	| 'files'
	| 'file-pen'
	| 'refresh'
	| 'download';

type NavLink = {
	label: string;
	description: string;
	icon: IconName;
	path: string;
	exact?: boolean;
	requiresDmCalendar?: boolean;
};

type NavAction = {
	label: string;
	description: string;
	icon: IconName;
	action: 'sync' | 'export-all';
};

type NavGroup = {
	label: string;
	hint: string;
	links?: NavLink[];
	actions?: NavAction[];
};

type SyncPreviewState = {
	backup: AppBackup;
	summary: AppBackupSummary;
};

@Component({
	selector: 'app-home',
	imports: [CommonModule, RouterOutlet, RouterModule],
	templateUrl: './home.html',
})
export class Home {
	private readonly router = inject(Router);
	private readonly appBackupService = inject(AppBackupService);

	dmCalendarEnabled = environment.showDmCalendar;
	syncLoading = signal(false);
	exportLoading = signal(false);
	toast = signal<{ type: 'success' | 'error'; text: string } | null>(null);
	syncPreview = signal<SyncPreviewState | null>(null);

	private toastTimer: number | null = null;

	readonly navGroups: NavGroup[] = [
		{
			label: 'Campanha',
			hint: 'Visão geral e tempo do mundo.',
			links: [
				{
					label: 'Dashboard',
					description: 'Hub com encontros e batalhas em andamento.',
					icon: 'layout',
					path: '/home',
					exact: true,
				},
				{
					label: 'Calendário',
					description: 'Data, estação e eventos do mundo.',
					icon: 'calendar',
					path: '/home/calendar',
					requiresDmCalendar: false,
				},
			],
		},
		{
			label: 'Combates',
			hint: 'Preparar encontros e abrir a mesa rapidamente.',
			links: [
				{
					label: 'Criar Encontro',
					description: 'Montar ou editar um encounter.',
					icon: 'swords',
					path: '/home/encounter-builder',
				},
			],
		},
		{
			label: 'Fichas',
			hint: 'Biblioteca homebrew para usar e editar.',
			links: [
				{
					label: 'Fichas',
					description: 'Fichas salvas para consulta e uso rápido.',
					icon: 'files',
					path: '/home/homebrew',
				},
				{
					label: 'Criar Ficha',
					description: 'Criar ou editar uma ficha homebrew.',
					icon: 'file-pen',
					path: '/home/homebrew-builder',
				},
				{
					label: 'Arquivo 5etools',
					description: 'Editor e gerenciador do JSON homebrew 5etools.',
					icon: 'files',
					path: '/home/5etools-homebrew',
				},
			],
		},
		{
			label: 'Dados',
			hint: 'Fluxo global de backup e restauração.',
			actions: [
				{
					label: 'Sincronizar',
					description: 'Busca o backup remoto e restaura o projeto completo.',
					icon: 'refresh',
					action: 'sync',
				},
				{
					label: 'Exportar tudo',
					description: 'Baixa um JSON com todos os dados do projeto.',
					icon: 'download',
					action: 'export-all',
				},
			],
		},
	];

	constructor() {
		const postSyncToast = this.appBackupService.consumePostSyncToast();
		if (postSyncToast) {
			this.showToast('success', postSyncToast);
		}
	}

	onClickTitle() {
		this.router.navigate(['/home']);
	}

	async runAction(action: NavAction['action']) {
		if (action === 'sync') {
			await this.prepareSync();
			return;
		}

		this.exportAll();
	}

	closeSyncPreview() {
		if (this.syncLoading()) return;
		this.syncPreview.set(null);
	}

	async confirmSync() {
		const preview = this.syncPreview();
		if (!preview) return;

		this.syncLoading.set(true);
		try {
			this.appBackupService.createSafetyBackupBeforeSync();
			this.appBackupService.applyBackup(preview.backup);
			this.appBackupService.storePostSyncToast('Sincronização concluída');
			this.showToast('success', 'Sincronização concluída');
			this.syncPreview.set(null);
		} catch (error) {
			this.showToast('error', this.getErrorMessage(error, 'Erro ao sincronizar.'));
		} finally {
			this.syncLoading.set(false);
		}
	}

	formatSummaryDate(value: string | null): string {
		if (!value || Number.isNaN(Date.parse(value))) return 'Data não disponível';
		return new Intl.DateTimeFormat('pt-BR', {
			dateStyle: 'short',
			timeStyle: 'short',
		}).format(new Date(value));
	}

	iconPaths(icon: IconName): string[] {
		if (icon === 'layout') return ['M4 5h7v6H4z M13 5h7v4h-7z M13 11h7v8h-7z M4 13h7v6H4z'];
		if (icon === 'calendar')
			return [
				'M8 3v4 M16 3v4 M4 9h16 M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
			];
		if (icon === 'swords')
			return [
				'M14.5 5.5 18.5 9.5 M5.5 18.5 9.5 14.5 M11 13 4 20 M13 11 20 4 M7 4h4v4H7z M13 16h4v4h-4z',
			];
		if (icon === 'plus-square')
			return [
				'M12 8v8 M8 12h8 M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
			];
		if (icon === 'files')
			return [
				'M9 7h8 M9 12h8 M9 17h6 M6 4h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
			];
		if (icon === 'file-pen')
			return [
				'M14 4h4a1 1 0 0 1 1 1v4 M9 15l6.5-6.5 2 2L11 17l-3 1z M6 4h8l5 5v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
			];
		if (icon === 'refresh')
			return ['M20 6v6h-6 M4 18v-6h6 M7 17a8 8 0 0 0 13-5 M17 7A8 8 0 0 0 4 12'];
		return ['M12 3v12 M8 11l4 4 4-4 M5 19h14'];
	}

	private async prepareSync() {
		if (this.syncLoading()) return;
		this.syncLoading.set(true);
		this.syncPreview.set(null);

		try {
			const backup = await this.appBackupService.fetchRemoteBackup();
			this.syncPreview.set({
				backup,
				summary: this.appBackupService.buildSummary(backup),
			});
		} catch (error) {
			this.showToast('error', this.getErrorMessage(error, 'Erro ao sincronizar.'));
		} finally {
			this.syncLoading.set(false);
		}
	}

	private exportAll() {
		if (this.exportLoading()) return;
		this.exportLoading.set(true);
		try {
			this.appBackupService.downloadBackup();
			this.showToast('success', 'Backup exportado com sucesso.');
		} catch (error) {
			this.showToast('error', this.getErrorMessage(error, 'Erro ao exportar backup.'));
		} finally {
			this.exportLoading.set(false);
		}
	}

	private getErrorMessage(error: unknown, fallback: string): string {
		return error instanceof Error && error.message ? error.message : fallback;
	}

	private showToast(type: 'success' | 'error', text: string, ms = 2800) {
		if (this.toastTimer) window.clearTimeout(this.toastTimer);
		this.toast.set({ type, text });
		this.toastTimer = window.setTimeout(() => this.toast.set(null), ms);
	}
}
