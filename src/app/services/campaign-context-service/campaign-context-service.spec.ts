import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import { CampaignContextService } from './campaign-context-service';

const WORLD = {
	schemaVersion: 1,
	empires: [{ id: 'mornk', name: 'Mornk', aliases: [], sourcePath: 'Mornk.md' }],
	states: [{ id: 'nagazav', name: 'Nagazav', empireId: 'mornk', aliases: [], sourcePath: 'Nagazav.md' }],
	settlements: [{ id: 'nagawoods', name: 'Nagawoods', stateId: 'nagazav', settlementType: 'village', aliases: [], sourcePath: 'Nagawoods.md' }],
	organizations: [],
} as const;

describe('CampaignContextService', () => {
	let service: CampaignContextService;
	let http: HttpTestingController;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
		});
		service = TestBed.inject(CampaignContextService);
		http = TestBed.inject(HttpTestingController);
		http.expectOne('/rpg_files/campaign-world.json').flush(WORLD);
	});

	afterEach(() => http.verify());

	it('starts without a location and persists each geographic level', () => {
		expect(service.currentLocationRef()).toBeNull();
		service.setCurrentLocation({ scopeType: 'empire', scopeId: 'mornk' });
		expect(service.currentEmpire()?.name).toBe('Mornk');
		service.setCurrentLocation({ scopeType: 'state', scopeId: 'nagazav' });
		expect(service.currentState()?.name).toBe('Nagazav');
		service.setCurrentLocation({ scopeType: 'settlement', scopeId: 'nagawoods' });
		expect(service.currentSettlement()?.name).toBe('Nagawoods');
		expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEYS.campaignContext) ?? '{}')).toEqual({ currentLocation: { scopeType: 'settlement', scopeId: 'nagawoods' } });
	});

	it('clears the stored location', () => {
		service.setCurrentLocation({ scopeType: 'empire', scopeId: 'mornk' });
		service.clearCurrentLocation();
		expect(service.currentLocationRef()).toBeNull();
		expect(localStorage.getItem(APP_STORAGE_KEYS.campaignContext)).toBeNull();
	});

	it('treats corrupt and invalid stored data as undefined', () => {
		localStorage.setItem(APP_STORAGE_KEYS.campaignContext, '{bad');
		service.reloadFromStorage();
		expect(service.currentLocationRef()).toBeNull();
		localStorage.setItem(APP_STORAGE_KEYS.campaignContext, JSON.stringify({ currentLocation: { scopeType: 'world', scopeId: 'mornk' } }));
		service.reloadFromStorage();
		expect(service.currentLocationRef()).toBeNull();
	});

	it('preserves a removed reference and exposes a recoverable error', () => {
		service.setCurrentLocation({ scopeType: 'settlement', scopeId: 'old-village' });
		expect(service.currentLocationRef()).toEqual({ scopeType: 'settlement', scopeId: 'old-village' });
		expect(service.resolvedCurrentLocation()).toBeNull();
		expect(service.locationError()).toContain('não encontrada');
	});

	it('restores supplied state without needing a reload', () => {
		service.restore({ currentLocation: { scopeType: 'settlement', scopeId: 'nagawoods' } });
		expect(service.resolvedCurrentLocation()?.breadcrumb).toEqual(['Mornk', 'Nagazav', 'Nagawoods']);
		service.restore(null);
		expect(service.currentLocationRef()).toBeNull();
	});
});
