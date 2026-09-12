import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
	CompendiumBestiaryIndex,
	CompendiumBestiaryIndexQuery,
	CompendiumBestiaryMonsterIndexEntry,
	CompendiumMonster,
} from '../../models/compendium-bestiary-model';
import { CompendiumBestiaryNormalizerService } from '../compendium-bestiary-normalizer-service/compendium-bestiary-normalizer-service';

const BESTIARY_BASE_PATH = '/compendium/bestiary';

@Injectable({ providedIn: 'root' })
export class CompendiumBestiaryRepositoryService {
	private readonly http = inject(HttpClient);
	private readonly normalizer = inject(CompendiumBestiaryNormalizerService);
	private indexPromise: Promise<CompendiumBestiaryIndex> | null = null;
	private readonly sourcePromises = new Map<string, Promise<CompendiumMonster[]>>();

	getIndex(): Promise<CompendiumBestiaryIndex> {
		if (!this.indexPromise) {
			this.indexPromise = this.fetchIndex().catch((error: unknown) => {
				this.indexPromise = null;
				throw error;
			});
		}
		return this.indexPromise;
	}

	getSource(source: string): Promise<CompendiumMonster[]> {
		const normalizedSource = source.trim();
		if (!normalizedSource) return Promise.resolve([]);
		const cached = this.sourcePromises.get(normalizedSource);
		if (cached) return cached;

		const promise = this.fetchSource(normalizedSource).catch((error: unknown) => {
			this.sourcePromises.delete(normalizedSource);
			throw error;
		});
		this.sourcePromises.set(normalizedSource, promise);
		return promise;
	}

	async searchIndex(query: CompendiumBestiaryIndexQuery = {}): Promise<CompendiumBestiaryMonsterIndexEntry[]> {
		return this.normalizer.filterIndex(await this.getIndex(), query);
	}

	async getMonster(source: string, name: string): Promise<CompendiumMonster | null> {
		const monsters = await this.getSource(source);
		return monsters.find((monster) => monster.name === name) ?? null;
	}

	private async fetchIndex(): Promise<CompendiumBestiaryIndex> {
		const raw = await firstValueFrom(this.http.get<unknown>(`${BESTIARY_BASE_PATH}/index.json`));
		return this.normalizer.normalizeIndex(raw);
	}

	private async fetchSource(source: string): Promise<CompendiumMonster[]> {
		const index = await this.getIndex();
		const entry = index.sources.find((candidate) => candidate.source === source);
		if (!entry) throw new Error(`Bestiary source not found: ${source}.`);
		const raw = await firstValueFrom(this.http.get<unknown>(this.sourceUrl(entry.path)));
		return this.normalizer.normalizeBundle(raw);
	}

	private sourceUrl(path: string): string {
		if (/^https?:\/\//i.test(path) || path.startsWith('/')) return path;
		return `${BESTIARY_BASE_PATH}/${path.replace(/^\.\//, '')}`;
	}
}
