import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CampaignWorld } from '../../models/campaign-world-model';
import { CampaignWorldService } from './campaign-world-service';

const VALID_WORLD: CampaignWorld = {
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
	empires: [{ id: 'mornk', name: 'Mornk', aliases: [], sourcePath: 'Mornk.md' }],
	states: [
		{ id: 'nagazav', name: 'Nagazav', empireId: 'mornk', aliases: [], sourcePath: 'Nagazav.md' },
	],
	settlements: [
		{
			id: 'nagawoods',
			name: 'Nagawoods',
			stateId: 'nagazav',
			settlementType: 'village',
			aliases: [],
			sourcePath: 'Nagawoods.md',
		},
	],
	organizations: [
		{
			id: 'guild',
			name: 'Guild',
			organizationType: 'guild',
			aliases: [],
			sourcePath: 'Guild.md',
			presence: [
				{ scopeType: 'global', presenceType: 'network' },
				{ scopeType: 'settlement', scopeId: 'nagawoods', presenceType: 'agent' },
			],
		},
	],
	pointsOfInterest: [
		{
			id: 'guildhall',
			name: 'Guild Hall',
			settlementId: 'nagawoods',
			poiType: 'organization',
			aliases: ['Guild meeting'],
			summary: 'A local guild meeting place.',
			sourcePath: 'Guild Hall.md',
			organizationIds: ['guild'],
		},
	],
};

