import { Injectable } from '@angular/core';
import { BattleTracker, CreatureInterface } from '../../models/battleTracker-model';

@Injectable({ providedIn: 'root' })
export class EncounterIoService {
	private readonly VERSION = '5.123.0' as const;

	toExportObject(encounter: BattleTracker) {
		const e = encounter;

		return {
			creatures: (e.creatures ?? []).map((c: CreatureInterface) => ({
				name: c.name,
				initiative: c.initiative,

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
			})),

			creatureIdCount: e.creatureIdCount,
			activeCreature: null,
			round: e.round,
			battleCreated: e.battleCreated,

			shareEnabled: false,
			battleTrackerVersion: this.VERSION,
			sharedTimestamp: null,
			loaded: true,
		};
	}

	toJson(encounter: BattleTracker) {
		return JSON.stringify(this.toExportObject(encounter), null, 2);
	}

	download(encounter: BattleTracker) {
		const json = this.toJson(encounter);
		const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
		const url = URL.createObjectURL(blob);

		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const filename = `encounter-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
			d.getDate()
		)}.json`;

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
}
