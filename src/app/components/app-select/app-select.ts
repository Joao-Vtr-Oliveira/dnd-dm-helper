import { CommonModule } from '@angular/common';
import {
	Component,
	ElementRef,
	EventEmitter,
	HostListener,
	Input,
	Output,
	QueryList,
	ViewChild,
	ViewChildren,
} from '@angular/core';
import { LucideCheck, LucideChevronDown, LucideSearch } from '@lucide/angular';

export type AppSelectOption = {
	value: string;
	label: string;
	disabled?: boolean;
};

type MenuPosition = {
	left: number;
	width: number;
	maxHeight: number;
	top?: number;
	bottom?: number;
};

let nextSelectId = 0;

@Component({
	selector: 'app-select',
	standalone: true,
	imports: [CommonModule, LucideCheck, LucideChevronDown, LucideSearch],
	templateUrl: './app-select.html',
	styleUrl: './app-select.css',
})
export class AppSelectComponent {
	@Input({ required: true }) label = '';
	@Input() ariaLabel = '';
	@Input() options: readonly (AppSelectOption | string | Record<string, unknown>)[] = [];
	@Input() optionValueKey = 'value';
	@Input() optionLabelKey = 'label';
	@Input() optionLabels: Record<string, string> = {};
	@Input() value = '';
	@Input() emptyLabel?: string;
	@Input() emptyValue = '';
	@Input() searchable = false;
	@Input() searchPlaceholder = 'Buscar...';
	@Input() disabled = false;
	@Output() valueChange = new EventEmitter<string>();

	@ViewChild('trigger') private readonly trigger?: ElementRef<HTMLButtonElement>;
	@ViewChild('searchInput') private readonly searchInput?: ElementRef<HTMLInputElement>;
	@ViewChildren('optionElement') private readonly optionElements?: QueryList<
		ElementRef<HTMLElement>
	>;

	readonly listboxId = `app-select-listbox-${nextSelectId++}`;
	open = false;
	query = '';
	activeIndex = -1;
	menuPosition: MenuPosition = { left: 0, width: 0, maxHeight: 320 };

	get accessibleLabel() {
		return this.ariaLabel || this.label;
	}

	get allOptions(): readonly AppSelectOption[] {
		const options = this.options.map((option) => this.normalizeOption(option));
		return this.emptyLabel == null
			? options
			: [{ value: this.emptyValue, label: this.emptyLabel }, ...options];
	}

	get filteredOptions(): readonly AppSelectOption[] {
		const query = this.query.trim().toLocaleLowerCase();
		if (!this.searchable || !query) return this.allOptions;
		return this.allOptions.filter((option) =>
			`${option.label} ${option.value}`.toLocaleLowerCase().includes(query),
		);
	}

	get selectedOption() {
		return this.allOptions.find((option) => option.value === this.value);
	}

	get activeOption() {
		return this.filteredOptions[this.activeIndex];
	}

	get activeDescendantId() {
		return this.activeOption ? this.optionId(this.activeIndex) : null;
	}

	toggle() {
		if (this.disabled) return;
		if (this.open) this.close(false);
		else this.openMenu();
	}

	select(option: AppSelectOption) {
		if (option.disabled) return;
		this.valueChange.emit(option.value);
		this.close(true);
	}

