import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';
import type { SpellReference } from '../../models/spell-reference-model';
import type { BattleCombatant } from '../../models/battle-encounter-model';
import { ReferenceOverlayService } from './reference-overlay-service';

@Directive({ selector: '[appSpellReference]', standalone: true })
export class SpellReferenceTriggerDirective {
	@Input({ required: true }) appSpellReference!: SpellReference;
	private readonly overlay = inject(ReferenceOverlayService);
	private readonly element = inject(ElementRef<HTMLElement>);

	@HostListener('pointerenter') preview() { this.overlay.peekSpell(this.appSpellReference, this.element.nativeElement); }
	@HostListener('focus') previewFocus() { this.overlay.peekSpell(this.appSpellReference, this.element.nativeElement); }
	@HostListener('pointerleave') leave() { this.overlay.schedulePeekClose(); }
	@HostListener('blur') blur() { this.overlay.schedulePeekClose(); }
	@HostListener('click', ['$event']) open(event: Event) { event.preventDefault(); this.overlay.openSpell(this.appSpellReference); }
	@HostListener('keydown', ['$event']) keydown(event: KeyboardEvent) {
		if (event.key === 'Escape') this.overlay.closePeek();
		if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.overlay.openSpell(this.appSpellReference); }
	}
}

@Directive({ selector: '[appConditionReference]', standalone: true })
export class ConditionReferenceTriggerDirective {
	@Input({ required: true }) appConditionReference!: string;
	private readonly overlay = inject(ReferenceOverlayService);
	private readonly element = inject(ElementRef<HTMLElement>);

	@HostListener('pointerenter') preview() { this.overlay.peekCondition(this.appConditionReference, this.element.nativeElement); }
	@HostListener('focus') previewFocus() { this.overlay.peekCondition(this.appConditionReference, this.element.nativeElement); }
	@HostListener('pointerleave') leave() { this.overlay.schedulePeekClose(); }
	@HostListener('blur') blur() { this.overlay.schedulePeekClose(); }
	@HostListener('click', ['$event']) open(event: Event) { event.preventDefault(); this.overlay.openCondition(this.appConditionReference); }
	@HostListener('keydown', ['$event']) keydown(event: KeyboardEvent) {
		if (event.key === 'Escape') this.overlay.closePeek();
		if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.overlay.openCondition(this.appConditionReference); }
	}
}

@Directive({ selector: '[appDefenseReference]', standalone: true })
export class DefenseReferenceTriggerDirective {
	@Input({ required: true }) appDefenseReference!: BattleCombatant;
	private readonly overlay = inject(ReferenceOverlayService);
	private readonly element = inject(ElementRef<HTMLElement>);

	@HostListener('pointerenter') preview() { this.overlay.peekDefense(this.appDefenseReference, this.element.nativeElement); }
	@HostListener('focus') previewFocus() { this.overlay.peekDefense(this.appDefenseReference, this.element.nativeElement); }
	@HostListener('pointerleave') leave() { this.overlay.schedulePeekClose(); }
	@HostListener('blur') blur() { this.overlay.schedulePeekClose(); }
	@HostListener('click', ['$event']) open(event: Event) { event.preventDefault(); this.overlay.openDefense(this.appDefenseReference); }
	@HostListener('keydown', ['$event']) keydown(event: KeyboardEvent) {
		if (event.key === 'Escape') this.overlay.closePeek();
		if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.overlay.openDefense(this.appDefenseReference); }
	}
}
