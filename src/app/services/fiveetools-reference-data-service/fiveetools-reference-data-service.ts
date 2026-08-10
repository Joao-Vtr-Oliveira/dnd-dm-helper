import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { FiveEToolsEntry } from '../../models/fiveetools-homebrew-model';

export type FiveEToolsReferenceSpell = {
	name: string;
	source: string;
	level: number;
	school: string;
	entries: FiveEToolsEntry[];
	entriesHigherLevel?: FiveEToolsEntry[];
	meta?: {
		ritual?: boolean;
		technomagic?: boolean;
	};
	components?: {
		v?: boolean;
		s?: boolean;
		m?: unknown;
	};
	range?: {
		type?: string;
		distance?: {
			type?: string;
			amount?: number;
		};
	};
	duration?: Array<unknown>;
	page?: number;
};

export type FiveEToolsReferenceAction = {
	kind: 'action';
	name: string;
	source: string;
	entries: FiveEToolsEntry[];
	page?: number;
	fromVariant?: string;
	time?: Array<string | { number?: number; unit?: string }>;
};

export type FiveEToolsReferenceOptionalFeature = {
	kind: 'optionalfeature';
	name: string;
	source: string;
	entries: FiveEToolsEntry[];
	page?: number;
	featureType?: string[];
	hasAdditionalSpells: boolean;
	additionalSpells?: unknown[];
};

export type FiveEToolsReferenceFeat = {
	kind: 'feat';
	name: string;
	source: string;
	entries: FiveEToolsEntry[];
	page?: number;
	category?: string;
	hasAdditionalSpells: boolean;
	additionalSpells?: unknown[];
	ability?: unknown[];
};

export type FiveEToolsReferenceItem = {
	kind: 'item';
	name: string;
	source: string;
	entries: FiveEToolsEntry[];
	page?: number;
	type?: string;
	rarity?: string;
	hasAttachedSpells: boolean;
	attachedSpells?: unknown;
};

export type FiveEToolsReferenceConditionStatus = {
	kind: 'condition' | 'status';
	name: string;
	source: string;
	entries: FiveEToolsEntry[];
	page?: number;
};

export type FiveEToolsReferenceLanguage = {
	kind: 'language';
	name: string;
	source: string;
	entries: FiveEToolsEntry[];
	page?: number;
	type?: string;
	script?: string;
	origin?: string;
};

export type FiveEToolsReferenceImportable =
	| FiveEToolsReferenceAction
	| FiveEToolsReferenceOptionalFeature
	| FiveEToolsReferenceFeat
	| FiveEToolsReferenceItem
	| FiveEToolsReferenceConditionStatus
	| FiveEToolsReferenceLanguage;

type SpellIndexResponse = Record<string, string>;
type SpellSourceResponse = { spell?: FiveEToolsReferenceSpell[] };
type ActionResponse = { action?: Array<Omit<FiveEToolsReferenceAction, 'kind'>> };
type OptionalFeatureResponse = {
	optionalfeature?: Array<Omit<FiveEToolsReferenceOptionalFeature, 'kind' | 'hasAdditionalSpells'>>;
};
type FeatResponse = { feat?: Array<Omit<FiveEToolsReferenceFeat, 'kind' | 'hasAdditionalSpells'>> };
type ItemResponse = { item?: Array<Omit<FiveEToolsReferenceItem, 'kind' | 'hasAttachedSpells'>> };
type ConditionDiseaseStatusResponse = {
	condition?: Array<Omit<FiveEToolsReferenceConditionStatus, 'kind'>>;
	status?: Array<Omit<FiveEToolsReferenceConditionStatus, 'kind'>>;
};
type LanguageResponse = { language?: Array<Omit<FiveEToolsReferenceLanguage, 'kind'>> };

const SCHOOL_LABELS: Record<string, string> = {
	A: 'Abjuration',
	C: 'Conjuration',
	D: 'Divination',
	E: 'Enchantment',
	V: 'Evocation',
	I: 'Illusion',
	N: 'Necromancy',
	T: 'Transmutation',
};

@Injectable({ providedIn: 'root' })
export class FiveEToolsReferenceDataService {
	private readonly baseUrl = environment.fiveEToolsReferenceDataBaseUrl;
	private spellIndexPromise: Promise<SpellIndexResponse> | null = null;
	private readonly spellSourceCache = new Map<string, Promise<FiveEToolsReferenceSpell[]>>();
	private actionPromise: Promise<FiveEToolsReferenceAction[]> | null = null;
	private optionalFeaturePromise: Promise<FiveEToolsReferenceOptionalFeature[]> | null = null;
	private featPromise: Promise<FiveEToolsReferenceFeat[]> | null = null;
	private itemPromise: Promise<FiveEToolsReferenceItem[]> | null = null;
	private conditionStatusPromise: Promise<FiveEToolsReferenceConditionStatus[]> | null = null;
	private languagePromise: Promise<FiveEToolsReferenceLanguage[]> | null = null;

