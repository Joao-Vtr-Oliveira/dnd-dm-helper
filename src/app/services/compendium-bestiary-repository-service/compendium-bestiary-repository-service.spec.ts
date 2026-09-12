import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CompendiumBestiaryRepositoryService } from './compendium-bestiary-repository-service';

describe('CompendiumBestiaryRepositoryService', () => {
	let service: CompendiumBestiaryRepositoryService;
	let http: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
		});
		service = TestBed.inject(CompendiumBestiaryRepositoryService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	it('lazily loads and caches the index and its source bundle', async () => {
		const indexFirst = service.getIndex();
		const indexSecond = service.getIndex();
		expect(indexFirst).toBe(indexSecond);
		http.expectOne('/compendium/bestiary/index.json').flush({
			sources: [{ s: 'MM', f: 'sources/mm.json', c: 1 }],
			monsters: [{ i: 'MM:test-dragon', n: 'Test Dragon', s: 'MM', t: 'dragon', z: 'H', cr: '17' }],
		});
		expect((await indexFirst).sources).toEqual([{ source: 'MM', path: 'sources/mm.json', count: 1 }]);
		expect(await service.searchIndex({ types: ['dragon'], challengeRatings: ['17'] })).toEqual([
			jasmine.objectContaining({ id: 'MM:test-dragon' }),
		]);

		const sourceFirst = service.getSource('MM');
		const sourceSecond = service.getSource('MM');
		expect(sourceFirst).toBe(sourceSecond);
		await Promise.resolve();
		http.expectOne('/compendium/bestiary/sources/mm.json').flush({
			legendaryGroup: [{ name: 'Dragon Lair', source: 'MM', lairActions: ['Magma erupts.'] }],
			monsters: [
				{
					name: 'Test Dragon',
					source: 'MM',
					ac: [{ ac: 19 }],
					hp: { average: 200, formula: '16d20 + 32' },
					legendaryGroup: { name: 'Dragon Lair', source: 'MM' },
				},
			],
		});

		const monsters = await sourceFirst;
		expect(monsters).toHaveSize(1);
		expect(monsters[0].legendaryGroup?.lairActions).toEqual(['Magma erupts.']);
	});
});
