import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import legacyCampaignWorld from '../../../../rpg_files/campaign-world.json';
import { createEmptyCampaignWorld } from './workspace-factory';
import {
	CAMPAIGN_WORLD_BOOTSTRAP_VERSION,
	WORKSPACE_REGISTRY_KEY,
	WorkspaceService,
} from './workspace-service';
import { workspaceStorageKey } from './workspace-storage-key';
import type { Workspace } from '../../models/workspace-model';

describe('WorkspaceService', () => {
	beforeEach(() => localStorage.clear());

	it('keeps a clean browser without a default campaign', () => {
		const service = new WorkspaceService();
		service.initialize();

		expect(service.workspaces()).toEqual([]);
		expect(service.activeWorkspace()).toBeNull();
	});

	it('creates isolated workspace identities', () => {
		const service = new WorkspaceService();
		const first = service.createWorkspace('Primeira');
		localStorage.setItem(workspaceStorageKey(first.id, APP_STORAGE_KEYS.sheets), JSON.stringify([{ id: 'a' }]));
		const second = service.createWorkspace('Segunda');

		expect(service.activeWorkspace()?.id).toBe(second.id);
		expect(localStorage.getItem(workspaceStorageKey(second.id, APP_STORAGE_KEYS.sheets))).toBeNull();
		expect(localStorage.getItem(workspaceStorageKey(first.id, APP_STORAGE_KEYS.sheets))).toContain('"a"');
	});

	it('migrates detectable legacy data once into Campanha Principal', () => {
		localStorage.setItem(APP_STORAGE_KEYS.encounters, '[]');
		const service = new WorkspaceService();
		service.initialize();
		const workspace = service.activeWorkspace();

		expect(workspace?.name).toBe('Campanha Principal');
		expect(localStorage.getItem(workspaceStorageKey(workspace!.id, APP_STORAGE_KEYS.encounters))).toBe('[]');
		service.initialize();
		expect(service.workspaces()).toHaveSize(1);
	});

	it('rehydrates an empty world copied by migrateLegacyCampaign', () => {
		const emptyRaw = JSON.stringify(createEmptyCampaignWorld());
		localStorage.setItem(APP_STORAGE_KEYS.encounters, '[]');
		localStorage.setItem(APP_STORAGE_KEYS.campaignWorld, emptyRaw);

		const service = new WorkspaceService();
		service.initialize();
		const workspace = service.activeWorkspace()!;
		const worldKey = workspaceStorageKey(workspace.id, APP_STORAGE_KEYS.campaignWorld);

		expect(JSON.parse(localStorage.getItem(worldKey)!)).toEqual(legacyCampaignWorld);
		expect(localStorage.getItem(APP_STORAGE_KEYS.campaignWorld)).toBe(emptyRaw);
		expect(
			localStorage.getItem(
				workspaceStorageKey(workspace.id, APP_STORAGE_KEYS.safetyWorldBeforeBootstrap),
			),
		).toBe(emptyRaw);
		expect(service.activeWorkspace()?.campaignWorldBootstrapVersion).toBe(
			CAMPAIGN_WORLD_BOOTSTRAP_VERSION,
		);
	});

	function seedExistingWorkspace(): Workspace {
		const workspace: Workspace = {
			id: 'existing-workspace',
			name: 'Campanha Existente',
			type: 'local',
			createdAt: 1,
		};
		localStorage.setItem(
			WORKSPACE_REGISTRY_KEY,
			JSON.stringify({
				schemaVersion: 1,
				activeWorkspaceId: workspace.id,
				workspaces: [workspace],
				legacyMigrationCompleted: true,
			}),
		);
		return workspace;
	}

	it('preserves a filled campaign world during workspace bootstrap', () => {
		const workspace = seedExistingWorkspace();
		const world = structuredClone(legacyCampaignWorld);
		localStorage.setItem(
			workspaceStorageKey(workspace.id, APP_STORAGE_KEYS.campaignWorld),
			JSON.stringify(world),
		);

		const service = new WorkspaceService();
		service.initialize();

		expect(
			JSON.parse(
				localStorage.getItem(workspaceStorageKey(workspace.id, APP_STORAGE_KEYS.campaignWorld))!,
			),
		).toEqual(world);
		expect(service.activeWorkspace()?.campaignWorldBootstrapVersion).toBe(
			CAMPAIGN_WORLD_BOOTSTRAP_VERSION,
		);
	});

	it('rehydrates an existing workspace with no namespaced world from the canonical world', () => {
		const workspace = seedExistingWorkspace();
		const service = new WorkspaceService();
		service.initialize();

		expect(
			JSON.parse(
				localStorage.getItem(workspaceStorageKey(workspace.id, APP_STORAGE_KEYS.campaignWorld))!,
			),
		).toEqual(legacyCampaignWorld);
		expect(service.activeWorkspace()?.campaignWorldBootstrapVersion).toBe(
			CAMPAIGN_WORLD_BOOTSTRAP_VERSION,
		);
	});

	it('rehydrates a structurally empty existing workspace and backs it up first', () => {
		const workspace = seedExistingWorkspace();
		const emptyWorld = createEmptyCampaignWorld();
		const emptyRaw = JSON.stringify(emptyWorld);
		const worldKey = workspaceStorageKey(workspace.id, APP_STORAGE_KEYS.campaignWorld);
		localStorage.setItem(worldKey, emptyRaw);

		const service = new WorkspaceService();
		service.initialize();

		expect(JSON.parse(localStorage.getItem(worldKey)!)).toEqual(legacyCampaignWorld);
		expect(
			localStorage.getItem(
				workspaceStorageKey(workspace.id, APP_STORAGE_KEYS.safetyWorldBeforeBootstrap),
			),
		).toBe(emptyRaw);
		expect(service.activeWorkspace()?.campaignWorldBootstrapVersion).toBe(
			CAMPAIGN_WORLD_BOOTSTRAP_VERSION,
		);
	});

	it('keeps a newly created local workspace empty by its explicit bootstrap marker', () => {
		const service = new WorkspaceService();
		const workspace = service.createWorkspace('Nova Campanha');

		expect(workspace.campaignWorldBootstrapVersion).toBe(CAMPAIGN_WORLD_BOOTSTRAP_VERSION);
		expect(
			localStorage.getItem(workspaceStorageKey(workspace.id, APP_STORAGE_KEYS.campaignWorld)),
		).toBeNull();
	});

	it('repairs only incompatible organizations in a filled existing world', () => {
		const workspace = seedExistingWorkspace();
		const world = structuredClone(legacyCampaignWorld);
		const oldOrganization = {
			...world.organizations[0],
			id: 'old-family',
			name: 'Família antiga',
			organizationType: 'family',
		};
		const oldLocalCommunity = {
			...world.organizations[0],
			id: 'old-local-community',
			name: 'Comunidade antiga',
			scope: 'local' as const,
			sourcePath: 'Mundo/Impérios/Mornk/3-Nirvak/Guildas.md',
		};
		const formalLocalGuild = {
			...world.organizations[0],
			id: 'formal-local-guild',
			name: 'Guilda local formal',
			scope: 'local' as const,
			sourcePath: 'Guildas & Grupos/Guilda local formal.md',
		};
		const oldLocalSourceCommunity = {
			...world.organizations[0],
			id: 'old-local-source-community',
			name: 'Comunidade de fonte local',
			scope: 'regional' as const,
			organizationType: 'community',
			sourcePath: 'Mundo/Impérios/Mornk/3-Nirvak/Guildas.md',
		};
		world.organizations.push(oldOrganization);
		world.organizations.push(oldLocalCommunity, formalLocalGuild, oldLocalSourceCommunity);
		world.pointsOfInterest[0].organizationIds = [
			'old-family',
			'old-local-community',
			'old-local-source-community',
		];
		const raw = JSON.stringify(world);
		const worldKey = workspaceStorageKey(workspace.id, APP_STORAGE_KEYS.campaignWorld);
		localStorage.setItem(worldKey, raw);

		new WorkspaceService().initialize();

		const repaired = JSON.parse(localStorage.getItem(worldKey)!);
		expect(repaired.empires).toEqual(world.empires);
		expect(repaired.states).toEqual(world.states);
		expect(repaired.settlements).toEqual(world.settlements);
		expect(repaired.pointsOfInterest).toEqual(
			world.pointsOfInterest.map((point) => ({
				...point,
					...(point.organizationIds
						? {
								organizationIds: point.organizationIds.filter(
									(id) =>
										!['old-local-community', 'formal-local-guild', 'old-local-source-community'].includes(id),
								),
						}
					: {}),
			})),
		);
		expect(repaired.organizations).toContain(jasmine.objectContaining({ id: 'old-family' }));
		expect(repaired.organizations).not.toContain(jasmine.objectContaining({ id: 'old-local-community' }));
		expect(repaired.organizations).not.toContain(jasmine.objectContaining({ id: 'formal-local-guild' }));
		expect(repaired.organizations).not.toContain(jasmine.objectContaining({ id: 'old-local-source-community' }));
		expect(
			localStorage.getItem(
				workspaceStorageKey(workspace.id, APP_STORAGE_KEYS.safetyWorldBeforeBootstrap),
			),
		).toBe(raw);
		expect(legacyCampaignWorld.organizations).toHaveSize(13);
	});

	it('migrates legacy remote organizations before strict validation', () => {
		const legacyWorld = structuredClone(legacyCampaignWorld) as unknown as {
			organizations: Array<Record<string, unknown>>;
			pointsOfInterest: Array<Record<string, unknown>>;
		};
		legacyWorld.organizations = legacyWorld.organizations.map((organization) => {
			const { scope: _scope, ...withoutScope } = organization;
			return withoutScope;
		});
		const localCommunity = {
			...legacyWorld.organizations[0],
			id: 'legacy-local-community',
			name: 'Comunidade legada',
			sourcePath: 'Mundo/Impérios/Mornk/3-Nirvak/Guildas.md',
		};
		legacyWorld.organizations.push(localCommunity);
		legacyWorld.pointsOfInterest[0]['organizationIds'] = ['winterhold', 'legacy-local-community'];

		const migrated = new WorkspaceService().migrateCampaignWorld(legacyWorld)!;

		expect(migrated.organizations.find((item) => item.id === 'winterhold')?.scope).toBe('campaign');
		expect(migrated.organizations).not.toContain(jasmine.objectContaining({ id: 'legacy-local-community' }));
		expect(migrated.pointsOfInterest[0].organizationIds).toEqual(['winterhold']);
	});
});
