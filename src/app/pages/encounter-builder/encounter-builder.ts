import { Component, computed, effect, inject, signal } from '@angular/core';
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
import { EncounterIoService } from '../../services/encounter-io-service/encounter-io-service';
import { ActivatedRoute, Router } from '@angular/router';
import { LocalStorageService } from '../../services/local-storage-service/local-storage-service';

type DraftCreature = {
	name: string;
	initiative: number | null;
	hp: number | null;
	ac: string;
	quantity: number;
};

type SpellDraft = { label: string; total: number };
type ConditionDraft = { text: string; url: string };

@Component({
	selector: 'app-encounter-builder',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './encounter-builder.html',
})
export class EncounterBuilder {
	private io = inject(EncounterIoService);

	encounter = signal<BattleTracker>(structuredClone(encounterBase));
	creatures = computed(() => this.encounter().creatures);

	expandedId = signal<number | null>(null);

	noteDrafts = signal<Record<number, string>>({});
	spellDrafts = signal<Record<number, SpellDraft>>({});
	conditionDrafts = signal<Record<number, ConditionDraft>>({});

	importOpen = signal(false);
	importText = signal('');
	ioMsg = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);

	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private ls = inject(LocalStorageService);

	savedId = signal<string | null>(null);
	title = signal<string>('');

	exportOpen = signal(false);
	exportJson = computed(() => this.io.toJson(this.encounter()));

	SPELL_LEVELS: SpellLevel[] = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

	draft = signal<DraftCreature>({
		name: '',
		initiative: null,
		hp: null,
		ac: '',
		quantity: 1,
	});

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

	private cleanDraft() {
		this.draft.set({ name: '', initiative: null, hp: null, ac: '', quantity: 1 });
	}

	toggleExpanded(id: number) {
		this.expandedId.update((curr) => (curr === id ? null : id));
	}
	isExpanded(id: number) {
		return this.expandedId() === id;
	}

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
					maxHealthPoints: hp,
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

			this.cleanDraft();

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
				const hadTotal = typeof total[level] === 'number';
				total[level] = value;
				if (!hadTotal) used[level] = 0;

				const usedVal = used[level] ?? 0;
				if (usedVal > value) used[level] = value;

				c.totalSpellSlots = total;
				c.usedSpellSlots = used;
			} else {
				const max = total[level] ?? value;
				used[level] = Math.min(value, max);
				c.usedSpellSlots = used;
			}

			return next;
		});
	}

	spellEntries(spells: SpellsByKey): Array<{ key: string; value: SpellInterface }> {
		return Object.entries(spells || {}).map(([key, value]) => ({ key, value }));
	}

	getSpellDraft(id: number): SpellDraft {
		return this.spellDrafts()[id] ?? { label: '', total: 1 };
	}

	setSpellDraft(id: number, patch: Partial<SpellDraft>) {
		this.spellDrafts.update((m) => ({ ...m, [id]: { ...this.getSpellDraft(id), ...patch } }));
	}

	private uniqueSpellKey(spells: SpellsByKey, label: string) {
		const base = this.slugify(label) || 'spell';
		let key = base;
		let i = 2;
		while (spells[key]) {
			key = `${base}${i}`;
			i++;
		}
		return key;
	}

	addSpell(creatureId: number) {
		const d = this.getSpellDraft(creatureId);
		const label = (d.label || '').trim();
		const total = this.parseNonNegInt(d.total) || 1;
		if (!label) return;

		this.encounter.update((e) => {
			const next = structuredClone(e);
			const c = next.creatures.find((x) => x.id === creatureId);
			if (!c) return e;

			c.spells = c.spells ?? {};
			const key = this.uniqueSpellKey(c.spells, label);
			c.spells[key] = { label, total };
			return next;
		});

		this.setSpellDraft(creatureId, { label: '', total: 1 });
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

	downloadExport() {
		this.io.download(this.encounter());
	}

	copyExportJson() {
		return this.io.copy(this.encounter());
	}

	clearImport() {
		this.importText.set('');
		this.ioMsg.set(null);
	}

	importFromTextarea() {
		try {
			const { encounter, warnings } = this.io.fromJsonText(this.importText());
			this.encounter.set(encounter);

			if (warnings.length) {
				this.ioMsg.set({ type: 'warn', text: warnings.join(' ') });
			} else {
				this.ioMsg.set({ type: 'success', text: 'Import realizado com sucesso.' });
			}
		} catch (err: any) {
			this.ioMsg.set({ type: 'error', text: err?.message ?? 'Erro ao importar.' });
		}
	}

	async onFileSelected(ev: Event) {
		const input = ev.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		try {
			const text = await file.text();
			this.importText.set(text);
			this.importFromTextarea();
		} catch {
			this.ioMsg.set({ type: 'error', text: 'Não consegui ler o arquivo.' });
		} finally {
			input.value = '';
		}
	}

	save() {
		const data = this.encounter();
		const title = this.title().trim() || 'Untitled Encounter';

		const id = this.savedId();
		if (!id) {
			const saved = this.ls.createEncounter(title, data);
			this.savedId.set(saved.id);
			this.router.navigate(['/home/encounter-builder', saved.id]);
			return;
		}

		this.ls.updateEncounter(id, { title, data: structuredClone(data) });
	}

	constructor() {
		const id = this.route.snapshot.paramMap.get('id');
		if (id) {
			const item = this.ls.getEncounter(id);
			if (item) {
				this.savedId.set(id);
				this.title.set(item.title);
				this.encounter.set(structuredClone(item.data));
			}
		}

		effect(() => console.log(this.encounter()));
	}
}
