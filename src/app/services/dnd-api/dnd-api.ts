import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay, map, catchError, throwError } from 'rxjs';
import type {
	CreatureFeature,
	CreatureInterface,
	CreatureSpecialAbility,
	SpellLevel,
	SpellSlots,
	SpellsByKey,
} from '../../models/battleTracker-model';

export type ApiResourceListItem = { index: string; name: string; url: string };

export type ApiResourceListResponse = {
	count: number;
	results: ApiResourceListItem[];
};

export type ApiMonsterArmorClass = {
	type?: string;
	value?: number;
};

export type ApiMonsterSpecialAbility = {
	name?: string;
	desc?: string;
};

export type ApiMonsterAction = {
	name?: string;
	desc?: string;
};

export type ApiMonster = {
	index: string;
	name: string;
	hit_points?: number;
	armor_class?: ApiMonsterArmorClass[];
	dexterity?: number;
	special_abilities?: ApiMonsterSpecialAbility[];
	actions?: ApiMonsterAction[];
	reactions?: ApiMonsterAction[];
	legendary_actions?: ApiMonsterAction[];
};

const SPELL_LEVELS: SpellLevel[] = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

@Injectable({ providedIn: 'root' })
export class Dnd5eApiService {
	private http = inject(HttpClient);

	private readonly baseUrl = 'https://www.dnd5eapi.co/api/2014';

	// cache do list e detalhes
	private listCache = new Map<string, Observable<ApiResourceListItem[]>>();
	private monsterCache = new Map<string, Observable<ApiMonster>>();

	listMonsters(opts?: { challengeRating?: number[] }): Observable<ApiResourceListItem[]> {
		const key = JSON.stringify(opts ?? {});
		const cached = this.listCache.get(key);
		if (cached) return cached;

		let params = new HttpParams();
		if (opts?.challengeRating?.length) {
			params = params.set('challenge_rating', opts.challengeRating.join(','));
		}

		const req$ = this.http
			.get<ApiResourceListResponse>(`${this.baseUrl}/monsters`, { params })
			.pipe(
				map((r) => (Array.isArray(r?.results) ? r.results : [])),
				shareReplay({ bufferSize: 1, refCount: true }),
				catchError((err) =>
					throwError(() => new Error(`Falha ao listar monstros da API: ${this.errToMsg(err)}`))
				)
			);

		this.listCache.set(key, req$);
		return req$;
	}

	/** Detalhe do monstro por index (ex: "aboleth"). */
	getMonster(index: string): Observable<ApiMonster> {
		const k = (index || '').trim();
		if (!k) return throwError(() => new Error('Index do monstro vazio.'));

		const cached = this.monsterCache.get(k);
		if (cached) return cached;

		const req$ = this.http
			.get<ApiMonster>(`${this.baseUrl}/monsters/${encodeURIComponent(k)}`)
			.pipe(
				shareReplay({ bufferSize: 1, refCount: true }),
				catchError((err) =>
					throwError(() => new Error(`Falha ao buscar monstro "${k}": ${this.errToMsg(err)}`))
				)
			);

		this.monsterCache.set(k, req$);
		return req$;
	}

	/** Converte o monstro da API no teu CreatureInterface (bestiário -> battle tracker). */
	toCreature(
		monster: ApiMonster,
		args: { id: number; initiative?: number | null } // initiative opcional (você decide)
	): CreatureInterface {
		const hp = Math.max(0, Math.floor(Number(monster.hit_points ?? 0) || 0));
		const ac = this.pickArmorClass(monster);
		const totalSlots = this.extractSpellSlots(monster);
		const usedSlots = totalSlots ? this.zeroUsedSlots(totalSlots) : null;

		const creature: CreatureInterface = {
			name: monster.name || 'Unknown Monster',
			initiative: args.initiative ?? null,
			healthPoints: hp,
			maxHealthPoints: hp,
			armorClass: ac,
			temporaryHealthPoints: null,
			id: args.id,
			alive: true,
			conditions: [],
			notes: [],
			shared: true,
			hitPointsShared: true,
			totalSpellSlots: totalSlots,
			usedSpellSlots: usedSlots,
			spells: {} as SpellsByKey,
			specialAbilities: this.extractSpecialAbilities(monster),
			sheetFeatures: this.extractSheetFeatures(monster),
			category: 'monster',
		};

		return creature;
	}

