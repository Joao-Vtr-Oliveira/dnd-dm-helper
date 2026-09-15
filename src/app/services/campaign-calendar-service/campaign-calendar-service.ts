import { Injectable, computed, inject } from '@angular/core';
import { CampaignWorldService } from '../campaign-world-service/campaign-world-service';
import { createEmptyCampaignWorld } from '../workspace-service/workspace-factory';
import { WorkspaceService } from '../workspace-service/workspace-service';
import legacyCampaignWorld from '../../../../rpg_files/campaign-world.json';
import type { CampaignCalendar } from '../../models/calendar-model';

@Injectable({ providedIn: 'root' })
export class CampaignCalendarService {
	private readonly campaignWorld = inject(CampaignWorldService);
	private readonly workspaces = inject(WorkspaceService);
	readonly calendar = computed(() =>
		this.campaignWorld.world()?.calendar ??
		(this.workspaces.activeWorkspace()
			? createEmptyCampaignWorld().calendar
			: (legacyCampaignWorld.calendar as CampaignCalendar)),
	);
}
