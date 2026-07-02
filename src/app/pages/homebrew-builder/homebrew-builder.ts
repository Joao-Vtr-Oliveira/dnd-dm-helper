import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import {
	HomebrewCategory,
	LocalStorageService,
} from '../../services/local-storage-service/local-storage-service';
import type {
	CreatureInterface,
	CreatureSpecialAbility,
	CreatureAbilityRechargeType,
	SpellLevel,
	SpellInterface,
	SpellSlots,
	SpellsByKey,
} from '../../models/battleTracker-model';

type SpellDraft = { label: string; total: number };
type AbilityDraft = {
	name: string;
	description: string;
	rechargeType: CreatureAbilityRechargeType;
	cooldownValue: number;
	rechargeOn: string;
};

function createEmptyCreature(): CreatureInterface {
	return {
		name: '',
		initiative: null,
		healthPoints: 0,
		maxHealthPoints: 0,
		armorClass: '',
		temporaryHealthPoints: null,
		id: 0,
		alive: true,
		conditions: [],
		notes: [],
		shared: true,
		hitPointsShared: true,
		totalSpellSlots: null,
		usedSpellSlots: null,
		spells: {},
		specialAbilities: [],
		category: 'monster',
	};
}

function normalizeCreature(raw: CreatureInterface): CreatureInterface {
	return {
		...structuredClone(raw),
		conditions: Array.isArray(raw.conditions) ? raw.conditions : [],
		notes: Array.isArray(raw.notes) ? raw.notes : [],
		spells: raw.spells ?? {},
		totalSpellSlots: raw.totalSpellSlots ?? null,
		usedSpellSlots: raw.usedSpellSlots ?? null,
		specialAbilities: Array.isArray(raw.specialAbilities) ? raw.specialAbilities : [],
	};
}

@Component({
	selector: 'app-homebrew-builder',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './homebrew-builder.html',
})
export class HomebrewBuilder {
	private ls = inject(LocalStorageService);
	private route = inject(ActivatedRoute);
	private router = inject(Router);

	sheetId = signal<string | null>(null);
	title = signal<string>('');
	creature = signal<CreatureInterface>(createEmptyCreature());

	category = signal<HomebrewCategory>('monster');
	tagsText = signal<string>('');
	source = signal<string>('');

	// draft de magia nova
	spellDraft = signal<SpellDraft>({ label: '', total: 1 });
	abilityDraft = signal<AbilityDraft>({
		name: '',
		description: '',
		rechargeType: 'manual',
		cooldownValue: 1,
		rechargeOn: '5,6',
	});

	SPELL_LEVELS: SpellLevel[] = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

	toast = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
	private toastTimer: number | null = null;

	constructor() {
		const id = this.route.snapshot.paramMap.get('id');
		if (id) {
			const sheet = this.ls.getSheet(id);
				if (sheet) {
					this.sheetId.set(id);
					this.title.set(sheet.title);
					this.creature.set({
						...normalizeCreature(sheet.data),
						category: sheet.category ?? sheet.data.category ?? 'monster',
					});

				// 👇 popula meta
				this.category.set(sheet.category ?? 'monster');
				this.tagsText.set((sheet.tags ?? []).join(', '));
				this.source.set(sheet.source ?? '');
			}
		}
	}

	// -------- toast --------
	private showToast(t: { type: 'success' | 'error' | 'warn'; text: string }, ms = 2200) {
		if (this.toastTimer) window.clearTimeout(this.toastTimer);
		this.toast.set(t);
		this.toastTimer = window.setTimeout(() => this.toast.set(null), ms);
	}

	// -------- helpers numéricos / slug --------
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

	// -------- setters básicos --------
	setName(v: string) {
		this.creature.update((c) => ({ ...c, name: v }));
	}

	setHp(v: any) {
		const n = this.parseNonNegInt(v);
		this.creature.update((c) => ({
			...c,
			healthPoints: n,
			maxHealthPoints: n,
		}));
	}

	setMaxHp(v: any) {
		const n = this.parseNonNegInt(v);
		this.creature.update((c) => ({ ...c, maxHealthPoints: n }));
	}

	setAc(v: string) {
		this.creature.update((c) => ({ ...c, armorClass: v }));
	}

	setInitiative(v: any) {
		if (v === '' || v === null || v === undefined) {
			this.creature.update((c) => ({ ...c, initiative: null }));
			return;
		}
		const n = Number(v);
		this.creature.update((c) => ({
			...c,
			initiative: Number.isFinite(n) ? n : null,
		}));
	}

	// -------- spellcasting --------
	enableSpellcasting() {
		this.creature.update((c) => ({
			...c,
			totalSpellSlots: {},
			usedSpellSlots: {},
		}));
	}

	slotValue(slots: SpellSlots | null, level: SpellLevel): number | null {
		if (!slots) return null;
		const v = slots[level];
		return typeof v === 'number' ? v : null;
	}