	onTriggerKeydown(event: KeyboardEvent) {
		if (this.disabled) return;
		if (event.key === 'Tab') {
			this.close(false);
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (!this.open) this.openMenu();
			this.moveActive(1);
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (!this.open) this.openMenu();
			this.moveActive(-1);
			return;
		}
		if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			if (!this.open) this.openMenu();
			this.setActive(event.key === 'Home' ? 0 : this.filteredOptions.length - 1);
			return;
		}
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (!this.open) this.openMenu();
			else if (this.activeOption) this.select(this.activeOption);
		}
	}

	onSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Tab') {
			this.close(false);
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			this.moveActive(1);
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			this.moveActive(-1);
			return;
		}
		if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			this.setActive(event.key === 'Home' ? 0 : this.filteredOptions.length - 1);
			return;
		}
		if (event.key === 'Enter' && this.activeOption) {
			event.preventDefault();
			this.select(this.activeOption);
		}
	}

	onSearch(value: string) {
		this.query = value;
		this.activeIndex = this.firstEnabledIndex();
	}

	optionId(index: number) {
		return `${this.listboxId}-option-${index}`;
	}

	@HostListener('document:pointerdown', ['$event'])
	onDocumentPointerDown(event: PointerEvent) {
		if (
			this.open &&
			event.target instanceof Node &&
			!this.elementRef.nativeElement.contains(event.target)
		) {
			this.close(false);
		}
	}

	@HostListener('document:keydown.escape')
	onEscape() {
		if (this.open) this.close(true);
	}

	@HostListener('window:resize')
	@HostListener('window:scroll')
	@HostListener('document:scroll')
	onViewportChange() {
		if (this.open) this.positionMenu();
	}

	constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

	private openMenu() {
		this.open = true;
		this.query = '';
		this.activeIndex = this.selectedIndex() ?? this.firstEnabledIndex();
		queueMicrotask(() => {
			this.positionMenu();
			if (this.searchable) this.searchInput?.nativeElement.focus();
			this.scrollActiveIntoView();
		});
	}

	private close(restoreFocus: boolean) {
		if (!this.open) return;
		this.open = false;
		this.query = '';
		if (restoreFocus) queueMicrotask(() => this.trigger?.nativeElement.focus());
	}

	private moveActive(direction: 1 | -1) {
		const options = this.filteredOptions;
		if (!options.length) return;
		let index = this.activeIndex;
		for (let count = 0; count < options.length; count++) {
			index = (index + direction + options.length) % options.length;
			if (!options[index]?.disabled) {
				this.setActive(index);
				return;
			}
		}
	}

	setActive(index: number) {
		if (!this.filteredOptions[index]?.disabled) this.activeIndex = index;
		this.scrollActiveIntoView();
	}

	private selectedIndex() {
		const index = this.filteredOptions.findIndex(
			(option) => option.value === this.value && !option.disabled,
		);
		return index >= 0 ? index : undefined;
	}

	private firstEnabledIndex() {
		return this.filteredOptions.findIndex((option) => !option.disabled);
	}

	private normalizeOption(
		option: AppSelectOption | string | Record<string, unknown>,
	): AppSelectOption {
		if (typeof option === 'string')
			return { value: option, label: this.optionLabels[option] ?? option };
		const record = option as Record<string, unknown>;
		const value = record[this.optionValueKey] ?? record['value'];
		const label =
			this.optionLabels[String(value ?? '')] ??
			record[this.optionLabelKey] ??
			record['label'] ??
			value;
		return {
			value: String(value ?? ''),
			label: String(label ?? ''),
			disabled: record['disabled'] === true,
		};
	}

	private positionMenu() {
		const trigger = this.trigger?.nativeElement;
		if (!trigger) return;
		const rect = trigger.getBoundingClientRect();
		const gap = 8;
		const margin = 8;
		const below = window.innerHeight - rect.bottom - gap - margin;
		const above = rect.top - gap - margin;
		const openAbove = below < 220 && above > below;
		const maxHeight = Math.max(160, Math.min(320, openAbove ? above : below));
		const width = Math.min(Math.max(rect.width, 224), Math.max(0, window.innerWidth - margin * 2));
		this.menuPosition = {
			left: Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin)),
			width,
			maxHeight,
			...(openAbove ? { bottom: window.innerHeight - rect.top + gap } : { top: rect.bottom + gap }),
		};
	}

	private scrollActiveIntoView() {
		queueMicrotask(() =>
			this.optionElements
				?.get(this.activeIndex)
				?.nativeElement.scrollIntoView({ block: 'nearest' }),
		);
	}
}
