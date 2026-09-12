import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, CanDeactivateFn, Router } from '@angular/router';
import {
	LucideCircleAlert,
	LucideCircleCheck,
	LucideTriangleAlert,
	LucideX,
} from '@lucide/angular';

import {
	HomebrewCategory,
	LocalStorageService,
} from '../../services/local-storage-service/local-storage-service';
import type {
	CreatureAbilityRecoveryType,
	CreatureSheet,
	CreatureSpecialAbility,
} from '../../models/creature-sheet-model';

type SpellDraft = { name: string; uses: number; level: number };
type AbilityDraft = {
	name: string;
	description: string;
	recoveryType: CreatureAbilityRecoveryType;
	maxUses: number;
	cooldownValue: number;
	rechargeOn: string;
};

function createEmptyCreature(): CreatureSheet {
	return {
		name: '',
		maxHp: 0,
		armorClass: '',
		spellSlots: [],
		spells: [],
		specialAbilities: [],
		features: [],
	};
}

function normalizeCreature(raw: CreatureSheet): CreatureSheet {
	return {
		...createEmptyCreature(),
		...structuredClone(raw),
		spellSlots: Array.isArray(raw.spellSlots) ? raw.spellSlots : [],
		spells: Array.isArray(raw.spells) ? raw.spells : [],
		specialAbilities: Array.isArray(raw.specialAbilities) ? raw.specialAbilities : [],
		features: Array.isArray(raw.features) ? raw.features : [],
		rawFiveETools:
			raw.rawFiveETools &&
			typeof raw.rawFiveETools === 'object' &&
			!Array.isArray(raw.rawFiveETools)
				? structuredClone(raw.rawFiveETools)
				: undefined,
		fiveEToolsIdentity: raw.fiveEToolsIdentity
			? structuredClone(raw.fiveEToolsIdentity)
			: undefined,
	};
}

@Component({
	selector: 'app-homebrew-builder',
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		LucideCircleAlert,
		LucideCircleCheck,
		LucideTriangleAlert,
		LucideX,
	],
	templateUrl: './homebrew-builder.html',
})
export class HomebrewBuilder {
	private ls = inject(LocalStorageService);
	private route = inject(ActivatedRoute);
	private router = inject(Router);

	sheetId = signal<string | null>(null);
	title = signal<string>('');
	creature = signal<CreatureSheet>(createEmptyCreature());
	private lastAutoCreatureName = signal<string>('');

	category = signal<HomebrewCategory>('monster');
	tagsText = signal<string>('');
	source = signal<string>('');

	// draft de magia nova
	spellDraft = signal<SpellDraft>({ name: '', uses: 1, level: 0 });
	abilityDraft = signal<AbilityDraft>({
		name: '',
		description: '',
		recoveryType: 'manual',
		maxUses: 1,
		cooldownValue: 1,
		rechargeOn: '5,6',
	});

	SPELL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

	toast = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
	unsavedChangesModal = signal(false);
	private savedSnapshot = signal('');
	private pendingNavigationResolver: ((allowed: boolean) => void) | null = null;
	private toastTimer: number | null = null;

	readonly hasUnsavedChanges = computed(
		() =>
			JSON.stringify({
				title: this.title(),
				creature: this.creature(),
				category: this.category(),
				tagsText: this.tagsText(),
				source: this.source(),
			}) !== this.savedSnapshot(),
	);

	constructor() {
		const id = this.route.snapshot.paramMap.get('id');
		if (id) {
			const sheet = this.ls.getSheet(id);
			if (sheet) {
				this.sheetId.set(id);
				this.title.set(sheet.title);
				this.creature.set(normalizeCreature(sheet.data));
				this.lastAutoCreatureName.set(sheet.data.name === sheet.title ? sheet.title : '');

				// 👇 popula meta
				this.category.set(sheet.category ?? 'monster');
				this.tagsText.set((sheet.tags ?? []).join(', '));
				this.source.set(sheet.source ?? '');
			}
		}
		this.markSaved();
	}

	@HostListener('window:beforeunload', ['$event'])
	onBeforeUnload(event: BeforeUnloadEvent) {
		if (!this.hasUnsavedChanges()) return;
		event.preventDefault();
		event.returnValue = '';
	}

	canDeactivate(): boolean | Promise<boolean> {
		if (!this.hasUnsavedChanges()) return true;
		this.unsavedChangesModal.set(true);
		return new Promise((resolve) => {
			this.pendingNavigationResolver = resolve;
		});
	}

	stayOnPage() {
		this.unsavedChangesModal.set(false);
		this.resolvePendingNavigation(false);
	}

	discardChanges() {
		this.unsavedChangesModal.set(false);
		this.resolvePendingNavigation(true);
	}

	// -------- toast --------
	private showToast(t: { type: 'success' | 'error' | 'warn'; text: string }, ms = 2200) {
		if (this.toastTimer) window.clearTimeout(this.toastTimer);
		this.toast.set(t);
		this.toastTimer = window.setTimeout(() => this.toast.set(null), ms);
	}

	private markSaved() {
		this.savedSnapshot.set(
			JSON.stringify({
				title: this.title(),
				creature: this.creature(),
				category: this.category(),
				tagsText: this.tagsText(),
				source: this.source(),
			}),
		);
	}

