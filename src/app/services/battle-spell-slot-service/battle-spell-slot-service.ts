import { Injectable } from '@angular/core';
import type { BattleSpellSlotLevel } from '../../models/battle-encounter-model';

@Injectable({ providedIn: 'root' })
export class BattleSpellSlotService {
	createDefaultSpellSlots(): BattleSpellSlotLevel[] {
		return Array.from({ length: 9 }, (_, index) => ({
			level: index + 1,
			max: 0,
			used: 0,
		}));
	}

	normalizeSpellSlots(raw: unknown): BattleSpellSlotLevel[] {
		if (!Array.isArray(raw)) return [];

		const normalized = raw
			.map((slot, index) => {
				const candidate = slot as Partial<BattleSpellSlotLevel>;
				const level = this.toPositiveInt(candidate.level) ?? index + 1;
				const max = this.toNonNegativeInt(candidate.max);
				const used = Math.min(max, this.toNonNegativeInt(candidate.used));

				return { level, max, used };
			})
			.sort((left, right) => left.level - right.level);

		return normalized;
	}

	ensureSpellSlots(spellSlots: BattleSpellSlotLevel[]): BattleSpellSlotLevel[] {
		if (spellSlots.length) return spellSlots;
		return this.createDefaultSpellSlots();
	}

	setSlotMax(spellSlots: BattleSpellSlotLevel[], level: number, max: number): BattleSpellSlotLevel[] {
		return this.ensureSpellSlots(spellSlots).map((slot) => {
			if (slot.level !== level) return slot;
			const nextMax = this.toNonNegativeInt(max);
			return {
				...slot,
				max: nextMax,
				used: Math.min(slot.used, nextMax),
			};
		});
	}

	useSlot(spellSlots: BattleSpellSlotLevel[], level: number): BattleSpellSlotLevel[] {
		return this.ensureSpellSlots(spellSlots).map((slot) => {
			if (slot.level !== level) return slot;
			return {
				...slot,
				used: Math.min(slot.max, slot.used + 1),
			};
		});
	}

	recoverSlot(spellSlots: BattleSpellSlotLevel[], level: number): BattleSpellSlotLevel[] {
		return this.ensureSpellSlots(spellSlots).map((slot) => {
			if (slot.level !== level) return slot;
			return {
				...slot,
				used: Math.max(0, slot.used - 1),
			};
		});
	}

	setUsed(spellSlots: BattleSpellSlotLevel[], level: number, used: number): BattleSpellSlotLevel[] {
		return this.ensureSpellSlots(spellSlots).map((slot) => {
			if (slot.level !== level) return slot;
			const nextUsed = this.toNonNegativeInt(used);
			return {
				...slot,
				used: Math.min(slot.max, nextUsed),
			};
		});
	}

	getAvailable(slot: BattleSpellSlotLevel): number {
		return Math.max(0, slot.max - slot.used);
	}

	private toPositiveInt(value: unknown): number | undefined {
		const numeric = this.toNonNegativeInt(value);
		return numeric > 0 ? numeric : undefined;
	}

	private toNonNegativeInt(value: unknown): number {
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) return 0;
		return Math.max(0, Math.floor(numeric));
	}
}
