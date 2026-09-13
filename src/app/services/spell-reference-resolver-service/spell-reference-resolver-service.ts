import { Injectable, inject } from '@angular/core';
import type { SpellReference, ParsedSpellReference, ResolvedSpellReference } from '../../models/spell-reference-model';
import type { CompendiumSpellListEntry } from '../../models/compendium-spell-model';
import { CompendiumSpellRepositoryService } from '../compendium-spell-repository-service/compendium-spell-repository-service';

@Injectable({ providedIn: 'root' })
export class SpellReferenceResolverService {
	private readonly repository = inject(CompendiumSpellRepositoryService);

	parse(value: unknown): ParsedSpellReference {
		if (typeof value !== 'string') return { displayText: '', reference: null };
		let reference: SpellReference | null = null;
		const displayText = value
			.replace(
				/\{@spell\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^}]*))?\}/gi,
				(_tag, rawName: string, rawSource?: string, rawDisplay?: string) => {
					const name = rawName.trim();
					const source = rawSource?.trim();
					if (!reference && name) reference = { name, ...(source ? { source } : {}) };
					return rawDisplay?.trim() || name;
				},
			)
			.trim();
		return { displayText, reference };
	}

	async canonicalize(reference: SpellReference | null | undefined): Promise<SpellReference | null> {
		const name = this.value(reference?.name);
		if (!name) return null;
		try {
			const index = await this.repository.getIndex();
			const source = this.value(reference?.source) ?? undefined;
			const matches = index.spells.filter((spell) =>
				this.matches(spell, name, source),
			);
			if (matches.length !== 1) return null;
			return { name: matches[0].name, source: matches[0].source };
		} catch {
			return null;
		}
	}

	async resolve(reference: SpellReference | null | undefined) {
		return (await this.resolveReference(reference))?.spell ?? null;
	}

	async resolveReference(
		reference: SpellReference | null | undefined,
	): Promise<ResolvedSpellReference | null> {
		const canonical = await this.canonicalize(reference);
		if (!canonical?.source) return null;
		try {
			const spell = await this.repository.getSpell(canonical.source, canonical.name);
			return spell ? { reference: canonical, spell } : null;
		} catch {
			return null;
		}
	}

	async resolveText(value: unknown): Promise<ResolvedSpellReference | null> {
		return this.resolveReference(this.parse(value).reference);
	}

	private matches(spell: CompendiumSpellListEntry, name: string, source?: string) {
		if (source && this.normalized(spell.source) !== this.normalized(source)) return false;
		const target = this.normalized(name);
		return [spell.name, ...spell.aliases].some((candidate) => this.normalized(candidate) === target);
	}

	private value(value: unknown) {
		return typeof value === 'string' && value.trim() ? value.trim() : null;
	}

	private normalized(value: string) {
		return value.trim().toLocaleLowerCase();
	}
}
