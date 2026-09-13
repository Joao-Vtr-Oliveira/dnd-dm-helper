import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
	CompendiumSpell,
	CompendiumSpellIndex,
	CompendiumSpellIndexQuery,
	CompendiumSpellListEntry,
} from '../../models/compendium-spell-model';
import { CompendiumSpellNormalizerService } from '../compendium-spell-normalizer-service/compendium-spell-normalizer-service';

const SPELLS_BASE_PATH = '/compendium/spells';

@Injectable({ providedIn: 'root' })
export class CompendiumSpellRepositoryService {
	private readonly http = inject(HttpClient);
	private readonly normalizer = inject(CompendiumSpellNormalizerService);
	private indexPromise: Promise<CompendiumSpellIndex> | null = null;
	private readonly sourcePromises = new Map<string, Promise<CompendiumSpell[]>>();

	getIndex(): Promise<CompendiumSpellIndex> {
		if (!this.indexPromise)
			this.indexPromise = this.fetchIndex().catch((error: unknown) => {
				this.indexPromise = null;
				throw error;
			});
		return this.indexPromise;
	}

	getSource(source: string): Promise<CompendiumSpell[]> {
		const key = source.trim();
		if (!key) return Promise.resolve([]);
		const cached = this.sourcePromises.get(key);
		if (cached) return cached;
		const promise = this.fetchSource(key).catch((error: unknown) => {
			this.sourcePromises.delete(key);
			throw error;
		});
		this.sourcePromises.set(key, promise);
		return promise;
	}

	async searchIndex(query: CompendiumSpellIndexQuery = {}): Promise<CompendiumSpellListEntry[]> {
		return this.normalizer.filterIndex(await this.getIndex(), query);
	}
	async getSpell(source: string, name: string): Promise<CompendiumSpell | null> {
		return (
			(await this.getSource(source)).find(
				(spell) => spell.name === name && spell.source === source,
			) ?? null
		);
	}

	private async fetchIndex() {
		return this.normalizer.normalizeIndex(
			await firstValueFrom(this.http.get<unknown>(`${SPELLS_BASE_PATH}/index.json`)),
		);
	}
	private async fetchSource(source: string) {
		const entry = (await this.getIndex()).sources.find((candidate) => candidate.source === source);
		if (!entry) throw new Error(`Spell source not found: ${source}.`);
		return this.normalizer.normalizeBundle(
			await firstValueFrom(
				this.http.get<unknown>(`${SPELLS_BASE_PATH}/${entry.path.replace(/^\.\//, '')}`),
			),
		);
	}
}
