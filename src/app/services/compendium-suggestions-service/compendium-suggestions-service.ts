import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

const SUGGESTIONS_CATALOG_PATH = '/compendium/suggestions.json';

export type CompendiumSuggestionCategory = 'skills' | 'languages' | 'senses' | 'conditions';

export interface CompendiumMonsterFeature {
	name: string;
	effect: string;
	example: string;
	hasNumberParam?: boolean;
}

export interface CompendiumFeat {
	name: string;
	source: string;
	page?: number;
	entries: readonly unknown[];
}

export interface CompendiumSuggestions {
	skills: readonly string[];
	languages: readonly string[];
	senses: readonly string[];
	conditions: readonly string[];
	monsterFeatures: readonly CompendiumMonsterFeature[];
	feats: readonly CompendiumFeat[];
}

@Injectable({ providedIn: 'root' })
export class CompendiumSuggestionsService {
	private readonly http = inject(HttpClient);
	private catalogPromise: Promise<CompendiumSuggestions> | null = null;

	getSuggestions(category: CompendiumSuggestionCategory): Promise<readonly string[]> {
		return this.getCatalog().then((catalog) => catalog[category]);
	}

	getSkills(): Promise<readonly string[]> {
		return this.getSuggestions('skills');
	}

	getLanguages(): Promise<readonly string[]> {
		return this.getSuggestions('languages');
	}

	getSenses(): Promise<readonly string[]> {
		return this.getSuggestions('senses');
	}

	getConditions(): Promise<readonly string[]> {
		return this.getSuggestions('conditions');
	}

	getMonsterFeatures(): Promise<readonly CompendiumMonsterFeature[]> {
		return this.getCatalog().then((catalog) => catalog.monsterFeatures);
	}

	getFeats(): Promise<readonly CompendiumFeat[]> {
		return this.getCatalog().then((catalog) => catalog.feats);
	}

	private getCatalog(): Promise<CompendiumSuggestions> {
		if (!this.catalogPromise)
			this.catalogPromise = this.fetchCatalog().catch((error: unknown) => {
				this.catalogPromise = null;
				throw error;
			});
		return this.catalogPromise;
	}

	private async fetchCatalog(): Promise<CompendiumSuggestions> {
		const raw = await firstValueFrom(this.http.get<unknown>(SUGGESTIONS_CATALOG_PATH));
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
			throw new Error('Suggestions catalog has an invalid schema.');
		}
		const catalog = raw as Record<string, unknown>;
		if (catalog['schema'] !== 2) throw new Error('Suggestions catalog has an invalid schema.');
		return {
			skills: this.suggestions(catalog['skills']),
			languages: this.suggestions(catalog['languages']),
			senses: this.suggestions(catalog['senses']),
			conditions: this.suggestions(catalog['conditions']),
			monsterFeatures: this.monsterFeatures(catalog['monsterFeatures']),
			feats: this.feats(catalog['feats']),
		};
	}

	private suggestions(value: unknown): readonly string[] {
		if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
			throw new Error('Suggestions catalog has invalid entries.');
		}
		return value;
	}

	private monsterFeatures(value: unknown): readonly CompendiumMonsterFeature[] {
		if (!Array.isArray(value)) throw new Error('Suggestions catalog has invalid monsterFeatures.');
		return value.map((item) => {
			if (!item || typeof item !== 'object' || Array.isArray(item)) {
				throw new Error('Suggestions catalog has invalid monsterFeatures.');
			}
			const feature = item as Record<string, unknown>;
			if (
				typeof feature['name'] !== 'string' ||
				!feature['name'].trim() ||
				typeof feature['effect'] !== 'string' ||
				!feature['effect'].trim() ||
				typeof feature['example'] !== 'string' ||
				!feature['example'].trim() ||
				(feature['hasNumberParam'] !== undefined && typeof feature['hasNumberParam'] !== 'boolean')
			) {
				throw new Error('Suggestions catalog has invalid monsterFeatures.');
			}
			return feature as unknown as CompendiumMonsterFeature;
		});
	}

	private feats(value: unknown): readonly CompendiumFeat[] {
		if (!Array.isArray(value)) throw new Error('Suggestions catalog has invalid feats.');
		return value.map((item) => {
			if (!item || typeof item !== 'object' || Array.isArray(item)) {
				throw new Error('Suggestions catalog has invalid feats.');
			}
			const feat = item as Record<string, unknown>;
			if (
				typeof feat['name'] !== 'string' ||
				!feat['name'].trim() ||
				typeof feat['source'] !== 'string' ||
				!feat['source'].trim() ||
				!Array.isArray(feat['entries']) ||
				(feat['page'] !== undefined &&
					(typeof feat['page'] !== 'number' || !Number.isFinite(feat['page']) || feat['page'] < 0))
			) {
				throw new Error('Suggestions catalog has invalid feats.');
			}
			return feat as unknown as CompendiumFeat;
		});
	}
}
