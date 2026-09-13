import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideExternalLink, LucideX } from '@lucide/angular';
import { DialogFocusDirective } from '../../directives/dialog-focus';
import type { CompendiumSpell } from '../../models/compendium-spell-model';
import type { ResolvedSpellReference } from '../../models/spell-reference-model';
import { CompendiumRendererService } from '../../services/compendium-renderer-service/compendium-renderer-service';

@Component({
	selector: 'app-spell-quick-view',
	standalone: true,
	imports: [CommonModule, DialogFocusDirective, LucideExternalLink, LucideX],
	templateUrl: './spell-quick-view.html',
})
export class SpellQuickViewComponent {
	private readonly renderer = inject(CompendiumRendererService);
	private readonly router = inject(Router);

	@Input() open = false;
	@Input() spell: CompendiumSpell | ResolvedSpellReference | null = null;
	@Output() closed = new EventEmitter<void>();

	resolvedSpell() {
		if (!this.spell) return null;
		return 'spell' in this.spell ? this.spell.spell : this.spell;
	}

	close() {
		this.closed.emit();
	}

	openInCompendium() {
		const spell = this.resolvedSpell();
		if (!spell) return;
		this.closed.emit();
		void this.router.navigate(['/home/compendium/spells'], {
			queryParams: { source: spell.source, name: spell.name },
		});
	}

	levelLabel(level: number) {
		return level === 0 ? 'Truque' : `${level}º nível`;
	}

	componentsLabel(components: CompendiumSpell['components']) {
		return [components.verbal && 'V', components.somatic && 'S', components.material && 'M']
			.filter(Boolean)
			.join(', ') || '-';
	}

	render(entries: CompendiumSpell['entries']) {
		return this.renderer.renderEntries(entries);
	}
}