describe('CampaignWorldService', () => {
	let service: CampaignWorldService;
	let http: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideZonelessChangeDetection(),
				provideHttpClient(),
				provideHttpClientTesting(),
			],
		});
		service = TestBed.inject(CampaignWorldService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	function load(world: unknown = VALID_WORLD) {
		http.expectOne('/rpg_files/campaign-world.json').flush(world as object);
	}

	it('starts loading and exposes the validated world when ready', () => {
		expect(service.status()).toBe('loading');
		load();
		expect(service.status()).toBe('ready');
		expect(service.world()).toEqual(VALID_WORLD);
	});

	it('handles HTTP and invalid catalog errors safely', () => {
		const request = http.expectOne('/rpg_files/campaign-world.json');
		request.flush('not found', { status: 404, statusText: 'Not found' });
		expect(service.status()).toBe('error');
		expect(service.error()).toContain('Não foi possível carregar');

		service.load();
		http.expectOne('/rpg_files/campaign-world.json').flush({ schemaVersion: 2 });
		expect(service.status()).toBe('error');
		expect(service.error()).toContain('incompatível');
	});

	it('rejects invalid calendar configuration', () => {
		load({
			...VALID_WORLD,
			calendar: {
				...VALID_WORLD.calendar,
				events: [
					{
						id: 'invalid-event',
						season: 'spring',
						day: 31,
						title: 'Evento inválido',
						description: 'Não pode ocorrer fora da estação.',
					},
				],
			},
		});
		expect(service.status()).toBe('error');
		expect(service.error()).toContain('evento inválido');
	});

	it('rejects duplicate IDs and broken geographic references', () => {
		load({ ...VALID_WORLD, empires: [...VALID_WORLD.empires, VALID_WORLD.empires[0]] });
		expect(service.status()).toBe('error');
		expect(service.error()).toContain('duplicado');

		service.load();
		http.expectOne('/rpg_files/campaign-world.json').flush({
			...VALID_WORLD,
			states: [{ ...VALID_WORLD.states[0], empireId: 'missing' }],
		});
		expect(service.status()).toBe('error');
		expect(service.error()).toContain('inexistente');
	});

	it('rejects invalid organization parent and presence scopes', () => {
		load({
			...VALID_WORLD,
			organizations: [{ ...VALID_WORLD.organizations[0], parentOrganizationId: 'missing' }],
		});
		expect(service.status()).toBe('error');

		service.load();
		http.expectOne('/rpg_files/campaign-world.json').flush({
			...VALID_WORLD,
			organizations: [
				{
					...VALID_WORLD.organizations[0],
					presence: [{ scopeType: 'state', presenceType: 'agent' }],
				},
			],
		});
		expect(service.status()).toBe('error');
	});

	it('rejects invalid points of interest and their references', () => {
		load({
			...VALID_WORLD,
			pointsOfInterest: [{ ...VALID_WORLD.pointsOfInterest[0], poiType: 'invalid' }],
		});
		expect(service.status()).toBe('error');

		service.load();
		http.expectOne('/rpg_files/campaign-world.json').flush({
			...VALID_WORLD,
			pointsOfInterest: [...VALID_WORLD.pointsOfInterest, VALID_WORLD.pointsOfInterest[0]],
		});
		expect(service.error()).toContain('duplicado');

		service.load();
		http.expectOne('/rpg_files/campaign-world.json').flush({
			...VALID_WORLD,
			pointsOfInterest: [{ ...VALID_WORLD.pointsOfInterest[0], settlementId: 'missing' }],
		});
		expect(service.error()).toContain('localidade inexistente');

		service.load();
		http.expectOne('/rpg_files/campaign-world.json').flush({
			...VALID_WORLD,
			pointsOfInterest: [{ ...VALID_WORLD.pointsOfInterest[0], organizationIds: ['missing'] }],
		});
		expect(service.error()).toContain('organização inexistente');
	});

	it('indexes geographic entities, organizations, and points of interest', () => {
		load();
		expect(service.getEmpire('mornk')?.name).toBe('Mornk');
		expect(service.getState('nagazav')?.name).toBe('Nagazav');
		expect(service.getSettlement('nagawoods')?.name).toBe('Nagawoods');
		expect(service.getOrganization('guild')?.name).toBe('Guild');
		expect(service.getPointOfInterest('guildhall')?.name).toBe('Guild Hall');
		expect(service.getStatesByEmpire('mornk')).toHaveSize(1);
		expect(service.getSettlementsByState('nagazav')).toHaveSize(1);
		expect(service.getPointsOfInterestBySettlement('nagawoods')).toHaveSize(1);
		expect(
			service.getOrganizationsByScope({ scopeType: 'settlement', scopeId: 'nagawoods' }),
		).toHaveSize(1);
	});

	it('resolves every supported location level and unknown IDs safely', () => {
		load();
		expect(
			service.resolveLocation({ scopeType: 'settlement', scopeId: 'nagawoods' })?.breadcrumb,
		).toEqual(['Mornk', 'Nagazav', 'Nagawoods']);
		expect(service.resolveLocation({ scopeType: 'state', scopeId: 'nagazav' })?.breadcrumb).toEqual(
			['Mornk', 'Nagazav'],
		);
		expect(service.resolveLocation({ scopeType: 'empire', scopeId: 'mornk' })?.breadcrumb).toEqual([
			'Mornk',
		]);
		expect(service.resolveLocation({ scopeType: 'settlement', scopeId: 'missing' })).toBeNull();
	});

	it('resolves saved locations by their name or alias and returns the catalog ID', () => {
		load({
			...VALID_WORLD,
			settlements: [
				{ ...VALID_WORLD.settlements[0], id: 'nagawoods-village', aliases: ['Bosque Naga'] },
			],
			organizations: [],
			pointsOfInterest: [],
		});

		expect(service.resolveLocation({ scopeType: 'settlement', scopeId: 'Nagawoods' })?.ref).toEqual({
			scopeType: 'settlement',
			scopeId: 'nagawoods-village',
		});
		expect(service.resolveLocation({ scopeType: 'settlement', scopeId: 'bosque naga' })?.ref).toEqual({
			scopeType: 'settlement',
			scopeId: 'nagawoods-village',
		});
	});

	it('searches names and aliases without matching technical IDs', () => {
		load({
			...VALID_WORLD,
			states: [{ ...VALID_WORLD.states[0], aliases: ['Naga'] }],
		});
		expect(service.searchLocations('NAGA').map((result) => result.ref.scopeId)).toContain(
			'nagazav',
		);
		expect(service.searchLocations('nagawoods-id')).toEqual([]);
		expect(service.searchLocations('guild meeting')).toEqual([]);
		const [pointOfInterest] = service.searchPointsOfInterest('MEETING');
		expect(pointOfInterest?.pointOfInterest.id).toBe('guildhall');
		expect(pointOfInterest?.breadcrumb).toEqual(['Mornk', 'Nagazav', 'Nagawoods']);
		expect(service.searchPointsOfInterest('guildhall')).toEqual([]);
	});

	it('resolves direct and inherited organization presences once per organization', () => {
		load({
			...VALID_WORLD,
			organizations: [
				VALID_WORLD.organizations[0],
				{
					id: 'state-guild',
					name: 'State Guild',
					organizationType: 'guild',
					aliases: [],
					sourcePath: 'State.md',
					presence: [{ scopeType: 'state', scopeId: 'nagazav', presenceType: 'agent' }],
				},
			],
		});
		const organizations = service.getRelevantOrganizations({
			scopeType: 'settlement',
			scopeId: 'nagawoods',
		});
		expect(organizations).toHaveSize(2);
		expect(
			organizations.find((item) => item.organization.id === 'guild')?.directPresences,
		).toHaveSize(1);
		expect(
			organizations.find((item) => item.organization.id === 'guild')?.broaderPresences,
		).toHaveSize(1);
		expect(
			organizations.find((item) => item.organization.id === 'state-guild')?.broaderPresences,
		).toHaveSize(1);
		const stateOrganizations = service.getRelevantOrganizations({
			scopeType: 'state',
			scopeId: 'nagazav',
		});
		expect(
			stateOrganizations.find((item) => item.organization.id === 'guild')?.directPresences,
		).toEqual([]);
		expect(
			stateOrganizations.find((item) => item.organization.id === 'guild')?.broaderPresences,
		).toHaveSize(1);
	});
});
