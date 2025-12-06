import { Injectable } from '@angular/core';
import type {
	BattleTracker,
	CreatureInterface,
	SpellLevel,
	SpellSlots,
	SpellsByKey,
	SpellInterface,
	NoteInterface,
	ConditionInterface,
} from '../../models/battleTracker-model';

type ImportResult = { encounter: BattleTracker; warnings: string[] };

@Injectable({ providedIn: 'root' })
export class EncounterIoService {
	private readonly VERSION = '5.123.0' as const;
	private readonly LEVELS: SpellLevel[] = [
		'1st',
		'2nd',
		'3rd',
		'4th',
		'5th',
		'6th',
		'7th',
		'8th',
		'9th',
	];

	toExportObject(encounter: BattleTracker) {
		const e = encounter;

		const creatures = [...(e.creatures ?? [])]
			.sort((a, b) => a.id - b.id)
			.map((c) => ({
				name: c.name,
				initiative: c.initiative,

				initiativeRoll:
					c.initiative == null
						? null
						: { result: c.initiative, terms: [{ type: 'integer', term: String(c.initiative) }] },
				initiativeTieBreaker: null,

				healthPoints: c.healthPoints,
				maxHealthPoints: c.maxHealthPoints,
				armorClass: c.armorClass,
				temporaryHealthPoints: c.temporaryHealthPoints,

				id: c.id,
				alive: c.alive,

				conditions: c.conditions ?? [],
				notes: c.notes ?? [],

				locked: false,
				shared: c.shared,
				hitPointsShared: c.hitPointsShared,

				statBlock: null,

				totalSpellSlots: c.totalSpellSlots ?? null,
				usedSpellSlots: c.usedSpellSlots ?? null,
				spells: c.spells ?? {},
			}));

		const maxId = creatures.reduce((m, c) => Math.max(m, c.id), -1);

		return {
			creatures,
			creatureIdCount: Math.max(e.creatureIdCount, maxId + 1),

			// ✅ export como encounter novo (evita crash)
			activeCreature: null,
			round: 0,
			battleCreated: false,

			// fixos
			shareEnabled: false,
			battleTrackerVersion: this.VERSION,
			sharedTimestamp: null,
			loaded: true,
		};
	}

	toJson(encounter: BattleTracker) {
		return JSON.stringify(this.toExportObject(encounter), null, 2);
	}

	download(
		encounter: BattleTracker,
		title?: string,
		opts?: { includeDate?: boolean; suffix?: string }
	) {
		const json = this.toJson(encounter);
		const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
		const url = URL.createObjectURL(blob);

		const includeDate = opts?.includeDate ?? true;

		const safeTitle =
			(title || 'encounter')
				.trim()
				.toLowerCase()
				.normalize('NFKD')
				.replace(/[\u0300-\u036f]/g, '')
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/(^-|-$)/g, '')
				.slice(0, 40) || 'encounter';

		let filename = `encounter-${safeTitle}`;

		if (opts?.suffix) filename += `-${opts.suffix}`;

