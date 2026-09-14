import { Component, Input } from '@angular/core';
import type { BattleCombatant } from '../../models/battle-encounter-model';
import type { CreatureDamageDefense } from '../../models/creature-sheet-model';

@Component({
	selector: 'app-damage-defense-reference-content',
	standalone: true,
	templateUrl: './damage-defense-reference-content.html',
})
export class DamageDefenseReferenceContentComponent {
	@Input({ required: true }) combatant!: BattleCombatant;

	defenseLines(defenses: CreatureDamageDefense[] | undefined) {
		return defenses ?? [];
	}
}
