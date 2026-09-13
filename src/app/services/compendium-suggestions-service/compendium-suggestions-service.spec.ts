import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CompendiumSuggestionsService } from './compendium-suggestions-service';

describe('CompendiumSuggestionsService', () => {
	let service: CompendiumSuggestionsService;
	let http: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
		});
		service = TestBed.inject(CompendiumSuggestionsService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	it('loads and caches schema 2 structured suggestions', async () => {
		const features = service.getMonsterFeatures();
		const feats = service.getFeats();
		http.expectOne('/compendium/suggestions.json').flush({
			schema: 2,
			skills: ['Stealth'],
			languages: ['Common'],
			senses: ['Darkvision'],
			conditions: ['Poisoned'],
			monsterFeatures: [
				{ name: 'Pack Tactics', effect: 'Gain advantage.', example: 'Kobold', hasNumberParam: true },
			],
			feats: [{ name: 'Actor', source: 'PHB', page: 165, entries: ['Mimicry.'] }],
		});

		expect(await features).toEqual([
			{ name: 'Pack Tactics', effect: 'Gain advantage.', example: 'Kobold', hasNumberParam: true },
		]);
		expect(await feats).toEqual([{ name: 'Actor', source: 'PHB', page: 165, entries: ['Mimicry.'] }]);
		expect(await service.getFeats()).toEqual([{ name: 'Actor', source: 'PHB', page: 165, entries: ['Mimicry.'] }]);
	});

	it('rejects malformed structured suggestions', async () => {
		const features = service.getMonsterFeatures();
		http.expectOne('/compendium/suggestions.json').flush({
			schema: 2,
			skills: [],
			languages: [],
			senses: [],
			conditions: [],
			monsterFeatures: [{ name: 'Pack Tactics', effect: 'Gain advantage.' }],
			feats: [],
		});

		await expectAsync(features).toBeRejectedWithError('Suggestions catalog has invalid monsterFeatures.');
	});
});
