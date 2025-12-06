import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { encounterBase } from '../../utils/base-file/encounter-base';
import type { BattleTracker, CreatureInterface } from '../../models/battleTracker-model';

type DraftCreature = {
	name: string;
	initiative: number | null;
	hp: number | null;
	maxHp: number | null;
	ac: string;
	quantity: number;
};

@Component({
	selector: 'app-encounter-builder',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './encounter-builder.html',
})
export class EncounterBuilder {
	encounter = signal<BattleTracker>(structuredClone(encounterBase));

	draft = signal<DraftCreature>({
		name: '',
		initiative: null,
		hp: null,
		maxHp: null,
		ac: '',
		quantity: 1,
	});

	creatures = computed(() => this.encounter().creatures);

	trackByCreatureId = (_: number, c: CreatureInterface) => c.id;

	private parseNullableNumber(v: any): number | null {
		if (v === '' || v === null || v === undefined) return null;
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	}

	setDraftName(v: string) {
		this.draft.update((d) => ({ ...d, name: v }));
	}
	setDraftInitiative(v: any) {
		this.draft.update((d) => ({ ...d, initiative: this.parseNullableNumber(v) }));
	}
	setDraftHp(v: any) {
		const hp = this.parseNullableNumber(v);
		this.draft.update((d) => ({
			...d,
			hp,
			maxHp: hp,
		}));
	}

	setDraftMaxHp(v: any) {
		this.draft.update((d) => ({ ...d, maxHp: this.parseNullableNumber(v) }));
	}
	setDraftAc(v: string) {
		this.draft.update((d) => ({ ...d, ac: v }));
	}
	setDraftQty(v: any) {
		const n = Math.max(1, Math.floor(Number(v) || 1));
		this.draft.update((d) => ({ ...d, quantity: n }));
	}

	addCreatures() {
		const d = this.draft();
		const qty = Math.max(1, Math.floor(d.quantity || 1));

		this.encounter.update((e) => {
			const next = structuredClone(e);

			for (let i = 0; i < qty; i++) {
				const id = next.creatureIdCount;

				const c: CreatureInterface = {
					name: d.name || `Creature #${id + 1}`,
					initiative: d.initiative,

					healthPoints: d.hp!,
					maxHealthPoints: d.hp!,
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

			// fixos do teu export
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
}