		if (includeDate) {
			const d = new Date();
			const pad = (n: number) => String(n).padStart(2, '0');
			filename += `-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		}

		filename += `.json`;

		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	async copy(encounter: BattleTracker) {
		const json = this.toJson(encounter);
		try {
			await navigator.clipboard.writeText(json);
		} catch {
			window.prompt('Copy your JSON:', json);
		}
	}

	fromJsonText(json: string): ImportResult {
		let raw: any;
		try {
			raw = JSON.parse(json);
		} catch {
			throw new Error('JSON inválido (não deu parse).');
		}
		return this.fromObject(raw);
	}

	fromObject(raw: any): ImportResult {
		const warnings: string[] = [];

		if (!raw || typeof raw !== 'object') throw new Error('JSON deve ser um objeto.');
		if (!Array.isArray(raw.creatures))
			throw new Error('JSON inválido: "creatures" precisa ser um array.');

		const creatures: CreatureInterface[] = raw.creatures.map((rc: any, idx: number) =>
			this.normalizeCreature(rc, idx)
		);

		const maxId = creatures.reduce((m, c) => Math.max(m, c.id), -1);
		const reportedCount = this.toFiniteInt(raw.creatureIdCount, null);
		const creatureIdCount = Math.max(reportedCount ?? 0, maxId + 1);

		if (raw.battleTrackerVersion && raw.battleTrackerVersion !== this.VERSION) {
			warnings.push(
				`Versão importada (${String(raw.battleTrackerVersion)}) -> export vai sair como ${
					this.VERSION
				}.`
			);
		}

		const encounter: BattleTracker = {
			creatures,
			creatureIdCount,
			round: this.toFiniteInt(raw.round, 0) ?? 0,
			battleCreated: this.toBool(raw.battleCreated, false),

			shareEnabled: false,
			battleTrackerVersion: this.VERSION,
			sharedTimestamp: null,
			loaded: true,
		};

		return { encounter, warnings };
	}

	private normalizeCreature(rc: any, idx: number): CreatureInterface {
		const id = this.toFiniteInt(rc?.id, idx) ?? idx;

		const hp = this.toFiniteInt(rc?.healthPoints, 0) ?? 0;
		const maxHp = this.toFiniteInt(rc?.maxHealthPoints, hp) ?? hp;

		return {
			name: this.toStr(rc?.name, `Creature #${id + 1}`),
			initiative: this.toFiniteIntNullable(rc?.initiative),

			healthPoints: hp,
			maxHealthPoints: maxHp,

			armorClass:
				typeof rc?.armorClass === 'number' || typeof rc?.armorClass === 'string'
					? rc.armorClass
					: '',

			temporaryHealthPoints: this.toFiniteIntNullable(rc?.temporaryHealthPoints),

			id,
			alive: this.toBool(rc?.alive, true),

			conditions: this.normalizeConditions(rc?.conditions),
			notes: this.normalizeNotes(rc?.notes),

			shared: this.toBool(rc?.shared, true),
			hitPointsShared: this.toBool(rc?.hitPointsShared, true),

			totalSpellSlots: this.normalizeSlots(rc?.totalSpellSlots),
			usedSpellSlots: this.normalizeSlots(rc?.usedSpellSlots),

			spells: this.normalizeSpells(rc?.spells),
		};
	}

	private normalizeNotes(raw: any): NoteInterface[] {
		if (!Array.isArray(raw)) return [];
		return raw.map((n: any, idx: number) => ({
			text: this.toStr(n?.text, ''),
			appliedAtRound: this.toFiniteInt(n?.appliedAtRound, 0) ?? 0,
			appliedAtSeconds: this.toFiniteInt(n?.appliedAtSeconds, 0) ?? 0,
			id: this.toFiniteInt(n?.id, idx) ?? idx,
		}));
	}

	private normalizeConditions(raw: any): ConditionInterface[] {
		if (!Array.isArray(raw)) return [];
		return raw.map((c: any, idx: number) => ({
			text: this.toStr(c?.text, ''),
			appliedAtRound: this.toFiniteInt(c?.appliedAtRound, 0) ?? 0,
			appliedAtSeconds: this.toFiniteInt(c?.appliedAtSeconds, 0) ?? 0,
			url: this.toStr(c?.url, ''),
			id: this.toStr(c?.id, `cond-${idx}`),
		}));
	}

	private normalizeSlots(raw: any): SpellSlots | null {
		if (raw === null || raw === undefined) return null;
		if (typeof raw !== 'object') return null;

		const out: SpellSlots = {};
		for (const lvl of this.LEVELS) {
			const v = this.toFiniteInt((raw as any)[lvl], null);
			if (v !== null) out[lvl] = Math.max(0, v);
		}

		return Object.keys(out).length ? out : {};
	}

	private normalizeSpells(raw: any): SpellsByKey {
		if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
			const out: SpellsByKey = {};
			for (const [key, val] of Object.entries(raw)) {
				const v: any = val;
				const label = this.toStr(v?.label, String(key));
				const total = Math.max(1, this.toFiniteInt(v?.total, 1) ?? 1);
				out[String(key)] = { label, total } satisfies SpellInterface;
			}
			return out;
		}

		if (Array.isArray(raw)) {
			const out: SpellsByKey = {};
			raw.forEach((v: any, i: number) => {
				const label = this.toStr(v?.label, `Spell ${i + 1}`);
				const total = Math.max(1, this.toFiniteInt(v?.total, 1) ?? 1);
				out[`spell${i + 1}`] = { label, total };
			});
			return out;
		}

		return {};
	}

	private toStr(v: any, fallback: string): string {
		return typeof v === 'string' ? v : fallback;
	}

	private toBool(v: any, fallback: boolean): boolean {
		return typeof v === 'boolean' ? v : fallback;
	}

	private toFiniteInt(v: any, fallback: number | null): number | null {
		const n = Number(v);
		if (!Number.isFinite(n)) return fallback;
		return Math.floor(n);
	}

	private toFiniteIntNullable(v: any): number | null {
		if (v === '' || v === null || v === undefined) return null;
		const n = Number(v);
		return Number.isFinite(n) ? Math.floor(n) : null;
	}
}
