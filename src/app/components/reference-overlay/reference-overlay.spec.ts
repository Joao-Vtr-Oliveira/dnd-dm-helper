import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SpellReferenceResolverService } from '../../services/spell-reference-resolver-service/spell-reference-resolver-service';
import { ReferenceOverlayComponent } from './reference-overlay';
import { ReferenceOverlayService } from './reference-overlay-service';

describe('ReferenceOverlayComponent', () => {
	let component: ReferenceOverlayComponent;
	let fixture: ComponentFixture<ReferenceOverlayComponent>;
	let references: ReferenceOverlayService;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ReferenceOverlayComponent],
			providers: [
				provideZonelessChangeDetection(),
				provideRouter([]),
				{ provide: SpellReferenceResolverService, useValue: { resolveReference: async () => null } },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(ReferenceOverlayComponent);
		component = fixture.componentInstance;
		references = TestBed.inject(ReferenceOverlayService);
	});

	it('keeps one floating condition and opens it in the secondary modal', () => {
		references.openCondition('poisoned');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[data-reference-floating]')?.textContent).toContain('Poisoned');
		fixture.nativeElement.querySelector('[data-reference-floating] button')?.click();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[data-reference-modal]')?.textContent).toContain('Poisoned');
		expect(fixture.nativeElement.querySelector('[data-reference-floating]')).not.toBeNull();
	});

	it('retracts, expands, and closes the floating reference without dragging its controls', () => {
		references.openCondition('poisoned');
		fixture.detectChanges();
		const floating = fixture.nativeElement.querySelector('[data-reference-floating]') as HTMLElement;
		expect(floating.textContent).toContain('Retrair');
		(floating.querySelector('[aria-label="Retrair referência"]') as HTMLButtonElement | null)?.click();
		fixture.detectChanges();
		expect(floating.textContent).not.toContain('desvantagem nas jogadas de ataque');
		expect(floating.textContent).toContain('Expandir');
		(floating.querySelector('[aria-label="Expandir referência"]') as HTMLButtonElement | null)?.click();
		fixture.detectChanges();
		expect(floating.textContent).toContain('desvantagem nas jogadas de ataque');
		(floating.querySelector('[aria-label="Fechar referência"]') as HTMLButtonElement | null)?.click();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[data-reference-floating]')).toBeNull();
	});

	it('renders a scrollable quick peek within a clamped viewport position', () => {
		jasmine.clock().install();
		const anchor = document.createElement('button');
		spyOn(anchor, 'getBoundingClientRect').and.returnValue(new DOMRect(2, 2, 20, 20));
		references.peekCondition('poisoned', anchor);
		jasmine.clock().tick(150);
		fixture.detectChanges();
		const peek = fixture.nativeElement.querySelector('[data-reference-peek]') as HTMLElement;
		expect(peek).not.toBeNull();
		expect(peek.classList).toContain('overflow-y-auto');
		expect(Number.parseInt(peek.style.left, 10)).toBeGreaterThanOrEqual(12);
		jasmine.clock().uninstall();
	});

	it('places the quick peek above a reference when there is room', () => {
		jasmine.clock().install();
		const anchor = document.createElement('button');
		spyOn(anchor, 'getBoundingClientRect').and.returnValue(new DOMRect(200, 500, 20, 20));
		references.peekCondition('poisoned', anchor);
		jasmine.clock().tick(150);
		fixture.detectChanges();
		const peek = fixture.nativeElement.querySelector('[data-reference-peek]') as HTMLElement;
		expect(peek.style.bottom).not.toBe('');
		expect(peek.style.top).toBe('');
		jasmine.clock().uninstall();
	});
});
