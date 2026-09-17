import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import type { CampaignWorld } from '../../models/campaign-world-model';
import { CampaignContextService } from '../../services/campaign-context-service/campaign-context-service';
import { WorldPage } from './world';

const WORLD = {
	schemaVersion: 1,
	calendar: {
		daysPerSeason: 30,
		seasons: [
			{ id: 'spring', label: 'Primavera', color: '#9ae6b4' },
			{ id: 'summer', label: 'Verão', color: '#f6e05e' },
			{ id: 'autumn', label: 'Outono', color: '#f6ad55' },
			{ id: 'winter', label: 'Inverno', color: '#90cdf4' },
		],
		epochDate: { year: 1000, season: 'spring', day: 1, hour: 5, minute: 0 },
		events: [],
	},
	empires: [
		{ id: 'mornk', name: 'Mornk', aliases: [], sourcePath: 'Mornk.md' },
		{ id: 'komic', name: 'Komic', aliases: [], sourcePath: 'Komic.md' },
	],
	states: [
		{
			id: 'nagazav',
			name: 'Nagazav',
			empireId: 'mornk',
			aliases: ['Naga'],
			sourcePath: 'Nagazav.md',
		},
		{ id: 'nirvak', name: 'Nirvak', empireId: 'mornk', aliases: [], sourcePath: 'Nirvak.md' },
	],
	settlements: [
		{
			id: 'nagazav-city',
			name: 'Nagazav',
			stateId: 'nagazav',
			settlementType: 'city',
			aliases: [],
			sourcePath: 'Nagazav City.md',
		},
		{
			id: 'nagawoods',
			name: 'Nagawoods',
			stateId: 'nagazav',
			settlementType: 'village',
			aliases: ['Woods'],
			sourcePath: 'Nagawoods.md',
		},
		{
			id: 'jukes',
			name: 'Jukes',
			stateId: 'nirvak',
			settlementType: 'village',
			aliases: [],
			sourcePath: 'Jukes.md',
		},
		{
			id: 'nirvak-city',
			name: 'Nirvak',
			stateId: 'nirvak',
			settlementType: 'city',
			aliases: [],
			sourcePath: 'Nirvak City.md',
		},
	],
	organizations: [
		{
			id: 'winterhold',
			name: 'Winterhold',
			organizationType: 'guild',
			scope: 'campaign',
			aliases: [],
			sourcePath: 'Winterhold.md',
			presence: [],
		},
	],
	pointsOfInterest: [
		{
			id: 'bluefin',
			name: 'The Bluefin',
			settlementId: 'nagawoods',
			poiType: 'tavern',
			aliases: ['Bluefin'],
			summary: 'Taverna da vila.',
			sourcePath: 'Bluefin.md',
		},
		{
			id: 'old-gate',
			name: 'Old Gate',
			settlementId: 'nagawoods',
			poiType: 'landmark',
			aliases: [],
			sourcePath: 'Gate.md',
			organizationIds: ['winterhold'],
		},
	],
} as const;

