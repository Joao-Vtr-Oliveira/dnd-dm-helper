import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { AppSelectComponent } from './app-select';

@Component({
	standalone: true,
	imports: [AppSelectComponent],
	template:
		'<app-select label="Fonte" [options]="options" [value]="value()" emptyLabel="Todas" [searchable]="searchable" [disabled]="disabled()" (valueChange)="value.set($event)" />',
})
class AppSelectHost {
	readonly options = [
		{ value: 'BGG', label: 'BGG' },
		{ value: 'MM', label: 'MM' },
		{ value: 'XMM', label: 'XMM', disabled: true },
	];
	readonly value = signal('MM');
	searchable = true;
	readonly disabled = signal(false);
}

describe('AppSelectComponent', () => {
	let fixture: ComponentFixture<AppSelectHost>;
	let host: AppSelectHost;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [AppSelectHost],
			providers: [provideZonelessChangeDetection()],
		}).compileComponents();
		fixture = TestBed.createComponent(AppSelectHost);
		host = fixture.componentInstance;
		fixture.detectChanges();
	});

	function trigger(): HTMLButtonElement {
		return fixture.nativeElement.querySelector('app-select button');
	}

	it('opens, selects an option, and closes', () => {
		trigger().click();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[role="listbox"]')).not.toBeNull();

		const option = Array.from<HTMLButtonElement>(
			fixture.nativeElement.querySelectorAll('[role="option"]'),
		).find((element) => element.textContent?.includes('BGG'))!;
		option.click();
		fixture.detectChanges();
		expect(host.value()).toBe('BGG');
		expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();
	});

	it('filters searchable options and renders an empty state', () => {
		trigger().click();
		fixture.detectChanges();
		const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
		input.value = 'bg';
		input.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelectorAll('[role="option"]')).toHaveSize(1);

		input.value = 'missing';
		input.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Nenhuma opção encontrada.');
	});

	it('supports keyboard navigation, Escape, outside click, and disabled state', () => {
		trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		fixture.detectChanges();
		expect(trigger().getAttribute('aria-expanded')).toBe('true');
		trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		fixture.detectChanges();
		expect(trigger().getAttribute('aria-expanded')).toBe('false');

		trigger().click();
		fixture.detectChanges();
		document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();

		host.disabled.set(true);
		fixture.detectChanges();
		expect(trigger().disabled).toBeTrue();
	});
});
