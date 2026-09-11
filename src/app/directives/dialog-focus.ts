import {
	Directive,
	ElementRef,
	EventEmitter,
	HostListener,
	Input,
	OnChanges,
	OnDestroy,
	Output,
	SimpleChanges,
} from '@angular/core';

@Directive({
	selector: '[appDialogFocus]',
	standalone: true,
})
export class DialogFocusDirective implements OnChanges, OnDestroy {
	@Input({ required: true }) appDialogFocus = false;
	@Output() appDialogEscape = new EventEmitter<void>();

	private restoreTarget: HTMLElement | null = null;

	constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

	ngOnChanges(changes: SimpleChanges) {
		if (!changes['appDialogFocus'] || !this.appDialogFocus) return;
		this.restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		document.body.classList.add('app-dialog-open');
		queueMicrotask(() => this.focusInitialControl());
	}

	ngOnDestroy() {
		if (!this.appDialogFocus) return;
		document.body.classList.remove('app-dialog-open');
		queueMicrotask(() => this.restoreTarget?.focus());
	}

	@HostListener('document:keydown', ['$event'])
	onDocumentKeydown(event: KeyboardEvent) {
		if (!this.appDialogFocus) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopImmediatePropagation();
			this.appDialogEscape.emit();
			return;
		}
		if (event.key !== 'Tab') return;

		const focusable = this.focusableElements();
		if (!focusable.length) return;
		const first = focusable[0];
		const last = focusable.at(-1)!;
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	private focusInitialControl() {
		const dialog = this.elementRef.nativeElement;
		const initial = dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]');
		(initial ?? this.focusableElements()[0])?.focus();
	}

	private focusableElements(): HTMLElement[] {
		return Array.from(
			this.elementRef.nativeElement.querySelectorAll<HTMLElement>(
				'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]:not([tabindex="-1"])'
			)
		);
	}
}
