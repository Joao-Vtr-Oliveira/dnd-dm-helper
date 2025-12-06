import { Component, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { encounterBase } from '../../utils/base-file/encounter-base';
import type {
	BattleTracker,
	CreatureInterface,
	NoteInterface,
	SpellLevel,
	SpellInterface,
	SpellSlots,
	SpellsByKey,
} from '../../models/battleTracker-model';

type DraftCreature = {
	name: string;
	initiative: number | null;
	hp: number | null;
	ac: string;
	quantity: number;
};

type SpellDraft = { key: string; label: string; total: number };
type ConditionDraft = { text: string; url: string };

@Component({
	selector: 'app-encounter-builder',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './encounter-builder.html',
})
export class EncounterBuilder {
	encounter = signal<BattleTracker>(structuredClone(encounterBase));

	creatures = computed(() => this.encounter().creatures);

	// ✅ só @if/@for — vamos controlar expandido por aqui
	expandedId = signal<number | null>(null);

	// drafts por criatura (pra add notes/spells/conditions)
	noteDrafts = signal<Record<number, string>>({});
	spellDrafts = signal<Record<number, SpellDraft>>({});
	conditionDrafts = signal<Record<number, ConditionDraft>>({});

	SPELL_LEVELS: SpellLevel[] = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

	draft = signal<DraftCreature>({
		name: '',
		initiative: null,
		hp: null,
		ac: '',
		quantity: 1,
	});

	// helpers
	private parseNullableNumber(v: any): number | null {
		if (v === '' || v === null || v === undefined) return null;
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	}
	private parseNonNegInt(v: any): number {
		const n = Math.floor(Number(v));
		return Number.isFinite(n) ? Math.max(0, n) : 0;
	}
	private slugify(s: string): string {
		return (s || '')
			.trim()
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '')
			.slice(0, 40);
	}

	// --- Draft setters (top form)
	setDraftName(v: string) {
		this.draft.update((d) => ({ ...d, name: v }));
	}
	setDraftInitiative(v: any) {
		this.draft.update((d) => ({ ...d, initiative: this.parseNullableNumber(v) }));
	}
	setDraftHp(v: any) {
		this.draft.update((d) => ({ ...d, hp: this.parseNullableNumber(v) }));
	}
	setDraftAc(v: string) {
		this.draft.update((d) => ({ ...d, ac: v }));
	}
	setDraftQty(v: any) {
		const n = Math.max(1, Math.floor(Number(v) || 1));
		this.draft.update((d) => ({ ...d, quantity: n }));
	}

	toggleExpanded(id: number) {
		this.expandedId.update((curr) => (curr === id ? null : id));
	}
	isExpanded(id: number) {
		return this.expandedId() === id;
	}

	// --- CRUD base
	addCreatures() {
		const d = this.draft();
		const qty = Math.max(1, Math.floor(d.quantity || 1));

		this.encounter.update((e) => {
			const next = structuredClone(e);

			for (let i = 0; i < qty; i++) {
				const id = next.creatureIdCount;
				const hp = d.hp ?? 0;

				const c: CreatureInterface = {
					name: d.name || `Creature #${id + 1}`,
					initiative: d.initiative,
					healthPoints: hp,
					maxHealthPoints: hp, // ✅ HP e Max HP iguais ao adicionar
					armorClass: d.ac || '',
					temporaryHealthPoints: null,
					id,
					alive: true,
					conditions: [],
					notes: [],
					shared: true,
					hitPointsShared: true,
					totalSpellSlots: null,
					usedSpellSlots: null,
					spells: {},
				};

				next.creatures.push(c);
				next.creatureIdCount++;
			}

			next.shareEnabled = false;
			next.battleTrackerVersion = '5.123.0';
			next.sharedTimestamp = null;

			return next;
		});
	}

	updateCreature(id: number, patch: Partial<CreatureInterface>) {
		this.encounter.update((e) => {
			const next = structuredClone(e);
			const idx = next.creatures.findIndex((c) => c.id === id);
			if (idx === -1) return e;
			next.creatures[idx] = { ...next.creatures[idx], ...patch };
			return next;
		});
	}

	removeCreature(id: number) {
		this.encounter.update((e) => {
			const next = structuredClone(e);
			next.creatures = next.creatures.filter((c) => c.id !== id);
			return next;
		});
	}

	// --- NOTES
	getNoteDraft(id: number) {
		return this.noteDrafts()[id] ?? '';
	}
	setNoteDraft(id: number, v: string) {
		this.noteDrafts.update((m) => ({ ...m, [id]: v }));
	}
	addNote(creatureId: number) {
		const text = (this.getNoteDraft(creatureId) || '').trim();
		if (!text) return;

		this.encounter.update((e) => {
			const next = structuredClone(e);
			const c = next.creatures.find((x) => x.id === creatureId);
			if (!c) return e;

			const nextId = c.notes.reduce((max, n) => Math.max(max, n.id), -1) + 1 || 0;

			const note: NoteInterface = {
				text,
				appliedAtRound: 0,
				appliedAtSeconds: 0,
				id: nextId,
			};

			c.notes.push(note);
			return next;
		});

		this.setNoteDraft(creatureId, '');
	}
	updateNote(creatureId: number, noteId: number, patch: Partial<NoteInterface>) {
		this.encounter.update((e) => {
			const next = structuredClone(e);
			const c = next.creatures.find((x) => x.id === creatureId);
			if (!c) return e;
			const idx = c.notes.findIndex((n) => n.id === noteId);
			if (idx === -1) return e;
			c.notes[idx] = { ...c.notes[idx], ...patch };
			return next;
		});
	}
	removeNote(creatureId: number, noteId: number) {
		this.encounter.update((e) => {
			const next = structuredClone(e);
			const c = next.creatures.find((x) => x.id === creatureId);
			if (!c) return e;
			c.notes = c.notes.filter((n) => n.id !== noteId);
			return next;
		});
	}

	// --- SPELLCASTING enable + slots
	enableSpellcasting(creatureId: number) {
		this.updateCreature(creatureId, {
			totalSpellSlots: {},
			usedSpellSlots: {},
		});
	}
	slotValue(slots: SpellSlots | null, level: SpellLevel): number | null {
		if (!slots) return null;
		const v = slots[level];
		return typeof v === 'number' ? v : null;
	}
	setSpellSlot(creatureId: number, kind: 'total' | 'used', level: SpellLevel, v: any) {
		const value = this.parseNonNegInt(v);

		this.encounter.update((e) => {
			const next = structuredClone(e);
			const c = next.creatures.find((x) => x.id === creatureId);
			if (!c) return e;

			const total = (c.totalSpellSlots ?? {}) as SpellSlots;
			const used = (c.usedSpellSlots ?? {}) as SpellSlots;

			if (kind === 'total') {
				total[level] = value;

				// clamp used <= total
				const usedVal = used[level] ?? 0;
				if (usedVal > value) used[level] = value;

				c.totalSpellSlots = total;
				c.usedSpellSlots = used;
			} else {
				const max = total[level] ?? value; // se total vazio, deixa usar
				used[level] = Math.min(value, max);
				c.usedSpellSlots = used;
			}

			return next;
		});
	}

	// --- SPELLS (Record<string, SpellInterface>)
	spellEntries(spells: SpellsByKey): Array<{ key: string; value: SpellInterface }> {
		return Object.entries(spells || {}).map(([key, value]) => ({ key, value }));
	}

	getSpellDraft(id: number): SpellDraft {
		return this.spellDrafts()[id] ?? { key: '', label: '', total: 1 };
	}
	setSpellDraft(id: number, patch: Partial<SpellDraft>) {
		this.spellDrafts.update((m) => ({ ...m, [id]: { ...this.getSpellDraft(id), ...patch } }));
	}

	addSpell(creatureId: number) {
		const d = this.getSpellDraft(creatureId);
		const label = (d.label || '').trim();
		const total = this.parseNonNegInt(d.total);
		const key = (d.key || this.slugify(label)).trim();

		if (!label || !key) return;

		this.encounter.update((e) => {
			const next = structuredClone(e);
			const c = next.creatures.find((x) => x.id === creatureId);
			if (!c) return e;

			c.spells = c.spells ?? {};
			c.spells[key] = { label, total: total || 1 };
			return next;
		});

		this.setSpellDraft(creatureId, { key: '', label: '', total: 1 });
	}

	updateSpell(creatureId: number, key: string, patch: Partial<SpellInterface>) {
		this.encounter.update((e) => {
			const next = structuredClone(e);
			const c = next.creatures.find((x) => x.id === creatureId);
			if (!c) return e;
			const curr = c.spells?.[key];
			if (!curr) return e;
			c.spells[key] = { ...curr, ...patch };
			return next;
		});
	}

	removeSpell(creatureId: number, key: string) {
		this.encounter.update((e) => {
			const next = structuredClone(e);
			const c = next.creatures.find((x) => x.id === creatureId);
			if (!c?.spells) return e;
			delete c.spells[key];
			return next;
		});
	}

	constructor() {
		effect(() => {
			let e = this.encounter();
			console.log(e);
		});
	}
}