	async listSpellSources(): Promise<string[]> {
		const index = await this.getSpellIndex();
		return Object.keys(index).sort((left, right) => left.localeCompare(right));
	}

	async getSpellsBySource(source: string): Promise<FiveEToolsReferenceSpell[]> {
		const normalizedSource = (source || '').trim().toUpperCase();
		if (!normalizedSource) return [];

		const cached = this.spellSourceCache.get(normalizedSource);
		if (cached) return cached;

		const promise = this.loadSpellsBySource(normalizedSource);
		this.spellSourceCache.set(normalizedSource, promise);
		return promise;
	}

	schoolLabel(code: string | null | undefined): string {
		if (!code) return 'Escola desconhecida';
		return SCHOOL_LABELS[code] ?? code;
	}

	spellTag(spell: Pick<FiveEToolsReferenceSpell, 'name' | 'source'>): string {
		return `{@spell ${spell.name}|${spell.source}}`;
	}

	async getActions(): Promise<FiveEToolsReferenceAction[]> {
		if (this.actionPromise) return this.actionPromise;
		this.actionPromise = this.loadActions();
		return this.actionPromise;
	}

	async getOptionalFeatures(): Promise<FiveEToolsReferenceOptionalFeature[]> {
		if (this.optionalFeaturePromise) return this.optionalFeaturePromise;
		this.optionalFeaturePromise = this.loadOptionalFeatures();
		return this.optionalFeaturePromise;
	}

	async getFeats(): Promise<FiveEToolsReferenceFeat[]> {
		if (this.featPromise) return this.featPromise;
		this.featPromise = this.loadFeats();
		return this.featPromise;
	}

	async getItems(): Promise<FiveEToolsReferenceItem[]> {
		if (this.itemPromise) return this.itemPromise;
		this.itemPromise = this.loadItems();
		return this.itemPromise;
	}

	async getConditionStatusReferences(): Promise<FiveEToolsReferenceConditionStatus[]> {
		if (this.conditionStatusPromise) return this.conditionStatusPromise;
		this.conditionStatusPromise = this.loadConditionStatusReferences();
		return this.conditionStatusPromise;
	}

	async getLanguages(): Promise<FiveEToolsReferenceLanguage[]> {
		if (this.languagePromise) return this.languagePromise;
		this.languagePromise = this.loadLanguages();
		return this.languagePromise;
	}

	private async getSpellIndex(): Promise<SpellIndexResponse> {
		if (this.spellIndexPromise) return this.spellIndexPromise;

		this.spellIndexPromise = this.fetchJson<SpellIndexResponse>(`${this.baseUrl}/spells/index.json`);
		return this.spellIndexPromise;
	}

	private async loadSpellsBySource(source: string): Promise<FiveEToolsReferenceSpell[]> {
		const index = await this.getSpellIndex();
		const fileName = index[source];
		if (!fileName) throw new Error(`Source de spells não encontrada: ${source}.`);

		const data = await this.fetchJson<SpellSourceResponse>(`${this.baseUrl}/spells/${fileName}`);
		return (data.spell ?? [])
			.filter((spell) => !!spell?.name && !!spell?.source)
			.map((spell) => ({
				name: spell.name,
				source: spell.source,
				level: Number.isFinite(Number(spell.level)) ? Math.max(0, Math.floor(Number(spell.level))) : 0,
				school: spell.school,
				entries: Array.isArray(spell.entries) ? spell.entries : [],
				entriesHigherLevel: Array.isArray(spell.entriesHigherLevel)
					? spell.entriesHigherLevel
					: undefined,
				meta: spell.meta,
				components: spell.components,
				range: spell.range,
				duration: spell.duration,
				page: spell.page,
			}))
			.sort((left, right) => left.name.localeCompare(right.name));
	}

	private async loadActions(): Promise<FiveEToolsReferenceAction[]> {
		const data = await this.fetchJson<ActionResponse>(`${this.baseUrl}/actions.json`);
		return (data.action ?? [])
			.filter((action) => !!action?.name && !!action?.source && Array.isArray(action.entries))
			.map((action) => ({
				kind: 'action' as const,
				name: action.name,
				source: action.source,
				entries: Array.isArray(action.entries) ? action.entries : [],
				page: action.page,
				fromVariant: action.fromVariant,
				time: action.time,
			}))
			.sort((left, right) => left.name.localeCompare(right.name));
	}