	private resolvePendingNavigation(allowed: boolean) {
		const resolve = this.pendingNavigationResolver;
		this.pendingNavigationResolver = null;
		resolve?.(allowed);
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

	// -------- setters básicos --------
	setTitle(v: string) {
		const currentName = this.creature().name;
		const previousAutoName = this.lastAutoCreatureName();
		const shouldSync = !currentName.trim() || currentName === previousAutoName;

		this.title.set(v);
		if (!shouldSync) return;

		this.creature.update((c) => ({ ...c, name: v }));
		this.lastAutoCreatureName.set(v);
	}

	setName(v: string) {
		this.creature.update((c) => ({ ...c, name: v }));
		if (v === this.title()) {
			this.lastAutoCreatureName.set(v);
		}
	}

	setHp(v: unknown) {
		const n = this.parseNonNegInt(v);
		this.creature.update((c) => ({ ...c, maxHp: n }));
	}

	setAc(v: string) {
		this.creature.update((c) => ({ ...c, armorClass: v }));
	}

	// -------- spellcasting --------
	slotValue(level: number): number | null {
		return this.creature().spellSlots.find((slot) => slot.level === level)?.max ?? null;
	}

	setSpellSlot(level: number, v: unknown) {
		const value = this.parseNonNegInt(v);

		this.creature.update((c) => {
			const spellSlots = c.spellSlots.filter((slot) => slot.level !== level);
			if (value > 0) spellSlots.push({ level, max: value });
			return { ...c, spellSlots: spellSlots.sort((left, right) => left.level - right.level) };
		});
	}

	setSpellDraft(patch: Partial<SpellDraft>) {
		this.spellDraft.update((d) => ({ ...d, ...patch }));
	}

	addSpell() {
		const d = this.spellDraft();
		const name = (d.name || '').trim();
		if (!name) return;

		this.creature.update((c) => {
			return {
				...c,
				spells: [
					...c.spells,
					{
						id: crypto.randomUUID(),
						name,
						uses: this.parseNonNegInt(d.uses),
						level: this.parseNonNegInt(d.level),
					},
				],
			};
		});

		this.spellDraft.set({ name: '', uses: 1, level: 0 });
	}

	updateSpell(id: string, patch: Partial<CreatureSheet['spells'][number]>) {
		this.creature.update((c) => {
			return {
				...c,
				spells: c.spells.map((spell) => (spell.id === id ? { ...spell, ...patch } : spell)),
			};
		});
	}

	removeSpell(id: string) {
		this.creature.update((c) => ({ ...c, spells: c.spells.filter((spell) => spell.id !== id) }));
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
			recoveryType: draft.recoveryType,
			maxUses:
				draft.recoveryType === 'uses-per-day' ||
				draft.recoveryType === 'short-rest' ||
				draft.recoveryType === 'long-rest'
					? Math.max(1, this.parseNonNegInt(draft.maxUses) || 1)
					: undefined,
			cooldownTurns:
				draft.recoveryType === 'turn-cooldown'
					? Math.max(1, this.parseNonNegInt(draft.cooldownValue))
					: undefined,
			cooldownRounds:
				draft.recoveryType === 'round-cooldown'
					? Math.max(1, this.parseNonNegInt(draft.cooldownValue))
					: undefined,
			rechargeDice: draft.recoveryType === 'dice-recharge' ? 'd6' : undefined,
			rechargeOn: draft.recoveryType === 'dice-recharge' ? rechargeOn : undefined,
		};

		this.creature.update((creature) => ({
			...creature,
			specialAbilities: [...(creature.specialAbilities ?? []), ability],
		}));

		this.abilityDraft.set({
			name: '',
			description: '',
			recoveryType: 'manual',
			maxUses: 1,
			cooldownValue: 1,
			rechargeOn: '5,6',
		});
	}

	updateSpecialAbility(id: string, patch: Partial<CreatureSpecialAbility>) {
		this.creature.update((creature) => ({
			...creature,
			specialAbilities: (creature.specialAbilities ?? []).map((ability) =>
				ability.id === id ? { ...ability, ...patch } : ability,
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
		if (ability.recoveryType === 'turn-cooldown') {
			const turns = Math.max(1, ability.cooldownTurns ?? 1);
			return turns === 1 ? 'Volta em 1 turno' : `Volta em ${turns} turnos`;
		}
		if (ability.recoveryType === 'round-cooldown') {
			const rounds = Math.max(1, ability.cooldownRounds ?? 1);
			return rounds === 1 ? 'Volta em 1 round' : `Volta em ${rounds} rounds`;
		}
		if (ability.recoveryType === 'dice-recharge') {
			const targets = ability.rechargeOn?.length ? ability.rechargeOn.join('–') : '5–6';
			return `Recharge ${targets}`;
		}
		if (ability.recoveryType === 'uses-per-day') {
			const uses = Math.max(1, ability.maxUses ?? 1);
			return uses === 1 ? '1 uso por dia' : `${uses} usos por dia`;
		}
		if (ability.recoveryType === 'short-rest') {
			const uses = Math.max(1, ability.maxUses ?? 1);
			return uses === 1 ? '1 uso por descanso curto' : `${uses} usos por descanso curto`;
		}
		if (ability.recoveryType === 'long-rest') {
			const uses = Math.max(1, ability.maxUses ?? 1);
			return uses === 1 ? '1 uso por descanso longo' : `${uses} usos por descanso longo`;
		}
		return 'Recarga manual';
	}

	// -------- salvar sheet --------
	save() {
		const title = this.title().trim() || this.creature().name;
		const category = this.category();
		const data = this.creature();

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
			this.markSaved();
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
			this.markSaved();
			this.showToast({ type: 'success', text: 'Sheet atualizada.' });
		}
	}

	backToList() {
		this.router.navigate(['/home/homebrew']);
	}
}

export const canDeactivateHomebrewBuilder: CanDeactivateFn<HomebrewBuilder> = (component) =>
	component.canDeactivate();
