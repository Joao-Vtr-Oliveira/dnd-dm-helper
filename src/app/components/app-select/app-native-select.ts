import {
	AfterViewInit,
	ComponentRef,
	DoCheck,
	Directive,
	ElementRef,
	HostListener,
	OnDestroy,
	Renderer2,
	ViewContainerRef,
} from '@angular/core';
import { AppSelectComponent, type AppSelectOption } from './app-select';

/** Keeps legacy select bindings while rendering the shared select control. */
@Directive({
	selector: 'select',
	standalone: true,
})
export class AppNativeSelectDirective implements AfterViewInit, DoCheck, OnDestroy {
	private component?: ComponentRef<AppSelectComponent>;
	private observer?: MutationObserver;

	constructor(
		private readonly selectRef: ElementRef<HTMLSelectElement>,
		private readonly viewContainer: ViewContainerRef,
		private readonly renderer: Renderer2,
	) {}

	ngAfterViewInit() {
		const select = this.selectRef.nativeElement;
		this.component = this.viewContainer.createComponent(AppSelectComponent);
		this.component.setInput('label', '');
		this.component.setInput('ariaLabel', this.labelFor(select));
		this.syncOptions();
		this.syncValue();
		this.component.instance.valueChange.subscribe((value) => {
			select.value = value;
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		this.renderer.setStyle(select, 'display', 'none');
		this.observer = new MutationObserver(() => {
			this.syncOptions();
			this.syncValue();
		});
		this.observer.observe(select, { childList: true, subtree: true, attributes: true });
	}

	ngOnDestroy() {
		this.observer?.disconnect();
	}

	ngDoCheck() {
		this.syncValue();
	}

	@HostListener('change')
	onChange() {
		this.syncValue();
	}

	private syncOptions() {
		const select = this.selectRef.nativeElement;
		const options: AppSelectOption[] = Array.from(select.options).map((option) => ({
			value: option.value,
			label: option.text,
			disabled: option.disabled,
		}));
		this.component?.setInput('options', options);
	}

	private syncValue() {
		const select = this.selectRef.nativeElement;
		this.component?.setInput('value', select.value);
		this.component?.setInput('disabled', select.disabled);
	}

	private labelFor(select: HTMLSelectElement) {
		return (
			select.labels?.[0]?.textContent?.trim() ||
			select.getAttribute('aria-label') ||
			'Selecionar opção'
		);
	}
}