	private async loadOptionalFeatures(): Promise<FiveEToolsReferenceOptionalFeature[]> {
		const data = await this.fetchJson<OptionalFeatureResponse>(`${this.baseUrl}/optionalfeatures.json`);
		return (data.optionalfeature ?? [])
			.filter((feature) => !!feature?.name && !!feature?.source && Array.isArray(feature.entries))
			.map((feature) => ({
				kind: 'optionalfeature' as const,
				name: feature.name,
				source: feature.source,
				entries: Array.isArray(feature.entries) ? feature.entries : [],
				page: feature.page,
				featureType: Array.isArray(feature.featureType) ? feature.featureType : undefined,
				hasAdditionalSpells: Array.isArray(feature.additionalSpells) && feature.additionalSpells.length > 0,
				additionalSpells: Array.isArray(feature.additionalSpells)
					? feature.additionalSpells
					: undefined,
			}))
			.sort((left, right) => left.name.localeCompare(right.name));
	}

	private async loadFeats(): Promise<FiveEToolsReferenceFeat[]> {
		const data = await this.fetchJson<FeatResponse>(`${this.baseUrl}/feats.json`);
		return (data.feat ?? [])
			.filter((feat) => !!feat?.name && !!feat?.source && Array.isArray(feat.entries))
			.map((feat) => ({
				kind: 'feat' as const,
				name: feat.name,
				source: feat.source,
				entries: Array.isArray(feat.entries) ? feat.entries : [],
				page: feat.page,
				category: feat.category,
				hasAdditionalSpells: Array.isArray(feat.additionalSpells) && feat.additionalSpells.length > 0,
				additionalSpells: Array.isArray(feat.additionalSpells) ? feat.additionalSpells : undefined,
				ability: Array.isArray(feat.ability) ? feat.ability : undefined,
			}))
			.sort((left, right) => left.name.localeCompare(right.name));
	}

	private async loadItems(): Promise<FiveEToolsReferenceItem[]> {
		const data = await this.fetchJson<ItemResponse>(`${this.baseUrl}/items.json`);
		return (data.item ?? [])
			.filter((item) => !!item?.name && !!item?.source && Array.isArray(item.entries) && item.entries.length > 0)
			.map((item) => ({
				kind: 'item' as const,
				name: item.name,
				source: item.source,
				entries: Array.isArray(item.entries) ? item.entries : [],
				page: item.page,
				type: item.type,
				rarity: item.rarity,
				hasAttachedSpells: !!item.attachedSpells,
				attachedSpells: item.attachedSpells,
			}))
			.sort((left, right) => left.name.localeCompare(right.name));
	}

	private async loadConditionStatusReferences(): Promise<FiveEToolsReferenceConditionStatus[]> {
		const data = await this.fetchJson<ConditionDiseaseStatusResponse>(
			`${this.baseUrl}/conditionsdiseases.json`,
		);
		const conditions = (data.condition ?? [])
			.filter((entry) => !!entry?.name && !!entry?.source && Array.isArray(entry.entries))
			.map((entry) => ({
				kind: 'condition' as const,
				name: entry.name,
				source: entry.source,
				entries: Array.isArray(entry.entries) ? entry.entries : [],
				page: entry.page,
			}));
		const statuses = (data.status ?? [])
			.filter((entry) => !!entry?.name && !!entry?.source && Array.isArray(entry.entries))
			.map((entry) => ({
				kind: 'status' as const,
				name: entry.name,
				source: entry.source,
				entries: Array.isArray(entry.entries) ? entry.entries : [],
				page: entry.page,
			}));
		return [...conditions, ...statuses].sort((left, right) => left.name.localeCompare(right.name));
	}

	private async loadLanguages(): Promise<FiveEToolsReferenceLanguage[]> {
		const data = await this.fetchJson<LanguageResponse>(`${this.baseUrl}/languages.json`);
		return (data.language ?? [])
			.filter((language) => !!language?.name && !!language?.source)
			.map((language) => ({
				kind: 'language' as const,
				name: language.name,
				source: language.source,
				entries: Array.isArray(language.entries) ? language.entries : [],
				page: language.page,
				type: language.type,
				script: language.script,
				origin: language.origin,
			}))
			.sort((left, right) => left.name.localeCompare(right.name));
	}

	private async fetchJson<T>(url: string): Promise<T> {
		let response: Response;
		try {
			response = await fetch(url, { headers: { Accept: 'application/json' } });
		} catch {
			throw new Error('Não foi possível acessar os dados de referência do 5etools.');
		}

		if (!response.ok) {
			throw new Error(`Os dados de referência do 5etools retornaram ${response.status}.`);
		}

		try {
			return (await response.json()) as T;
		} catch {
			throw new Error('Os dados de referência do 5etools vieram em formato inválido.');
		}
	}
}