describe('WorldPage', () => {
	let component: WorldPage;
	let fixture: ComponentFixture<WorldPage>;
	let context: CampaignContextService;
	let http: HttpTestingController;

	async function createPage(
		currentLocation?: {
		scopeType: 'empire' | 'state' | 'settlement';
		scopeId: string;
		},
		world: CampaignWorld = WORLD as unknown as CampaignWorld,
	) {
		if (currentLocation) {
			localStorage.setItem(APP_STORAGE_KEYS.campaignContext, JSON.stringify({ currentLocation }));
		}
		await TestBed.configureTestingModule({
			imports: [WorldPage],
			providers: [
				provideZonelessChangeDetection(),
				provideHttpClient(),
				provideHttpClientTesting(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(WorldPage);
		component = fixture.componentInstance;
		context = TestBed.inject(CampaignContextService);
		http = TestBed.inject(HttpTestingController);
		http.expectOne('/rpg_files/campaign-world.json').flush(world);
		TestBed.flushEffects();
		fixture.detectChanges();
	}

	beforeEach(() => localStorage.clear());

	afterEach(() => {
		if (http) http.verify();
	});

	it('opens at the empire root when the party has no position', async () => {
		await createPage();
		expect(component.selectedLocation()).toBeNull();
		expect(fixture.nativeElement.textContent).toContain('Impérios');
		expect(fixture.nativeElement.textContent).toContain('Organizações da campanha');
		expect(fixture.nativeElement.textContent).toContain('Winterhold');
		expect(fixture.nativeElement.textContent).not.toContain('Comunidade de Nirvak');
	});

	it('opens at the current party location when it is valid', async () => {
		await createPage({ scopeType: 'settlement', scopeId: 'nagawoods' });
		expect(component.selectedLocation()).toEqual({ scopeType: 'settlement', scopeId: 'nagawoods' });
		expect(fixture.nativeElement.textContent).toContain('Party atualmente aqui');
		expect(fixture.nativeElement.textContent).toContain('The Bluefin');
	});

	it('moves to a restored party location without reloading the page', async () => {
		await createPage();
		context.restore({ currentLocation: { scopeType: 'settlement', scopeId: 'nagawoods' } });
		TestBed.flushEffects();
		fixture.detectChanges();

		expect(component.selectedLocation()).toEqual({ scopeType: 'settlement', scopeId: 'nagawoods' });
		expect(fixture.nativeElement.textContent).toContain('Party atualmente aqui');
	});

	it('drills down through locations and navigates ancestors with breadcrumbs', async () => {
		await createPage();
		component.selectLocation({ scopeType: 'empire', scopeId: 'mornk' });
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Estados');
		component.selectLocation({ scopeType: 'state', scopeId: 'nagazav' });
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Localidades');
		expect(fixture.nativeElement.textContent).toContain('Nagawoods');
		component.selectBreadcrumb('empire', 'mornk');
		expect(component.selectedLocation()).toEqual({ scopeType: 'empire', scopeId: 'mornk' });
	});

	it('disambiguates every state and locality with the same name', async () => {
		await createPage();
		expect(component.locationLabel({ scopeType: 'state', scopeId: 'nirvak' })).toBe('Nirvak (Estado)');
		expect(component.locationLabel({ scopeType: 'settlement', scopeId: 'nirvak-city' })).toBe(
			'Nirvak (Cidade)',
		);
		component.selectLocation({ scopeType: 'settlement', scopeId: 'nirvak-city' });
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).not.toContain('Organizações nesta localidade');
		expect(fixture.nativeElement.textContent).not.toContain('Comunidade de Nirvak');
	});

	it('explores locations without moving the party', async () => {
		await createPage({ scopeType: 'settlement', scopeId: 'nagawoods' });
		component.selectLocation({ scopeType: 'settlement', scopeId: 'jukes' });
		expect(component.selectedLocation()).toEqual({ scopeType: 'settlement', scopeId: 'jukes' });
		expect(context.currentLocationRef()).toEqual({ scopeType: 'settlement', scopeId: 'nagawoods' });
	});

	it('moves the party only through an explicit geographic action', async () => {
		await createPage();
		component.selectLocation({ scopeType: 'settlement', scopeId: 'jukes' });
		component.setPartyHere();
		expect(context.currentLocationRef()).toEqual({ scopeType: 'settlement', scopeId: 'jukes' });
		component.clearPartyLocation();
		expect(context.currentLocationRef()).toBeNull();
	});

	it('searches locations and POIs without exposing technical IDs', async () => {
		await createPage();
		component.searchQuery.set('woods');
		expect(component.locationSearchResults().map((result) => result.ref.scopeId)).toEqual([
			'nagawoods',
		]);
		component.searchQuery.set('bluefin');
		expect(component.locationSearchResults()).toEqual([]);
		expect(
			component.pointOfInterestSearchResults().map((result) => result.pointOfInterest.id),
		).toEqual(['bluefin']);
		component.selectPointOfInterestSearchResult(component.pointOfInterestSearchResults()[0]);
		expect(component.selectedLocation()).toEqual({ scopeType: 'settlement', scopeId: 'nagawoods' });
		expect(component.highlightedPointOfInterestId()).toBe('bluefin');
		expect(context.currentLocationRef()).toBeNull();
	});

	it('sets a party position from the header flow without offering POIs', async () => {
		await createPage();
		component.beginPartyLocationSelection();
		component.searchQuery.set('woods');
		component.selectSearchResult(component.locationSearchResults()[0]);
		expect(context.currentLocationRef()).toEqual({ scopeType: 'settlement', scopeId: 'nagawoods' });
		expect(component.isChoosingPartyLocation()).toBeFalse();
	});

	it('shows empty states at each geographic level', async () => {
		await createPage();
		component.selectLocation({ scopeType: 'empire', scopeId: 'komic' });
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain(
			'Nenhum Estado catalogado neste Império ainda.',
		);
		expect(fixture.nativeElement.textContent).not.toContain('Organizações nesta localidade');
	});

	it('starts a contextual editor with a normalized alias', async () => {
		await createPage();
		component.selectLocation({ scopeType: 'empire', scopeId: 'mornk' });
		component.openEditor('state');
		component.onEditorNameChange('S');
		component.onEditorNameChange('São Áureo');

		expect(component.editorParentId).toBe('mornk');
		expect(component.editorAliases).toEqual(['sao aureo']);
	});

	it('commits typed aliases as distinct chips', async () => {
		await createPage();
		component.openEditor('empire');
		component.editorAliasInput = 'Vale, Costa Vale';
		component.commitAlias();

		expect(component.editorAliases).toEqual(['Vale', 'Costa']);
		expect(component.editorAliasInput).toBe('');
	});

	it('creates organizations without an implicit global presence', async () => {
		await createPage();
		expect(component.organizationTypeOptions.map((option) => option.value)).toEqual(['guild', 'group']);
		component.openEditor('organization');
		component.onEditorNameChange('Academia Prisma');
		component.editorTypeValue = 'group';
		component.saveEditor();

		const organization = component.campaignWorld
			.world()
			?.organizations.find((item) => item.name === 'Academia Prisma');
		expect(organization).toEqual(
			jasmine.objectContaining({
				organizationType: 'group',
				scope: 'campaign',
				presence: [],
			}),
		);
	});

	it('rejects an organization type outside the formal guild and group registry', async () => {
		await createPage();
		component.openEditor('organization');
		component.onEditorNameChange('Comunidade Temporária');
		component.editorTypeValue = 'community';
		component.saveEditor();

		expect(component.campaignWorld.world()?.organizations).toHaveSize(1);
		expect(component.editorMessage()).toContain('tipo válido');
	});

	it('edits and archives an organization without changing its identity or presences', async () => {
		await createPage();
		const original = component.campaignWorld.getOrganization('winterhold')!;
		component.openOrganizationEditor(original);
		component.editorName = 'Winterhold Renovado';
		component.editorTypeValue = 'guild';
		component.editorAliases = ['conselho'];
		component.saveEditor();

		const edited = component.campaignWorld.getOrganization('winterhold')!;
		expect(edited).toEqual(
			jasmine.objectContaining({
				id: 'winterhold',
				name: 'Winterhold Renovado',
				aliases: ['conselho'],
				organizationType: 'guild',
				sourcePath: 'Winterhold.md',
				presence: [],
			}),
		);

		component.toggleOrganizationArchived(edited.id);
		fixture.detectChanges();
		expect(component.archivedCampaignOrganizations().map((item) => item.id)).toEqual(['winterhold']);
		expect(fixture.nativeElement.textContent).toContain('Restaurar');

		component.toggleOrganizationArchived(edited.id);
		expect(component.campaignOrganizations().map((item) => item.id)).toEqual(['winterhold']);
	});

	it('manages global, empire, state, and settlement presences without duplicating the organization', async () => {
		await createPage();
		component.openPresenceManager('winterhold');
		component.openPresenceEditor();
		component.setPresenceScopeType('state');
		component.savePresence();
		expect(component.campaignWorld.getOrganization('winterhold')?.presence).toEqual([]);
		expect(component.editorMessage()).toContain('localização válida');
		component.cancelPresenceEditor();

		const savePresence = (
			scopeType: 'global' | 'empire' | 'state' | 'settlement',
			scopeId: string,
			presenceType: string,
			availableSheetExternalIds = '',
		) => {
			component.openPresenceEditor();
			component.setPresenceScopeType(scopeType);
			component.setPresenceScopeId(scopeId);
			component.setPresenceType(presenceType);
			component.setAvailableSheetExternalIds(availableSheetExternalIds);
			component.savePresence();
		};

		savePresence('global', '', 'network');
		savePresence('empire', 'mornk', 'headquarters');
		savePresence('state', 'nagazav', 'agent', 'archetype-c, missing-archetype');
		savePresence('settlement', 'nagawoods', 'post');

		const organization = component.campaignWorld.getOrganization('winterhold')!;
		expect(organization.presence).toEqual([
			{ scopeType: 'global', presenceType: 'network' },
			{ scopeType: 'empire', scopeId: 'mornk', presenceType: 'headquarters' },
			{
				scopeType: 'state',
				scopeId: 'nagazav',
				presenceType: 'agent',
				availableSheetExternalIds: ['archetype-c', 'missing-archetype'],
			},
			{ scopeType: 'settlement', scopeId: 'nagawoods', presenceType: 'post' },
		]);
		expect(component.campaignWorld.world()?.organizations).toHaveSize(1);
		expect(component.presenceScopeLabel(organization.presence[2])).toBe('Mornk › Nagazav (Estado)');

		component.editPresence(2);
		component.setPresenceType('regional-post');
		component.savePresence();
		expect(component.campaignWorld.getOrganization('winterhold')?.presence[2]).toEqual({
			scopeType: 'state',
			scopeId: 'nagazav',
			presenceType: 'regional-post',
			availableSheetExternalIds: ['archetype-c', 'missing-archetype'],
		});

		component.openPresenceEditor();
		component.setPresenceType('network');
		component.savePresence();
		expect(component.campaignWorld.getOrganization('winterhold')?.presence).toHaveSize(4);
		expect(component.editorMessage()).toContain('já está cadastrada');
		component.cancelPresenceEditor();

		spyOn(window, 'confirm').and.returnValue(true);
		component.removePresence(3);
		expect(component.campaignWorld.getOrganization('winterhold')?.presence).toHaveSize(3);
	});

	it('opens presences in a modal flow and restores the viewed location on close', async () => {
		await createPage();
		component.selectLocation({ scopeType: 'settlement', scopeId: 'nirvak-city' });
		component.openPresenceManager('winterhold');
		fixture.detectChanges();

		expect(component.selectedLocation()).toBeNull();
		expect(component.managingOrganizationId()).toBe('winterhold');
		expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
		component.closePresenceManager();
		expect(component.selectedLocation()).toEqual({ scopeType: 'settlement', scopeId: 'nirvak-city' });
	});

	it('keeps presences editable after the organization is archived', async () => {
		await createPage();
		component.toggleOrganizationArchived('winterhold');
		component.openPresenceManager('winterhold');
		component.openPresenceEditor();
		component.setPresenceType('remote-contact');
		component.savePresence();

		expect(component.archivedCampaignOrganizations().map((item) => item.id)).toEqual(['winterhold']);
		expect(component.campaignWorld.getOrganization('winterhold')?.presence).toEqual([
			{ scopeType: 'global', presenceType: 'remote-contact' },
		]);
	});
});
