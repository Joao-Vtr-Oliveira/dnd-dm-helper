import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { encounterBase } from '../../utils/base-file/encounter-base';
import type {
	BattleTracker,
	CreatureInterface,
	CreatureSpecialAbility,
	CreatureAbilityRechargeType,
	NoteInterface,
	SpellLevel,
	SpellInterface,
	SpellSlots,
	SpellsByKey,
} from '../../models/battleTracker-model';
import { EncounterIoService } from '../../services/encounter-io-service/encounter-io-service';
import { ActivatedRoute, Router } from '@angular/router';
import {
	LocalStorageService,
	SavedSheetInterface,
} from '../../services/local-storage-service/local-storage-service';
import { ApiResourceListItem, Dnd5eApiService } from '../../services/dnd-api/dnd-api';
import { firstValueFrom } from 'rxjs';
import { CreatureTemplateService } from '../../services/creature-template-service/creature-template-service';

type DraftCreature = {
	name: string;
	initiative: number | null;
	hp: number | null;
	ac: string;
	quantity: number;
};

type SpellDraft = { label: string; total: number };
type ConditionDraft = { text: string; url: string };
type AbilityDraft = {
	name: string;
	description: string;
	rechargeType: CreatureAbilityRechargeType;
	cooldownValue: number;
	rechargeOn: string;
};

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
	abilityDrafts = signal<Record<number, AbilityDraft>>({});

	importOpen = signal(false);
	importText = signal('');
	ioMsg = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);

	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private ls = inject(LocalStorageService);
	private creatureTemplateService = inject(CreatureTemplateService);

	// --- Homebrew import modal ---
	homebrewModalOpen = signal(false);
	apiModalOpen = signal(false); // (deixa pro futuro)

	sheetQ = signal('');
	sheetCategoryFilter = signal<'all' | 'monster' | 'npc' | 'pc' | 'other'>('all');
	sheetTagFilter = signal<string | null>(null);
	sheetSourceFilter = signal<string | null>(null);

	homebrewSheets = signal<SavedSheetInterface[]>(this.ls.listSheets());

	openHomebrewModal() {
		this.refreshHomebrewSheets();
		this.homebrewModalOpen.set(true);
	}

	closeHomebrewModal() {
		this.homebrewModalOpen.set(false);
	}

	clearHomebrewFilters() {
		this.sheetQ.set('');
		this.sheetCategoryFilter.set('all');
		this.sheetTagFilter.set(null);
		this.sheetSourceFilter.set(null);
	}

	toggleTagFilter(tag: string) {
		this.sheetTagFilter.update((curr) => (curr === tag ? null : tag));
	}

	setCategoryFilter(cat: 'all' | 'monster' | 'npc' | 'pc' | 'other') {
		this.sheetCategoryFilter.set(cat);
	}

	toggleSourceFilter(src: string) {
		this.sheetSourceFilter.update((curr) => (curr === src ? null : src));
	}

	private refreshHomebrewSheets() {
		this.homebrewSheets.set(this.ls.listSheets());
	}

	private metaOf(s: SavedSheetInterface): { category?: any; tags?: any; source?: any } {
		return s as any;
	}
	sheetCategory(s: SavedSheetInterface): 'monster' | 'npc' | 'pc' | 'other' {
		const c = (this.metaOf(s).category ?? 'monster') as string;
		if (c === 'npc' || c === 'pc' || c === 'other') return c;
		return 'monster';
	}
	sheetTags(s: SavedSheetInterface): string[] {
		const t = this.metaOf(s).tags;
		return Array.isArray(t) ? t : [];
	}
	sheetSource(s: SavedSheetInterface): string {
		const v = this.metaOf(s).source;
		return typeof v === 'string' ? v.trim() : '';
	}

	availableSources = computed(() => {
		const set = new Set<string>();
		for (const s of this.homebrewSheets()) {
			const src = this.sheetSource(s);
			if (src) set.add(src);
		}
		return Array.from(set).sort((a, b) => a.localeCompare(b));
	});

	topTags = computed(() => {
		const freq = new Map<string, number>();
		for (const s of this.homebrewSheets()) {
			for (const t of this.sheetTags(s)) {
				const key = (t || '').trim();
				if (!key) continue;
				freq.set(key, (freq.get(key) ?? 0) + 1);
			}
		}
		return Array.from(freq.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 16)
			.map(([tag]) => tag);
	});

	filteredHomebrewSheets = computed(() => {
		const q = this.sheetQ().trim().toLowerCase();
		const cat = this.sheetCategoryFilter();
		const tag = this.sheetTagFilter();
		const src = this.sheetSourceFilter();

		return this.homebrewSheets().filter((s) => {
			const title = (s.title || '').toLowerCase();
			const name = (s.data?.name || '').toLowerCase();
			const tags = this.sheetTags(s).map((x) => x.toLowerCase());
			const category = this.sheetCategory(s);
			const source = this.sheetSource(s).toLowerCase();

			if (cat !== 'all' && category !== cat) return false;
			if (tag && !this.sheetTags(s).includes(tag)) return false;
			if (src && this.sheetSource(s) !== src) return false;

			if (!q) return true;

			const hay = `${title} ${name} ${tags.join(' ')} ${category} ${source}`;
			return hay.includes(q);
		});
	});

	categoryChipClass(cat: 'monster' | 'npc' | 'pc' | 'other', active = false): string {
		const base =
			'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border transition';
		const on = active ? ' ring-2 ring-white/20' : '';

		if (cat === 'monster')
			return `${base} bg-red-500/15 border-red-400/25 text-red-200 hover:bg-red-500/20${on}`;
		if (cat === 'pc')
			return `${base} bg-sky-500/15 border-sky-400/25 text-sky-200 hover:bg-sky-500/20${on}`;
		if (cat === 'npc')
			return `${base} bg-emerald-500/15 border-emerald-400/25 text-emerald-200 hover:bg-emerald-500/20${on}`;

		return `${base} bg-white/5 border-white/10 text-white/80 hover:bg-white/10${on}`;
	}

	chipNeutralClass(active = false): string {
		const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] border transition';
		const on = active ? ' ring-2 ring-white/20' : '';
		return `${base} bg-white/5 border-white/10 text-white/80 hover:bg-white/10${on}`;
	}

	tagChipClass(active = false): string {
		const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] border transition';
		const on = active ? ' ring-2 ring-white/20' : '';
		return `${base} bg-black/20 border-white/10 text-white/80 hover:bg-white/10${on}`;
	}

	useSheetInDraft(id: string) {
		const sheet = this.ls.getSheet(id);
		if (!sheet) {
			this.showToast({ type: 'error', text: 'Sheet não encontrada.' });
			return;
		}

		const c = sheet.data;
		this.draft.update((d) => ({
			...d,
			name: c.name || sheet.title || '',
			initiative: c.initiative ?? null,
			hp: (c.maxHealthPoints ?? c.healthPoints ?? 0) || 0,
			ac: String(c.armorClass ?? ''),
			// quantity fica como está (pra você usar no Add)
		}));

		// opcional: fecha modal ao "Use"
		// this.closeHomebrewModal();
	}

	addFromSheet(id: string) {
		const sheet = this.ls.getSheet(id);
		if (!sheet) {
			this.showToast({ type: 'error', text: 'Sheet não encontrada.' });
			return;
		}

		const qty = Math.max(1, Math.floor(Number(this.draft().quantity || 1)));
		this.encounter.update((e) => {
			const next = structuredClone(e);

			for (let i = 0; i < qty; i++) {
				const newId = next.creatureIdCount;
				const c = this.creatureTemplateService.createFromSavedSheet(sheet, {
					id: newId,
					quantityIndex: qty > 1 ? i : undefined,
				});

				// se importar vários, dá um sufixo só pra não ficar confuso
				next.creatures.push(c);
				next.creatureIdCount++;
			}

			return next;
		});

		this.showToast({ type: 'success', text: `Adicionado (${qty}x)!` });
	}

	private dndApi = inject(Dnd5eApiService);

	apiLoading = signal(false);
	apiError = signal<string | null>(null);

	apiMonsters = signal<ApiResourceListItem[]>([]);
	apiQ = signal('');

	filteredApiMonsters = computed(() => {
		const q = this.apiQ().trim().toLowerCase();
		if (!q) return this.apiMonsters();

		return this.apiMonsters().filter(
			(m) => (m.name || '').toLowerCase().includes(q) || (m.index || '').toLowerCase().includes(q)
		);
	});

	openApiModal() {
		this.apiModalOpen.set(true);
		this.apiError.set(null);

		// se já carregou uma vez, não precisa refazer
		if (this.apiMonsters().length) return;

		this.apiLoading.set(true);
		this.dndApi.listMonsters().subscribe({
			next: (list) => {
				// ordena por nome só pra ficar gostoso de usar
				const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
				this.apiMonsters.set(sorted);
				this.apiLoading.set(false);
			},
			error: (e) => {
				this.apiLoading.set(false);
				this.apiError.set(e?.message ?? 'Erro ao carregar bestiário.');
			},
		});
	}

	closeApiModal() {
		this.apiModalOpen.set(false);
		this.apiQ.set('');
		this.apiError.set(null);
	}

	async useApiInDraft(m: ApiResourceListItem) {
		try {
			const monster = await firstValueFrom(this.dndApi.getMonster(m.index));

			this.draft.update((d) => ({
				...d,
				name: monster.name || m.name || '',
				hp: Number(monster.hit_points ?? 0) || 0,
				ac: String(monster.armor_class?.[0]?.value ?? ''),
				initiative: this.dndApi.dexMod(monster),
			}));

			this.showToast({ type: 'success', text: 'Draft preenchido com dados da API.' });
		} catch (err: any) {
			this.showToast({ type: 'error', text: err?.message ?? 'Erro ao buscar monstro.' });
		}
	}

	async addFromApi(m: ApiResourceListItem) {
		try {
			const monster = await firstValueFrom(this.dndApi.getMonster(m.index));
			const qty = Math.max(1, Math.floor(Number(this.draft().quantity || 1)));

			this.encounter.update((e) => {
				const next = structuredClone(e);

				for (let i = 0; i < qty; i++) {
					const newId = next.creatureIdCount;

					const c = this.creatureTemplateService.createFromApiMonster(monster, {
						id: newId,
						initiative: null,
						quantityIndex: qty > 1 ? i : undefined,
					});

					next.creatures.push(c);
					next.creatureIdCount++;
				}

				return next;
			});

			this.showToast({ type: 'success', text: `Adicionado (${qty}x) da API!` });
		} catch (err: any) {
			this.showToast({ type: 'error', text: err?.message ?? 'Erro ao adicionar monstro.' });
		}
	}

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

	toast = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
	private toastTimer: number | null = null;

	private showToast(t: { type: 'success' | 'error' | 'warn'; text: string }, ms = 2200) {
		if (this.toastTimer) window.clearTimeout(this.toastTimer);
		this.toast.set(t);
		this.toastTimer = window.setTimeout(() => this.toast.set(null), ms);
	}

	private parseNullableNumber(v: any): number | null {
		if (v === '' || v === null || v === undefined) return null;
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	}
	private parseNonNegInt(v: any): number {
		const n = Math.floor(Number(v));
		return Number.isFinite(n) ? Math.max(0, n) : 0;
	}
	parseRechargeOnInput(value: string): number[] {
		return (value || '')
			.split(',')
			.map((item) => this.parseNonNegInt(item))
			.filter((item) => item > 0);
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

				const c = this.creatureTemplateService.createManualCreature({
					id,
					name: d.name || `Creature #${id + 1}`,
					initiative: d.initiative,
					hp,
					armorClass: d.ac || '',
					category: 'monster',
				});

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

	getAbilityDraft(id: number): AbilityDraft {
		return (
			this.abilityDrafts()[id] ?? {
				name: '',
				description: '',
				rechargeType: 'manual',
				cooldownValue: 1,
				rechargeOn: '5,6',
			}
		);
	}

	setAbilityDraft(id: number, patch: Partial<AbilityDraft>) {
		this.abilityDrafts.update((drafts) => ({
			...drafts,
			[id]: {
				...this.getAbilityDraft(id),
				...patch,
			},
		}));
	}

	addSpecialAbility(creatureId: number) {
		const draft = this.getAbilityDraft(creatureId);
		const name = (draft.name || '').trim();
		if (!name) {
			this.showToast({ type: 'warn', text: 'Defina um nome para a habilidade.' });
			return;
		}

		const ability: CreatureSpecialAbility = {
			id: crypto.randomUUID(),
			name,
			description: (draft.description || '').trim() || undefined,
			rechargeType: draft.rechargeType,
			cooldownTurns:
				draft.rechargeType === 'turns' ? Math.max(1, this.parseNonNegInt(draft.cooldownValue)) : undefined,
			cooldownRounds:
				draft.rechargeType === 'rounds' ? Math.max(1, this.parseNonNegInt(draft.cooldownValue)) : undefined,
			rechargeDice: draft.rechargeType === 'dice' ? 'd6' : undefined,
			rechargeOn:
				draft.rechargeType === 'dice' ? this.parseRechargeOnInput(draft.rechargeOn) : undefined,
		};

		this.encounter.update((e) => {
			const next = structuredClone(e);
			const c = next.creatures.find((x) => x.id === creatureId);
			if (!c) return e;
			c.specialAbilities = [...(c.specialAbilities ?? []), ability];
			return next;
		});

		this.setAbilityDraft(creatureId, {
			name: '',
			description: '',
			rechargeType: 'manual',
			cooldownValue: 1,
			rechargeOn: '5,6',
		});
	}

	updateSpecialAbility(creatureId: number, abilityId: string, patch: Partial<CreatureSpecialAbility>) {
		this.encounter.update((e) => {
			const next = structuredClone(e);
			const c = next.creatures.find((x) => x.id === creatureId);
			if (!c) return e;
			c.specialAbilities = (c.specialAbilities ?? []).map((ability) =>
				ability.id === abilityId ? { ...ability, ...patch } : ability
			);
			return next;
		});
	}

	removeSpecialAbility(creatureId: number, abilityId: string) {
		this.encounter.update((e) => {
			const next = structuredClone(e);
			const c = next.creatures.find((x) => x.id === creatureId);
			if (!c) return e;
			c.specialAbilities = (c.specialAbilities ?? []).filter((ability) => ability.id !== abilityId);
			return next;
		});
	}

	abilityStatusPreview(ability: CreatureSpecialAbility): string {
		if (ability.rechargeType === 'turns') {
			const turns = Math.max(1, ability.cooldownTurns ?? 1);
			return turns === 1 ? 'Volta em 1 turno' : `Volta em ${turns} turnos`;
		}
		if (ability.rechargeType === 'rounds') {
			const rounds = Math.max(1, ability.cooldownRounds ?? 1);
			return rounds === 1 ? 'Volta em 1 round' : `Volta em ${rounds} rounds`;
		}
		if (ability.rechargeType === 'dice') {
			const targets = ability.rechargeOn?.length ? ability.rechargeOn.join('–') : '5–6';
			return `Recharge ${targets}`;
		}
		return 'Recarga manual';
	}

	downloadExport() {
		this.io.download(this.encounter(), this.title());
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

			this.router.navigate(['/home/encounter-builder', saved.id], {
				state: { toast: { type: 'success', text: 'Encounter saved' } },
			});

			return;
		}

		this.ls.updateEncounter(id, { title, data: structuredClone(data) });
		this.showToast({ type: 'success', text: 'Encounter updated' });
	}

	constructor() {
		const navToast =
			(this.router.getCurrentNavigation()?.extras.state as any)?.toast ??
			(history.state?.toast as any);

		if (navToast?.type && navToast?.text) {
			this.showToast(navToast);
		}

		const id = this.route.snapshot.paramMap.get('id');
		if (id) {
			const item = this.ls.getEncounter(id);
			if (item) {
				this.savedId.set(id);
				this.title.set(item.title);
				this.encounter.set({
					...structuredClone(item.data),
					creatures: structuredClone(item.data.creatures ?? []).map((creature) => ({
						...creature,
						spells: creature.spells ?? {},
						totalSpellSlots: creature.totalSpellSlots ?? null,
						usedSpellSlots: creature.usedSpellSlots ?? null,
						specialAbilities: Array.isArray(creature.specialAbilities) ? creature.specialAbilities : [],
					})),
				});
			}
		}

		effect(() => console.log(this.encounter()));
		this.refreshHomebrewSheets();
	}
}
