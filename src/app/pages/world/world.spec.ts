import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import { CampaignContextService } from '../../services/campaign-context-service/campaign-context-service';
import { WorldPage } from './world';

const WORLD = {
	schemaVersion: 1,
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
	],
	organizations: [
		{
			id: 'local',
			name: 'Conselho Local',
			organizationType: 'group',
			aliases: [],
			sourcePath: 'Local.md',
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
			organizationIds: ['local'],
		},
	],
} as const;

describe('WorldPage', () => {
	let component: WorldPage;
	let fixture: ComponentFixture<WorldPage>;
	let context: CampaignContextService;
	let http: HttpTestingController;

	async function createPage(currentLocation?: {
		scopeType: 'empire' | 'state' | 'settlement';
		scopeId: string;
	}) {
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
		http.expectOne('/rpg_files/campaign-world.json').flush(WORLD);
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
		expect(fixture.nativeElement.textContent).not.toContain('Organizações');
	});

	it('opens at the current party location when it is valid', async () => {
		await createPage({ scopeType: 'settlement', scopeId: 'nagawoods' });
		expect(component.selectedLocation()).toEqual({ scopeType: 'settlement', scopeId: 'nagawoods' });
		expect(fixture.nativeElement.textContent).toContain('Party atualmente aqui');
		expect(fixture.nativeElement.textContent).toContain('The Bluefin');
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
	});
});
