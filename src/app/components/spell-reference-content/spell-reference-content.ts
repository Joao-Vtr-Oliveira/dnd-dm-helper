import { Component, Input, inject } from '@angular/core';
import type { CompendiumSpell } from '../../models/compendium-spell-model';
import { CompendiumRendererService } from '../../services/compendium-renderer-service/compendium-renderer-service';

@Component({ selector: 'app-spell-reference-content', standalone: true, templateUrl: './spell-reference-content.html' })
export class SpellReferenceContentComponent {
	@Input({ required: true }) spell!: CompendiumSpell;
	private readonly renderer = inject(CompendiumRendererService);
	levelLabel(level: number) { return level === 0 ? 'Truque' : `${level}º nível`; }
	componentsLabel(components: CompendiumSpell['components']) {
		return [components.verbal && 'V', components.somatic && 'S', components.material && 'M'].filter(Boolean).join(', ') || '-';
	}
	render(entries: CompendiumSpell['entries']) { return this.renderer.renderEntries(entries); }
}
