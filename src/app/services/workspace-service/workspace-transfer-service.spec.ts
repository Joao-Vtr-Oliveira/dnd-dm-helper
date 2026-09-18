import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppBackupService } from '../app-backup-service/app-backup-service';
import { CampaignWorldService } from '../campaign-world-service/campaign-world-service';
import { WorkspaceTransferService } from './workspace-transfer-service';
import {
	CAMPAIGN_WORLD_BOOTSTRAP_VERSION,
	WorkspaceService,
} from './workspace-service';

describe('WorkspaceTransferService', () => {
	let backupMock: {
		applyBackup: jasmine.Spy;
		fetchBackup: jasmine.Spy;
		createSafetyBackupBeforeSync: jasmine.Spy;
	};
	let worldMock: {
		saveWorld: jasmine.Spy;
		fetchRemoteWorld: jasmine.Spy;
		createSafetyBackup: jasmine.Spy;
	};

	beforeEach(() => {
		localStorage.clear();
		backupMock = {
			applyBackup: jasmine.createSpy('applyBackup'),
			fetchBackup: jasmine.createSpy('fetchBackup'),
			createSafetyBackupBeforeSync: jasmine.createSpy('createSafetyBackupBeforeSync'),
		};
		worldMock = {
			saveWorld: jasmine.createSpy('saveWorld'),
			fetchRemoteWorld: jasmine.createSpy('fetchRemoteWorld'),
			createSafetyBackup: jasmine.createSpy('createSafetyBackup'),
		};
		TestBed.configureTestingModule({
			providers: [
				provideZonelessChangeDetection(),
				WorkspaceService,
				WorkspaceTransferService,
				{
					provide: CampaignWorldService,
					useValue: worldMock,
				},
				{
					provide: AppBackupService,
					useValue: backupMock,
				},
			],
		});
	});

	it('keeps an explicitly created local workspace empty', () => {
		const transfer = TestBed.inject(WorkspaceTransferService);
		const worldService = TestBed.inject(CampaignWorldService);

		const workspace = transfer.createLocalWorkspace('Nova Campanha');

		expect(workspace.campaignWorldBootstrapVersion).toBe(CAMPAIGN_WORLD_BOOTSTRAP_VERSION);
		expect((worldService.saveWorld as jasmine.Spy).calls.mostRecent().args[0]).toEqual(
			jasmine.objectContaining({
				empires: [],
				states: [],
				settlements: [],
				organizations: [],
				pointsOfInterest: [],
			}),
		);
	});

	it('creates safety backups before applying a paired world and backup import', () => {
		const transfer = TestBed.inject(WorkspaceTransferService);
		const backup = { data: { campaignContext: { currentLocation: null } } } as never;
		const world = { empires: [], states: [], settlements: [], organizations: [], pointsOfInterest: [] } as never;

		transfer.applyImport({ backup, world, warning: null });

		expect(worldMock.createSafetyBackup).toHaveBeenCalledBefore(worldMock.saveWorld);
		expect(backupMock.createSafetyBackupBeforeSync).toHaveBeenCalledBefore(backupMock.applyBackup);
		expect(worldMock.saveWorld).toHaveBeenCalledWith(world);
		expect(backupMock.applyBackup).toHaveBeenCalledWith(backup);
	});

	it('validates the remote backup and world as a paired preview', async () => {
		const transfer = TestBed.inject(WorkspaceTransferService);
		const backup = { data: { campaignContext: { currentLocation: { scopeType: 'settlement', scopeId: 'missing' } } } } as never;
		const world = { empires: [], states: [], settlements: [], organizations: [], pointsOfInterest: [] } as never;
		backupMock.fetchBackup.and.resolveTo(backup);
		worldMock.fetchRemoteWorld.and.resolveTo(world);

		const preview = await transfer.validateRemote('https://example.com/backup.json', 'https://example.com/world.json');

		expect(preview.backup).toBe(backup);
		expect(preview.world).toBe(world);
		expect(preview.warning).toContain('não existe');
		expect(backupMock.fetchBackup).toHaveBeenCalledWith('https://example.com/backup.json');
		expect(worldMock.fetchRemoteWorld).toHaveBeenCalledWith('https://example.com/world.json');
	});

	it('does not apply a sync result after the active workspace changes during fetch', async () => {
		const transfer = TestBed.inject(WorkspaceTransferService);
		const workspaces = TestBed.inject(WorkspaceService);
		let releaseBackup!: (value: unknown) => void;
		const pendingBackup = new Promise((resolve) => {
			releaseBackup = resolve;
		});
		backupMock.fetchBackup.and.returnValue(pendingBackup);
		worldMock.fetchRemoteWorld.and.resolveTo({
			empires: [], states: [], settlements: [], organizations: [], pointsOfInterest: [],
		});
		const first = workspaces.createWorkspace('Primeira', { backupUrl: 'https://example.com/backup.json', worldUrl: 'https://example.com/world.json' });
		const syncing = transfer.syncActiveWorkspace();
		workspaces.createWorkspace('Segunda');
		releaseBackup({ data: { campaignContext: { currentLocation: null } } });

		await expectAsync(syncing).toBeRejectedWithError(
			'A campanha ativa mudou durante a sincronização. Nenhum dado foi importado.',
		);
		expect(backupMock.applyBackup).not.toHaveBeenCalled();
		expect(worldMock.saveWorld).not.toHaveBeenCalled();
		expect(workspaces.activeWorkspace()?.id).not.toBe(first.id);
	});
});