	/** DEX mod (se você quiser preencher initiative automático no draft). */
	dexMod(monster: ApiMonster): number {
		const dex = Number(monster.dexterity ?? 10);
		return Math.floor((dex - 10) / 2);
	}

	// --------------------
	// helpers
	// --------------------

	private pickArmorClass(monster: ApiMonster): string | number {
		const arr = monster.armor_class;
		if (!Array.isArray(arr) || !arr.length) return '';
		const v = arr[0]?.value;
		return typeof v === 'number' ? v : '';
	}

	/**
	 * Tenta extrair spell slots do texto da trait "Spellcasting"/"Innate Spellcasting".
	 * Exemplos comuns no texto:
	 *   "1st level (4 slots): ..."
	 *   "2nd level (3 slots): ..."
	 */
	private extractSpellSlots(monster: ApiMonster): SpellSlots | null {
		const abilities = monster.special_abilities;
		if (!Array.isArray(abilities) || !abilities.length) return null;

		const spellTexts = abilities
			.filter((a) => {
				const n = (a.name || '').toLowerCase();
				return n.includes('spellcasting');
			})
			.map((a) => a.desc || '')
			.filter(Boolean);

		if (!spellTexts.length) return null;

		const text = spellTexts.join('\n');

		const re = /\b(1st|2nd|3rd|4th|5th|6th|7th|8th|9th)\s+level\s*\((\d+)\s*slots?\)/gi;

		const slots: SpellSlots = {};
		let matched = false;

		for (const m of text.matchAll(re)) {
			const lvl = (m[1] || '').toLowerCase() as SpellLevel;
			const n = Math.max(0, Math.floor(Number(m[2] || 0)));

			if (SPELL_LEVELS.includes(lvl)) {
				slots[lvl] = n;
				matched = true;
			}
		}

		return matched ? slots : null;
	}

	private extractSpecialAbilities(monster: ApiMonster): CreatureSpecialAbility[] {
		const abilities = monster.special_abilities;
		if (!Array.isArray(abilities) || !abilities.length) return [];

		return abilities
			.filter((ability) => {
				const name = (ability.name || '').trim().toLowerCase();
				return !name.includes('spellcasting');
			})
			.map((ability, index) => ({
				id: `api-ability-${monster.index}-${index + 1}`,
				name: ability.name?.trim() || `Habilidade ${index + 1}`,
				description: ability.desc?.trim() || undefined,
				rechargeType: 'manual' as const,
			}))
			.filter((ability) => ability.name);
	}

	private extractSheetFeatures(monster: ApiMonster): CreatureFeature[] {
		const features: CreatureFeature[] = [];
		const pushEntries = (
			items: Array<ApiMonsterSpecialAbility | ApiMonsterAction> | undefined,
			kind: CreatureFeature['kind']
		) => {
			if (!Array.isArray(items)) return;
			for (const [index, item] of items.entries()) {
				const name = (item.name || '').trim();
				if (!name) continue;
				features.push({
					id: `${monster.index}-${kind}-${index + 1}`,
					name,
					description: (item.desc || '').trim() || undefined,
					kind,
				});
			}
		};

		pushEntries(
			(monster.special_abilities ?? []).filter(
				(ability) => !(ability.name || '').toLowerCase().includes('spellcasting')
			),
			'trait'
		);
		pushEntries(
			(monster.special_abilities ?? []).filter((ability) =>
				(ability.name || '').toLowerCase().includes('spellcasting')
			),
			'spellcasting'
		);
		pushEntries(monster.actions, 'action');
		pushEntries(monster.reactions, 'reaction');
		pushEntries(monster.legendary_actions, 'legendary');

		return features;
	}

	private zeroUsedSlots(total: SpellSlots): SpellSlots {
		const used: SpellSlots = {};
		for (const k of SPELL_LEVELS) {
			if (typeof total[k] === 'number') used[k] = 0;
		}
		return used;
	}

	private errToMsg(err: any): string {
		return err?.message || err?.statusText || 'erro desconhecido';
	}
}
