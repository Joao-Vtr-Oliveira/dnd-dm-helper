import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideExternalLink, LucideMaximize2, LucideMinimize2 } from '@lucide/angular';
import { ConditionReferenceContentComponent } from '../condition-reference-content/condition-reference-content';
import { SpellReferenceContentComponent } from '../spell-reference-content/spell-reference-content';
import { ReferenceOverlayService, type ReferenceView } from './reference-overlay-service';

@Component({
	selector: 'app-reference-overlay',
	standalone: true,
	imports: [
		ConditionReferenceContentComponent,
		LucideExternalLink,
		LucideMaximize2,
		LucideMinimize2,
		SpellReferenceContentComponent,
	],
	templateUrl: './reference-overlay.html',
})
export class ReferenceOverlayComponent {
	readonly overlay = inject(ReferenceOverlayService);
	private readonly router = inject(Router);
	readonly floatingPosition = signal<{ x: number; y: number } | null>(null);
	readonly collapsed = signal(false);
	readonly mobile = signal(typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
	readonly peekStyle = computed(() => {
		const peek = this.overlay.peek();
		if (!peek || typeof window === 'undefined') return {};
		const rect = peek.anchor.getBoundingClientRect();
		const gap = 20;
		const width = Math.min(440, window.innerWidth - 24);
		const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
		const availableAbove = rect.top - gap - 12;
		const availableBelow = window.innerHeight - rect.bottom - gap - 12;
		const maxHeight = Math.min(448, Math.max(120, Math.max(availableAbove, availableBelow)));
		if (availableAbove >= 180 || availableAbove >= availableBelow) {
			return {
				left: `${left}px`,
				bottom: `${Math.max(12, window.innerHeight - rect.top + gap)}px`,
				width: `${width}px`,
				maxHeight: `${maxHeight}px`,
			};
		}
		return {
			left: `${left}px`,
			top: `${Math.max(12, rect.bottom + gap)}px`,
			width: `${width}px`,
			maxHeight: `${maxHeight}px`,
		};
	});

	private drag: { offsetX: number; offsetY: number } | null = null;

	constructor() {
		effect(() => {
			if (!this.overlay.floating()) this.collapsed.set(false);
		});
	}

	windowStyle() {
		if (this.mobile()) return {};
		const position = this.floatingPosition() ?? this.initialPosition();
		return { left: `${position.x}px`, top: `${position.y}px` };
	}

	startDrag(event: PointerEvent) {
		if (
			this.mobile() ||
			event.button !== 0 ||
			(event.target instanceof Element && event.target.closest('button, a, input, select, textarea'))
		)
			return;
		const position = this.floatingPosition() ?? this.initialPosition();
		this.floatingPosition.set(position);
		this.drag = { offsetX: event.clientX - position.x, offsetY: event.clientY - position.y };
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		event.preventDefault();
	}

	@HostListener('window:pointermove', ['$event'])
	moveDrag(event: PointerEvent) {
		if (!this.drag || typeof window === 'undefined') return;
		this.floatingPosition.set({
			x: Math.max(12, Math.min(event.clientX - this.drag.offsetX, window.innerWidth - 320)),
			y: Math.max(12, Math.min(event.clientY - this.drag.offsetY, window.innerHeight - 180)),
		});
	}

	@HostListener('window:pointerup') endDrag() { this.drag = null; }
	@HostListener('window:resize')
	resizeViewport() {
		if (typeof window === 'undefined') return;
		this.mobile.set(window.matchMedia('(max-width: 767px)').matches);
		const position = this.floatingPosition();
		if (position) this.floatingPosition.set({ x: Math.min(position.x, window.innerWidth - 320), y: Math.min(position.y, window.innerHeight - 180) });
	}

	onFloatingFocusEscape(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		this.overlay.closeFloating();
	}

	toggleCollapsed() {
		this.collapsed.update((value) => !value);
	}

	closeFloating() {
		this.overlay.closeFloating();
	}

	openInCompendium(reference: ReferenceView) {
		if (reference.kind !== 'spell' || !reference.spell) return;
		void this.router.navigate(['/home/compendium/spells'], { queryParams: { source: reference.spell.source, name: reference.spell.name } });
	}

	private initialPosition() {
		if (typeof window === 'undefined') return { x: 24, y: 72 };
		return { x: Math.max(12, window.innerWidth - 464), y: Math.max(64, window.innerHeight - 540) };
	}
}
