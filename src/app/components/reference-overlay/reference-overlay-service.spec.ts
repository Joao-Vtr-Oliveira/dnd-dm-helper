import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SpellReferenceResolverService } from '../../services/spell-reference-resolver-service/spell-reference-resolver-service';
import { ReferenceOverlayService } from './reference-overlay-service';

describe('ReferenceOverlayService', () => {
	let service: ReferenceOverlayService;
	const resolveReference = jasmine.createSpy('resolveReference').and.resolveTo({
		reference: { name: 'Aid', source: 'PHB' },
		spell: {
			id: 'PHB:aid', name: 'Aid', source: 'PHB', aliases: [], level: 2, school: 'A',
			components: { verbal: true, somatic: true }, concentration: false, ritual: false,
			entries: ['The target has more hit points.'], entriesHigherLevel: [], damageTypes: [],
			savingThrows: [], attackTypes: [], conditions: [], classes: [], raw: {} as never,
		},
	});

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideZonelessChangeDetection(),
				{ provide: SpellReferenceResolverService, useValue: { resolveReference } },
			],
		});
		service = TestBed.inject(ReferenceOverlayService);
		resolveReference.calls.reset();
	});

	it('replaces the single floating reference and retains it until closed', async () => {
		service.openCondition('poisoned');
		expect(service.floating()?.kind).toBe('condition');
		service.openSpell({ name: 'Aid', source: 'PHB' });
		await Promise.resolve();
		expect(service.floating()?.kind).toBe('spell');
		expect(service.floating()?.name).toBe('Aid');
		service.closeFloating();
		expect(service.floating()).toBeNull();
	});

	it('delays spell peeks and keeps a single cached lookup', async () => {
		jasmine.clock().install();
		const anchor = document.createElement('button');
		service.peekSpell({ name: 'Aid', source: 'PHB' }, anchor);
		expect(service.peek()).toBeNull();
		jasmine.clock().tick(150);
		await Promise.resolve();
		expect(service.peek()?.name).toBe('Aid');
		service.openSpell({ name: 'Aid', source: 'PHB' });
		await Promise.resolve();
		expect(resolveReference).toHaveBeenCalledTimes(1);
		jasmine.clock().uninstall();
	});

	it('opens the current floating reference in the secondary modal', () => {
		service.openCondition('poisoned');
		service.openModal();
		expect(service.modal()?.kind).toBe('condition');
		expect(service.floating()?.kind).toBe('condition');
		service.closeModal();
		expect(service.modal()).toBeNull();
	});
});
