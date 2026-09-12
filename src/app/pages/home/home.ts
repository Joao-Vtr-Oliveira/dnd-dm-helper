import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import {
	LucideArchive,
	LucideCircleAlert,
	LucideCircleCheck,
	LucideCalendarDays,
	LucideDices,
	LucideDownload,
	LucideDynamicIcon,
	LucideFilePlus2,
	LucideGlobe2,
	LucideLayoutDashboard,
	LucideLibrary,
	LucideMenu,
	LucideRefreshCw,
	LucideSwords,
	LucideX,
	type LucideIcon,
} from '@lucide/angular';
import { environment } from '../../../environments/environment';
import {
	APP_LEGACY_PRIMARY_STORAGE_KEYS,
	APP_STORAGE_KEYS,
} from '../../constants/app-storage-keys';
import {
	AppBackupService,
	type AppBackup,
	type AppBackupSummary,
} from '../../services/app-backup-service/app-backup-service';
import { CampaignClock } from '../../components/campaign-clock/campaign-clock';
import { DialogFocusDirective } from '../../directives/dialog-focus';

type NavLink = {
	label: string;
	description: string;
	icon: LucideIcon;
	path: string;
	exact?: boolean;
	requiresDmCalendar?: boolean;
};

type NavAction = {
	label: string;
	description: string;
	icon: LucideIcon;
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
	imports: [
		CampaignClock,
		CommonModule,
		DialogFocusDirective,
		LucideCircleAlert,
		LucideCircleCheck,
		LucideDices,
		LucideDynamicIcon,
		LucideMenu,
		LucideX,
		RouterOutlet,
		RouterModule,
	],
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
	mobileNavigationOpen = signal(false);

	private toastTimer: number | null = null;

	readonly navGroups: NavGroup[] = [
		{
			label: 'Campanha',
			hint: 'Visão geral e tempo do mundo.',
			links: [
				{
					label: 'Dashboard',
					description: 'Hub com encontros e batalhas em andamento.',
					icon: LucideLayoutDashboard,
					path: '/home',
					exact: true,
				},
				{
					label: 'Mundo',
					description: 'Geografia, localidades e contexto da campanha.',
					icon: LucideGlobe2,
					path: '/home/world',
				},
				{
					label: 'Calendário',
					description: 'Data, estação e eventos do mundo.',
					icon: LucideCalendarDays,
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
					icon: LucideSwords,
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
					icon: LucideLibrary,
					path: '/home/homebrew',
				},
				{
					label: 'Criar Ficha',
					description: 'Criar ou editar uma ficha homebrew.',
					icon: LucideFilePlus2,
					path: '/home/homebrew-builder',
				},
				{
					label: 'Arquivo 5etools',
					description: 'Editor e gerenciador do JSON homebrew 5etools.',
					icon: LucideArchive,
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
					icon: LucideRefreshCw,
					action: 'sync',
				},
				{
					label: 'Exportar tudo',
					description: 'Baixa um JSON com todos os dados do projeto.',
					icon: LucideDownload,
					action: 'export-all',
				},
			],
		},
	];

	constructor() {
		const postSyncToast = this.appBackupService.consumePostSyncToast();
		if (postSyncToast) {
			this.showToast('success', postSyncToast);
		} else if (this.hasUnmigratedLocalData()) {
			void this.prepareLegacyDataRestore();
		}
	}

	private hasUnmigratedLocalData(): boolean {
		const hasLegacyData = APP_LEGACY_PRIMARY_STORAGE_KEYS.some((key) => localStorage.getItem(key));
		const hasCanonicalData = [APP_STORAGE_KEYS.encounters, APP_STORAGE_KEYS.sheets].some((key) =>
			localStorage.getItem(key),
		);
		return hasLegacyData && !hasCanonicalData;
	}

	private async prepareLegacyDataRestore() {
		this.syncLoading.set(true);
		try {
			const backup = await this.appBackupService.fetchRemoteBackup();
			this.syncPreview.set({
				backup,
				summary: this.appBackupService.buildSummary(backup),
			});
		} catch (error) {
			this.showToast(
				'error',
				this.getErrorMessage(error, 'Não foi possível preparar a restauração dos dados V2.'),
				7000,
			);
		} finally {
			this.syncLoading.set(false);
		}
	}

	onClickTitle() {
		this.closeMobileNavigation();
		this.router.navigate(['/home']);
	}

	toggleMobileNavigation() {
		this.mobileNavigationOpen.update((isOpen) => !isOpen);
	}

	closeMobileNavigation() {
		this.mobileNavigationOpen.set(false);
	}

	@HostListener('document:keydown.escape')
	onDocumentEscape() {
		this.closeMobileNavigation();
	}

	async runAction(action: NavAction['action']) {
		this.closeMobileNavigation();
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
			this.syncPreview.set(null);
			this.reloadPage();
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

	private reloadPage() {
		window.location.reload();
	}

	private showToast(type: 'success' | 'error', text: string, ms = 2800) {
		if (this.toastTimer) window.clearTimeout(this.toastTimer);
		this.toast.set({ type, text });
		this.toastTimer = window.setTimeout(() => this.toast.set(null), ms);
	}
}
