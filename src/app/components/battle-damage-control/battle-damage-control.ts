import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppSelectComponent, type AppSelectOption } from '../app-select/app-select';
import type { BattleCombatant } from '../../models/battle-encounter-model';
import {
	adjustedDamage,
	resolveDamageDefenses,
} from '../../models/battle-damage-defense-model';

const DAMAGE_TYPES: readonly AppSelectOption[] = [
	{ value: 'acid', label: 'Ácido' },
	{ value: 'bludgeoning', label: 'Contundente' },
	{ value: 'cold', label: 'Frio' },
	{ value: 'fire', label: 'Fogo' },
	{ value: 'force', label: 'Força' },
	{ value: 'lightning', label: 'Elétrico' },
	{ value: 'necrotic', label: 'Necrótico' },
	{ value: 'piercing', label: 'Perfurante' },
	{ value: 'poison', label: 'Veneno' },
	{ value: 'psychic', label: 'Psíquico' },
	{ value: 'radiant', label: 'Radiante' },
	{ value: 'slashing', label: 'Cortante' },
	{ value: 'thunder', label: 'Trovão' },
];

@Component({
	selector: 'app-battle-damage-control',
	standalone: true,
	imports: [AppSelectComponent, FormsModule],
	templateUrl: './battle-damage-control.html',
	styles: [':host { display: block; }'],
})
export class BattleDamageControlComponent {
	@Input({ required: true }) combatant!: BattleCombatant;
	@Input() amount = '';
	@Input() damageType = '';
	@Input() compact = false;
	@Input() showDamageTypeLabel = true;
	@Input() quickTypePicker = false;
	@Input() testId = '';
	@Output() amountChange = new EventEmitter<string>();
	@Output() damageTypeChange = new EventEmitter<string>();
	@Output() apply = new EventEmitter<number>();

	readonly damageTypes = DAMAGE_TYPES;
	private readonly element = inject(ElementRef<HTMLElement>);
	typeMenuOpen = false;
	get rawAmount() {
		const amount = Number.parseInt(this.amount, 10);
		return Number.isFinite(amount) && amount > 0 ? amount : 0;
	}

	get defenses() { return resolveDamageDefenses(this.combatant, this.damageType); }

	setAmount(value: string) { this.amountChange.emit(value); }
	setDamageType(value: string) { this.damageTypeChange.emit(value); }
	chooseDamageType(value: string) {
		this.setDamageType(value);
		this.typeMenuOpen = false;
	}

	selectedDamageTypeLabel() {
		return this.damageTypes.find((type) => type.value === this.damageType)?.label ?? 'Tipo de dano';
	}

	@HostListener('document:pointerdown', ['$event'])
	onDocumentPointerDown(event: PointerEvent) {
		if (event.target instanceof Node && !this.element.nativeElement.contains(event.target)) {
			this.typeMenuOpen = false;
		}
	}

	@HostListener('document:keydown.escape') closeTypeMenu() { this.typeMenuOpen = false; }

	applyDamage(multiplier: 0 | 0.5 | 1 | 2 = 1) {
		const amount = adjustedDamage(this.rawAmount, multiplier);
		if (!amount && multiplier !== 0) return;
		this.apply.emit(amount);
	}

	buttonLabel(multiplier: 0 | 0.5 | 1 | 2) {
		const amount = adjustedDamage(this.rawAmount, multiplier);
		return multiplier === 1 ? `Aplicar dano${amount ? ` (${amount})` : ''}` : `${multiplier === 0.5 ? '½' : multiplier === 2 ? '×2' : '0'}${this.rawAmount ? ` (${amount})` : ''}`;
	}

	defenseLabels() { return this.defenses.matches.map((match) => match.label).join(', '); }
	hasConditionalDefense() { return this.defenses.matches.some((match) => Boolean(match.note)); }
	adjustedDamage(amount: number, multiplier: 0 | 0.5 | 1 | 2) {
		return adjustedDamage(amount, multiplier);
	}
}
