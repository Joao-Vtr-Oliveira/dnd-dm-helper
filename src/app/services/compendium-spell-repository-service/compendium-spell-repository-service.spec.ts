import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CompendiumSpellRepositoryService } from './compendium-spell-repository-service';

describe('CompendiumSpellRepositoryService', () => {
	let service: CompendiumSpellRepositoryService;
	let http: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideZonelessChangeDetection(),
				provideHttpClient(),
				provideHttpClientTesting(),
			],
		});
		service = TestBed.inject(CompendiumSpellRepositoryService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	it('caches index and source bundles while resolving spells by name and exact source', async () => {
		const indexFirst = service.getIndex();
		expect(service.getIndex()).toBe(indexFirst);
		http.expectOne('/compendium/spells/index.json').flush({
			sources: [{ s: 'PHB', f: 'sources/PHB.json', c: 1 }],
			spells: [{ i: 'PHB:fireball', n: 'Fireball', s: 'PHB', l: 3, h: 'V' }],
		});
		await indexFirst;
		expect(await service.searchIndex({ search: 'fire' })).toHaveSize(1);

		const sourceFirst = service.getSource('PHB');
		expect(service.getSource('PHB')).toBe(sourceFirst);
		await Promise.resolve();
		http.expectOne('/compendium/spells/sources/PHB.json').flush({
			spells: [
				{
					name: 'Fireball',
					source: 'PHB',
					level: 3,
					school: 'V',
					time: [{ number: 1, unit: 'action' }],
					range: {},
					components: {},
					duration: [{ type: 'instant' }],
					entries: ['Fire.'],
				},
			],
		});
		expect((await service.getSpell('PHB', 'Fireball'))?.source).toBe('PHB');
	});
});
