import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

type TagHelperKind = 'spell' | 'damage' | 'condition' | 'dc' | 'hit' | 'dice' | 'save';

@Component({
	selector: 'app-fiveetools-tag-helper',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './fiveetools-tag-helper.html',
})
export class FiveEToolsTagHelperComponent {
	@Input({ required: true }) kind: TagHelperKind = 'spell';
	@Input({ required: true }) generatedTag = '';
	@Input() spellName = '';
	@Input() spellSource = '';
	@Input() damage = '';
	@Input() condition = '';
	@Input() conditionSource = '';
	@Input() dc = '';
	@Input() hit = '';
	@Input() dice = '';
	@Input() saveAbility = '';
	@Input() targetLabel = '';
	@Input() canInsert = false;

	@Output() readonly close = new EventEmitter<void>();
	@Output() readonly copy = new EventEmitter<void>();
	@Output() readonly insert = new EventEmitter<void>();
	@Output() readonly kindChange = new EventEmitter<TagHelperKind>();
	@Output() readonly spellNameChange = new EventEmitter<string>();
	@Output() readonly spellSourceChange = new EventEmitter<string>();
	@Output() readonly damageChange = new EventEmitter<string>();
	@Output() readonly conditionChange = new EventEmitter<string>();
	@Output() readonly conditionSourceChange = new EventEmitter<string>();
	@Output() readonly dcChange = new EventEmitter<string>();
	@Output() readonly hitChange = new EventEmitter<string>();
	@Output() readonly diceChange = new EventEmitter<string>();
	@Output() readonly saveAbilityChange = new EventEmitter<string>();

	readonly kinds: TagHelperKind[] = ['spell', 'damage', 'condition', 'dc', 'hit', 'dice', 'save'];
}
