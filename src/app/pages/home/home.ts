import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import {
	LucideArchive,
	LucideCircleAlert,
	LucideCircleCheck,
	LucideCalendarDays,
	LucideDices,
	LucideDynamicIcon,
	LucideFilePlus2,
	LucideGlobe2,
	LucideLayoutDashboard,
	LucideLibrary,
	LucideMenu,
	LucideRefreshCw,
	LucideSparkles,
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
import { WorkspaceService } from '../../services/workspace-service/workspace-service';
import { WorkspaceTransferService } from '../../services/workspace-service/workspace-transfer-service';
import { CampaignWorldService } from '../../services/campaign-world-service/campaign-world-service';
import type { CampaignWorld } from '../../models/campaign-world-model';

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
	action: 'sync';
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
	world?: CampaignWorld;
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
	private readonly workspaces = inject(WorkspaceService);
	private readonly transfers = inject(WorkspaceTransferService);
	private readonly campaignWorld = inject(CampaignWorldService);
	readonly activeWorkspace = this.workspaces.activeWorkspace;
	readonly canSync = computed(() => {
		const remote = this.activeWorkspace()?.remote;
		return !!remote?.backupUrl && !!remote.worldUrl;
	});

	dmCalendarEnabled = environment.showDmCalendar;
	syncLoading = signal(false);
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
			label: 'Compêndio',
			hint: 'Referências oficiais locais, somente leitura.',
			links: [
				{
					label: 'Bestiário',
					description: 'Consultar monstros oficiais e preparar encontros.',
					icon: LucideLibrary,
					path: '/home/compendium/bestiary',
				},
				{
					label: 'Magias',
					description: 'Consultar magias oficiais por fonte, nível e escola.',
					icon: LucideSparkles,
					path: '/home/compendium/spells',
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
			],
			links: [
				{
					label: 'Workspaces',
					description: 'Trocar campanha, exportar dados e configurar sincronização.',
					icon: LucideArchive,
					path: '/home/workspaces',
				},
			],
		},
	];

	constructor() {
		if (!this.workspaces.activeWorkspace() && this.hasUnmigratedLocalData())
			void this.prepareLegacyDataRestore();
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
			this.syncPreview.set({ backup, summary: this.appBackupService.buildSummary(backup) });
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
		if (action === 'sync') await this.prepareSync();
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
			if (preview.world) {
				this.campaignWorld.createSafetyBackup();
				this.campaignWorld.saveWorld(preview.world);
			}
			this.appBackupService.applyBackup(preview.backup);
			if (preview.world) this.workspaces.markActiveWorkspaceSynced();
			this.syncPreview.set(null);
			this.showToast('success', 'Sincronização concluída');
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
		const workspace = this.workspaces.activeWorkspace();
		if (!workspace?.remote?.backupUrl || !workspace.remote.worldUrl) {
			this.showToast(
				'error',
				'Configure as URLs de Backup e Mundo neste workspace antes de sincronizar.',
			);
			return;
		}
		this.syncLoading.set(true);
		this.syncPreview.set(null);

		try {
			const remote = await this.transfers.validateRemote(
				workspace.remote.backupUrl,
				workspace.remote.worldUrl,
			);
			this.syncPreview.set({
				backup: remote.backup!,
				world: remote.world!,
				summary: this.appBackupService.buildSummary(remote.backup!, remote.world!),
			});
		} catch (error) {
			this.showToast('error', this.getErrorMessage(error, 'Erro ao sincronizar.'));
		} finally {
			this.syncLoading.set(false);
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
