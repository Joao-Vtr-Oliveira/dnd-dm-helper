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
	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			providers: [
				provideZonelessChangeDetection(),
				WorkspaceService,
				WorkspaceTransferService,
				{
					provide: CampaignWorldService,
					useValue: { saveWorld: jasmine.createSpy('saveWorld') },
				},
				{
					provide: AppBackupService,
					useValue: { applyBackup: jasmine.createSpy('applyBackup') },
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
});