	setSpellSlot(kind: 'total' | 'used', level: SpellLevel, v: any) {
		const value = this.parseNonNegInt(v);

		this.creature.update((c) => {
			const total = (c.totalSpellSlots ?? {}) as SpellSlots;
			const used = (c.usedSpellSlots ?? {}) as SpellSlots;

			if (kind === 'total') {
				const hadTotal = typeof total[level] === 'number';
				total[level] = value;
				if (!hadTotal) used[level] = 0;

				const usedVal = used[level] ?? 0;
				if (usedVal > value) used[level] = value;

				return { ...c, totalSpellSlots: total, usedSpellSlots: used };
			} else {
				const max = total[level] ?? value;
				used[level] = Math.min(value, max);
				return { ...c, usedSpellSlots: used };
			}
		});
	}

	spellEntries(spells: SpellsByKey): Array<{ key: string; value: SpellInterface }> {
		return Object.entries(spells || {}).map(([key, value]) => ({ key, value }));
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

	setSpellDraft(patch: Partial<SpellDraft>) {
		this.spellDraft.update((d) => ({ ...d, ...patch }));
	}

	addSpell() {
		const d = this.spellDraft();
		const label = (d.label || '').trim();
		const total = this.parseNonNegInt(d.total);
		if (!label) return;

		this.creature.update((c) => {
			const spells = { ...(c.spells ?? {}) } as SpellsByKey;
			const key = this.uniqueSpellKey(spells, label);
			spells[key] = { label, total };
			return { ...c, spells };
		});

		this.spellDraft.set({ label: '', total: 1 });
	}

	updateSpell(key: string, patch: Partial<SpellInterface>) {
		this.creature.update((c) => {
			const curr = c.spells?.[key];
			if (!curr) return c;
			return {
				...c,
				spells: {
					...c.spells,
					[key]: { ...curr, ...patch },
				},
			};
		});
	}

	removeSpell(key: string) {
		this.creature.update((c) => {
			const clone = { ...(c.spells ?? {}) } as SpellsByKey;
			delete clone[key];
			return { ...c, spells: clone };
		});
	}

	// -------- special abilities --------
	setAbilityDraft(patch: Partial<AbilityDraft>) {
		this.abilityDraft.update((draft) => ({ ...draft, ...patch }));
	}

	addSpecialAbility() {
		const draft = this.abilityDraft();
		const name = (draft.name || '').trim();
		if (!name) {
			this.showToast({ type: 'warn', text: 'Defina um nome para a habilidade.' });
			return;
		}

		const rechargeOn = (draft.rechargeOn || '')
			.split(',')
			.map((value) => this.parseNonNegInt(value))
			.filter((value) => value > 0);

		const ability: CreatureSpecialAbility = {
			id: crypto.randomUUID(),
			name,
			description: (draft.description || '').trim() || undefined,
			rechargeType: draft.rechargeType,
			cooldownTurns: draft.rechargeType === 'turns' ? Math.max(1, this.parseNonNegInt(draft.cooldownValue)) : undefined,
			cooldownRounds: draft.rechargeType === 'rounds' ? Math.max(1, this.parseNonNegInt(draft.cooldownValue)) : undefined,
			rechargeDice: draft.rechargeType === 'dice' ? 'd6' : undefined,
			rechargeOn: draft.rechargeType === 'dice' ? rechargeOn : undefined,
		};

		this.creature.update((creature) => ({
			...creature,
			specialAbilities: [...(creature.specialAbilities ?? []), ability],
		}));

		this.abilityDraft.set({
			name: '',
			description: '',
			rechargeType: 'manual',
			cooldownValue: 1,
			rechargeOn: '5,6',
		});
	}

	updateSpecialAbility(id: string, patch: Partial<CreatureSpecialAbility>) {
		this.creature.update((creature) => ({
			...creature,
			specialAbilities: (creature.specialAbilities ?? []).map((ability) =>
				ability.id === id ? { ...ability, ...patch } : ability
			),
		}));
	}

	removeSpecialAbility(id: string) {
		this.creature.update((creature) => ({
			...creature,
			specialAbilities: (creature.specialAbilities ?? []).filter((ability) => ability.id !== id),
		}));
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

	setTempHp(v: any) {
		if (v === '' || v === null || v === undefined) {
			this.creature.update((c) => ({ ...c, temporaryHealthPoints: null }));
			return;
		}

		const n = this.parseNonNegInt(v);
		this.creature.update((c) => ({ ...c, temporaryHealthPoints: n }));
	}

	// -------- salvar sheet --------
	save() {
		const title = this.title().trim() || this.creature().name;
		const category = this.category();
		const data = { ...this.creature(), category };

		if (!data.name.trim()) {
			this.showToast({ type: 'warn', text: 'Defina um nome para a criatura.' });
			return;
		}

		const rawTags = this.tagsText()
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		const source = this.source().trim();

		const id = this.sheetId();
		if (!id) {
			const saved = this.ls.createSheet({
				title,
				data: structuredClone(data),
				category,
				tags: rawTags,
				source,
			});

			this.sheetId.set(saved.id);
			this.showToast({ type: 'success', text: 'Sheet criada!' });
			this.router.navigate(['/home/homebrew-builder', saved.id]);
		} else {
			this.ls.updateSheet(id, {
				title,
				data: structuredClone(data),
				category,
				tags: rawTags,
				source,
			});
			this.showToast({ type: 'success', text: 'Sheet atualizada.' });
		}
	}

	backToList() {
		this.router.navigate(['/home/homebrew']);
	}
}
