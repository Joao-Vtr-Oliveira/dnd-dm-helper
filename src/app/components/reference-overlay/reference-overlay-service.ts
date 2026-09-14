import { Injectable, Injector, signal } from '@angular/core';
import type { CompendiumSpell } from '../../models/compendium-spell-model';
import type { BattleCombatant } from '../../models/battle-encounter-model';
import { conditionReferenceFor, type ConditionReference } from '../../models/condition-reference-model';
import type { SpellReference } from '../../models/spell-reference-model';
import { SpellReferenceResolverService } from '../../services/spell-reference-resolver-service/spell-reference-resolver-service';

export type ReferenceView =
	| { kind: 'spell'; name: string; spell: CompendiumSpell | null; loading: boolean }
	| { kind: 'condition'; name: string; condition: ConditionReference; loading: false }
	| { kind: 'defense'; name: string; combatant: BattleCombatant; loading: false };

export type PeekReferenceView = ReferenceView & { anchor: HTMLElement };

@Injectable({ providedIn: 'root' })
export class ReferenceOverlayService {
	readonly peek = signal<PeekReferenceView | null>(null);
	readonly floating = signal<ReferenceView | null>(null);
	readonly modal = signal<ReferenceView | null>(null);

	private readonly pendingSpells = new Map<string, Promise<CompendiumSpell | null>>();
	private peekTimer: ReturnType<typeof setTimeout> | null = null;
	private closeTimer: ReturnType<typeof setTimeout> | null = null;
	private requestId = 0;

	constructor(private readonly injector: Injector) {}

	peekSpell(reference: SpellReference, anchor: HTMLElement) {
		this.clearPeekTimers();
		this.peekTimer = setTimeout(() => {
			const view: PeekReferenceView = {
				kind: 'spell', name: reference.name, spell: null, loading: true, anchor,
			};
			this.peek.set(view);
			const requestId = ++this.requestId;
			void this.resolveSpell(reference).then((spell) => {
				if (requestId === this.requestId && this.peek()?.anchor === anchor) {
					this.peek.set({ ...view, spell, loading: false });
				}
			});
		}, 150);
	}

	peekCondition(name: string, anchor: HTMLElement) {
		this.clearPeekTimers();
		this.peekTimer = setTimeout(() => {
			const condition = conditionReferenceFor(name);
			this.peek.set({ kind: 'condition', name: condition.label, condition, loading: false, anchor });
		}, 150);
	}

	openSpell(reference: SpellReference) {
		this.clearPeekTimers();
		this.peek.set(null);
		const view: ReferenceView = { kind: 'spell', name: reference.name, spell: null, loading: true };
		this.floating.set(view);
		const requestId = ++this.requestId;
		void this.resolveSpell(reference).then((spell) => {
			if (requestId === this.requestId && this.floating()?.kind === 'spell') {
				this.floating.set({ ...view, spell, loading: false });
			}
		});
	}

	openCondition(name: string) {
		this.clearPeekTimers();
		this.peek.set(null);
		const condition = conditionReferenceFor(name);
		this.floating.set({ kind: 'condition', name: condition.label, condition, loading: false });
	}

	peekDefense(combatant: BattleCombatant, anchor: HTMLElement) {
		this.clearPeekTimers();
		this.peekTimer = setTimeout(() => {
			this.peek.set({ kind: 'defense', name: 'Defesas', combatant, loading: false, anchor });
		}, 150);
	}

	openDefense(combatant: BattleCombatant) {
		this.clearPeekTimers();
		this.peek.set(null);
		this.floating.set({ kind: 'defense', name: 'Defesas', combatant, loading: false });
	}

	schedulePeekClose() {
		if (this.peekTimer) clearTimeout(this.peekTimer);
		this.closeTimer = setTimeout(() => this.peek.set(null), 140);
	}

	keepPeekOpen() {
		if (this.closeTimer) clearTimeout(this.closeTimer);
	}

	closePeek() {
		this.clearPeekTimers();
		this.peek.set(null);
	}

	closeFloating() {
		this.floating.set(null);
	}

	openModal() {
		const reference = this.floating();
		if (reference && !reference.loading) this.modal.set(reference);
	}

	closeModal() {
		this.modal.set(null);
	}

	private async resolveSpell(reference: SpellReference): Promise<CompendiumSpell | null> {
		const key = `${reference.source ?? ''}:${reference.name}`.toLocaleLowerCase();
		let pending = this.pendingSpells.get(key);
		if (!pending) {
			pending = this.injector
				.get(SpellReferenceResolverService)
				.resolveReference(reference)
				.then((resolved) => resolved?.spell ?? null);
			this.pendingSpells.set(key, pending);
		}
		return pending;
	}

	private clearPeekTimers() {
		if (this.peekTimer) clearTimeout(this.peekTimer);
		if (this.closeTimer) clearTimeout(this.closeTimer);
		this.peekTimer = null;
		this.closeTimer = null;
	}
}
