import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CompendiumSpell, CompendiumSpellListEntry } from '../../models/compendium-spell-model';
import { CompendiumSpellRepositoryService } from '../compendium-spell-repository-service/compendium-spell-repository-service';
import { SpellReferenceResolverService } from './spell-reference-resolver-service';

function indexSpell(overrides: Partial<CompendiumSpellListEntry> = {}): CompendiumSpellListEntry {
	return {
		id: 'PHB:fireball',
		name: 'Fireball',
		source: 'PHB',
		level: 3,
		school: 'V',
		ritual: false,
		concentration: false,
		aliases: ['Bola de Fogo'],
		classes: [],
		...overrides,
	};
}

function spellFixture(): CompendiumSpell {
	return {
		...indexSpell(),
		components: { verbal: true, somatic: true },
		entries: [],
		entriesHigherLevel: [],
		damageTypes: [],
		savingThrows: [],
		attackTypes: [],
		conditions: [],
		raw: {} as CompendiumSpell['raw'],
	};
}

describe('SpellReferenceResolverService', () => {
	let service: SpellReferenceResolverService;
	let repository: jasmine.SpyObj<CompendiumSpellRepositoryService>;

	beforeEach(() => {
		repository = jasmine.createSpyObj<CompendiumSpellRepositoryService>(
			'CompendiumSpellRepositoryService',
			['getIndex', 'getSpell'],
		);
		repository.getIndex.and.resolveTo({
			sources: [{ source: 'PHB', path: 'phb.json' }],
			spells: [indexSpell()],
		});
		repository.getSpell.and.resolveTo(spellFixture());
		TestBed.configureTestingModule({
			providers: [
				provideZonelessChangeDetection(),
				{ provide: CompendiumSpellRepositoryService, useValue: repository },
			],
		});
		service = TestBed.inject(SpellReferenceResolverService);
	});

	it('parses an embedded spell tag while preserving its display text and trailing annotation', () => {
		expect(service.parse('Cast {@spell fireball|PHB|Bola de Fogo} (3º nível).')).toEqual({
			displayText: 'Cast Bola de Fogo (3º nível).',
			reference: { name: 'fireball', source: 'PHB' },
		});
	});

	it('canonicalizes explicit source and aliases before using the local spell cache', async () => {
		const resolved = await service.resolveReference({ name: 'bola de fogo', source: 'phb' });

		expect(resolved?.reference).toEqual({ name: 'Fireball', source: 'PHB' });
		expect(repository.getSpell).toHaveBeenCalledWith('PHB', 'Fireball');
	});

	it('uses the uniquely named local equivalent when the referenced source is unavailable', async () => {
		const resolved = await service.resolveReference({ name: 'fireball', source: 'XPHB' });

		expect(resolved?.reference).toEqual({ name: 'Fireball', source: 'PHB' });
		expect(repository.getSpell).toHaveBeenCalledWith('PHB', 'Fireball');
	});

	it('does not choose an arbitrary source when an unqualified spell name is ambiguous', async () => {
		repository.getIndex.and.resolveTo({
			sources: [
				{ source: 'PHB', path: 'phb.json' },
				{ source: 'XPHB', path: 'xphb.json' },
			],
			spells: [indexSpell(), indexSpell({ id: 'XPHB:fireball', source: 'XPHB' })],
		});

		expect(await service.resolve({ name: 'fireball' })).toBeNull();
		expect(repository.getSpell).not.toHaveBeenCalled();
	});
});
