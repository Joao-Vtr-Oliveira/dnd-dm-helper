import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ConditionReferenceTriggerDirective, SpellReferenceTriggerDirective } from '../reference-overlay/reference-trigger';
import type {
	CreatureAbilityKey,
	CreatureCategory,
	CreatureFeature,
	CreatureFeatureKind,
	CreatureSheet,
	CreatureSpell,
} from '../../models/creature-sheet-model';
import type { BattleCombatant, BattleSpecialAbility } from '../../models/battle-encounter-model';
import { proficiencyBonusForCreature, resolvePassivePerception } from '../../models/creature-sheet-rules';
import { BattleAbilityService } from '../../services/battle-ability-service/battle-ability-service';

type StatBlockDetail = { label: string; value: string };
type AbilityDisplay = { key: CreatureAbilityKey; label: string; score: number; modifier: string };
type FeatureSection = { kind: CreatureFeatureKind; label: string; features: CreatureFeature[] };
type SpellGroup = { key: string; label: string; order: number; spells: CreatureSpell[] };
type FeatureDescriptionPart = { text: string; condition?: string };

const CONDITION_PATTERN = /\b(blinded|charmed|deafened|frightened|grappled|incapacitated|invisible|paralyzed|petrified|poisoned|prone|restrained|stunned|unconscious)\b/gi;

@Component({
	selector: 'app-creature-stat-block',
	standalone: true,
	imports: [ConditionReferenceTriggerDirective, SpellReferenceTriggerDirective],
	templateUrl: './creature-stat-block.html',
})
export class CreatureStatBlockComponent {
	private readonly battleAbilityService = inject(BattleAbilityService);

	@Input({ required: true }) creature!: CreatureSheet;
	@Input() category?: CreatureCategory;
	@Input() variant: 'standalone' | 'embedded' = 'standalone';
	@Input() referenceInteractions = false;
	/** Runtime state is supplied only by the Battle Tracker; the creature remains the static definition. */
	@Input() runtimeCombatant?: Pick<BattleCombatant, 'specialAbilities' | 'spellSlots'>;

	@Output() readonly selectedSpell = new EventEmitter<CreatureSpell>();
	@Output() readonly selectedCondition = new EventEmitter<string>();

	readonly abilityKeys: Array<{ key: CreatureAbilityKey; label: string }> = [
		{ key: 'str', label: 'FOR' },
		{ key: 'dex', label: 'DES' },
		{ key: 'con', label: 'CON' },
		{ key: 'int', label: 'INT' },
		{ key: 'wis', label: 'SAB' },
		{ key: 'cha', label: 'CAR' },
	];

	readonly featureKinds: Array<{ kind: CreatureFeatureKind; label: string }> = [
		{ kind: 'trait', label: 'Traços' },
		{ kind: 'action', label: 'Ações' },
		{ kind: 'bonus', label: 'Ações bônus' },
		{ kind: 'reaction', label: 'Reações' },
		{ kind: 'legendary', label: 'Ações lendárias' },
		{ kind: 'spellcasting', label: 'Conjuração' },
		{ kind: 'note', label: 'Notas' },
	];

	identityLine(): string {
		return [this.creature.size, this.creature.creatureType, this.creature.alignment]
			.filter(this.hasText)
			.map((value) => value.trim())
			.join(', ');
	}

	referenceDetails(): StatBlockDetail[] {
		const proficiency = proficiencyBonusForCreature(this.creature);
		return [
			this.detail('CR', this.creature.challengeRating),
			proficiency == null ? null : { label: 'Proficiência', value: this.signedValue(proficiency) },
			this.detail('Fonte', this.creature.source),
		].filter((detail): detail is StatBlockDetail => detail !== null);
	}

	combatDetails(): StatBlockDetail[] {
		return [
			this.numberDetail('CA', this.creature.armorClass, this.creature.armorClassNote),
			this.numberDetail('PV', this.creature.maxHp, this.creature.hitPointFormula),
			this.detail('Deslocamento', this.speedText()),
		].filter((detail): detail is StatBlockDetail => detail !== null);
	}

	abilities(): AbilityDisplay[] {
		return this.abilityKeys.flatMap(({ key, label }) => {
			const score = this.creature.abilityScores?.[key];
			return this.isNumber(score)
				? [{ key, label, score, modifier: this.abilityModifier(score) }]
				: [];
		});
	}

	savesAndSkills(): StatBlockDetail[] {
		const saves = (this.creature.savingThrows ?? [])
			.filter((save) => this.isNumber(save.bonus))
			.map((save) => `${this.abilityLabel(save.ability)} ${this.signedValue(save.bonus)}`);
		const skills = (this.creature.skills ?? [])
			.filter((skill) => this.hasText(skill.name) && this.isNumber(skill.bonus))
			.map((skill) => `${skill.name.trim()} ${this.signedValue(skill.bonus)}`);
		return [
			saves.length ? { label: 'Salvaguardas', value: saves.join(', ') } : null,
			skills.length ? { label: 'Perícias', value: skills.join(', ') } : null,
		].filter((detail): detail is StatBlockDetail => detail !== null);
	}

	defenses(): StatBlockDetail[] {
		return [
			this.defenseDetail('Vulnerabilidades', this.creature.damageVulnerabilities),
			this.defenseDetail('Resistências', this.creature.damageResistances),
			this.defenseDetail('Imunidades', this.creature.damageImmunities),
			this.listDetail('Imunidades a condições', this.creature.conditionImmunities),
		].filter((detail): detail is StatBlockDetail => detail !== null);
	}

	sensesAndLanguages(): StatBlockDetail[] {
		const senses = (this.creature.senses ?? [])
			.filter((sense) => this.hasText(sense.name))
			.map(
				(sense) =>
					`${sense.name.trim()}${this.hasText(sense.detail) ? ` ${sense.detail!.trim()}` : ''}`,
			);
		return [
			senses.length ? { label: 'Sentidos', value: senses.join(', ') } : null,
			{ label: 'Percepção passiva', value: String(resolvePassivePerception(this.creature)) },
			this.listDetail('Idiomas', this.creature.languages),
		].filter((detail): detail is StatBlockDetail => detail !== null);
	}

	featureSections(): FeatureSection[] {
		return this.featureKinds.flatMap((section) => {
			const features = this.creature.features.filter(
				(feature) =>
					feature.kind === section.kind &&
					this.hasText(feature.name) &&
					!(this.hasSpellcastingInformation() && this.isSpellcastingFeature(feature)),
			);
			return features.length ? [{ ...section, features }] : [];
		});
	}

	legendaryDetails(): StatBlockDetail[] {
		const metadata = this.creature.legendaryActions;
		if (!metadata) return [];
		return [
			this.isNumber(metadata.count)
				? { label: 'Ações por rodada', value: String(metadata.count) }
				: null,
			this.detail('Descrição', metadata.intro),
		].filter((detail): detail is StatBlockDetail => detail !== null);
	}

	spellcastingSummary(): string {
		const metadata = this.creature.spellcasting;
		if (!metadata) return '';
		return [
			metadata.ability ? `Habilidade de conjuração: ${this.abilityLabel(metadata.ability)}` : '',
			this.isNumber(metadata.spellSaveDc) ? `CD para magia ${metadata.spellSaveDc}` : '',
			this.isNumber(metadata.spellAttackBonus)
				? `${this.signedValue(metadata.spellAttackBonus)} para atingir com magia`
				: '',
		]
			.filter(Boolean)
			.join('; ');
	}

	spellcastingHeader(): string {
		return this.creature.spellcasting?.header?.trim() ?? '';
	}

	spellcastingRecovery(): string {
		return this.creature.spellcasting?.slotRecovery?.trim() ?? '';
	}

	spellGroups(): SpellGroup[] {
		const groups = new Map<string, SpellGroup>();
		for (const spell of this.creature.spells.filter((item) => this.hasText(item.name))) {
			const group = this.spellGroupFor(spell);
			const existing = groups.get(group.key);
			if (existing) existing.spells.push(spell);
			else groups.set(group.key, { ...group, spells: [spell] });
		}

		for (const slot of this.validSpellSlots()) {
			const key = `slot-${slot.level}`;
			if (!groups.has(key)) {
				groups.set(key, {
					key,
					label: this.slotLabel(slot.level, slot.max),
					order: 10 + slot.level,
					spells: [],
				});
			}
		}

		return [...groups.values()].sort(
			(left, right) => left.order - right.order || left.label.localeCompare(right.label),
		);
	}

	hasSpellcastingInformation(): boolean {
		return !!this.creature.spellcasting || this.spellGroups().length > 0;
	}

	featureCost(feature: CreatureFeature): string {
		return this.isNumber(feature.legendaryCost) && feature.legendaryCost > 0
			? ` (custa ${feature.legendaryCost} ação(ões))`
			: '';
	}

	selectSpell(spell: CreatureSpell) {
		if (this.referenceInteractions) return;
		if (this.hasText(spell.source)) this.selectedSpell.emit(spell);
	}

	featureDescription(description: string | undefined): FeatureDescriptionPart[] {
		if (!this.hasText(description)) return [];
		return description.split(CONDITION_PATTERN).flatMap((text, index) =>
			index % 2 ? [{ text, condition: text.toLocaleLowerCase() }] : text ? [{ text }] : [],
		);
	}

	selectCondition(condition: string) {
		if (this.referenceInteractions) return;
		this.selectedCondition.emit(condition);
	}

	runtimeAbilityRule(ability: BattleSpecialAbility) {
		return this.battleAbilityService.describeAbilityRule(ability);
	}

	runtimeAbilityStatus(ability: BattleSpecialAbility) {
		return this.battleAbilityService.describeAbilityStatus(ability);
	}

	runtimeAbilityUsage(ability: BattleSpecialAbility) {
		return this.battleAbilityService.describeAbilityUsage(ability);
	}

	runtimeAvailableSlots(slot: NonNullable<CreatureStatBlockComponent['runtimeCombatant']>['spellSlots'][number]) {
		return Math.max(0, slot.max - slot.used);
	}

	private detail(label: string, value: string | undefined): StatBlockDetail | null {
		return this.hasText(value) ? { label, value: value.trim() } : null;
	}

	private numberDetail(
		label: string,
		value: number | null | undefined,
		note?: string,
		signed = false,
	): StatBlockDetail | null {
		if (!this.isNumber(value)) return null;
		return {
			label,
			value: `${signed ? this.signedValue(value) : value}${this.hasText(note) ? ` (${note.trim()})` : ''}`,
		};
	}

	private listDetail(label: string, values: string[] | undefined): StatBlockDetail | null {
		const populated = (values ?? [])
			.filter((value) => this.hasText(value))
			.map((value) => value.trim());
		return populated.length ? { label, value: populated.join(', ') } : null;
	}

	private defenseDetail(
		label: string,
		values: CreatureSheet['damageResistances'] | undefined,
	): StatBlockDetail | null {
		const populated = (values ?? [])
			.map((defense) => {
				const types = defense.types.filter((type) => this.hasText(type)).map((type) => type.trim());
				return types.length
					? `${types.join(', ')}${this.hasText(defense.note) ? ` (${defense.note!.trim()})` : ''}`
					: '';
			})
			.filter(Boolean);
		return populated.length ? { label, value: populated.join('; ') } : null;
	}

	private speedText(): string {
		return (this.creature.speed ?? [])
			.filter((speed) => this.hasText(speed.type))
			.map(
				(speed) =>
					`${speed.type.trim()}${this.hasText(speed.distance) ? ` ${speed.distance!.trim()}` : ''}${speed.hover ? ' (pairar)' : ''}`,
			)
			.join(', ');
	}

	private abilityLabel(ability: CreatureAbilityKey): string {
		return this.abilityKeys.find((item) => item.key === ability)?.label ?? ability.toUpperCase();
	}

	private abilityModifier(score: number): string {
		return this.signedValue(Math.floor((score - 10) / 2));
	}

	private signedValue(value: number): string {
		return value >= 0 ? `+${value}` : String(value);
	}

	private hasText(value: string | undefined): value is string {
		return typeof value === 'string' && value.trim().length > 0;
	}

	private isNumber(value: unknown): value is number {
		return typeof value === 'number' && Number.isFinite(value);
	}

	private validSpellSlots() {
		return this.creature.spellSlots.filter(
			(slot) => this.isNumber(slot.level) && slot.level >= 1 && this.isNumber(slot.max),
		);
	}

	private spellGroupFor(spell: CreatureSpell): Omit<SpellGroup, 'spells'> {
		const level = spell.level;
		if (spell.castingGroup === 'constant') return this.usageSpellGroup('constant', spell);
		if (spell.castingGroup === 'daily') return this.usageSpellGroup('daily', spell);
		if (spell.castingGroup === 'rest') return this.usageSpellGroup('rest', spell);
		if (spell.castingGroup === 'weekly') return this.usageSpellGroup('weekly', spell);
		if (spell.castingGroup === 'at-will' || (!spell.castingGroup && level === 0)) {
			return level === 0
				? { key: 'cantrip', label: 'Truques (à vontade)', order: 0 }
				: { key: 'at-will', label: 'À vontade', order: 1 };
		}
		if (
			(spell.castingGroup === 'slot' || !spell.castingGroup) &&
			this.isNumber(level) &&
			level >= 1
		) {
			const slot = this.validSpellSlots().find((item) => item.level === level);
			return {
				key: `slot-${level}`,
				label: this.slotLabel(level, slot?.max),
				order: 10 + level,
			};
		}
		if (spell.castingGroup === 'slot')
			return { key: 'slot', label: 'Magias com espaços', order: 19 };
		return { key: 'at-will', label: 'À vontade', order: 1 };
	}

	private usageSpellGroup(kind: 'constant' | 'daily' | 'rest' | 'weekly', spell: CreatureSpell) {
		const uses = this.isNumber(spell.uses) ? spell.uses : undefined;
		const each = spell.each && uses !== undefined ? ' cada' : '';
		const labels = {
			constant: 'Constante',
			daily: uses === undefined ? 'Diariamente' : `${uses}/dia${each}`,
			rest: uses === undefined ? 'Por descanso' : `${uses}/descanso${each}`,
			weekly: uses === undefined ? 'Semanalmente' : `${uses}/semana${each}`,
		};
		const orders = { constant: 60, daily: 30, rest: 40, weekly: 50 };
		return {
			key: `${kind}-${uses ?? 'unlimited'}-${spell.each === true}`,
			label: labels[kind],
			order: orders[kind],
		};
	}

	private slotLabel(level: number, maximum?: number): string {
		if (!this.isNumber(maximum)) return `${level}º nível`;
		return `${level}º nível (${maximum} espaço${maximum === 1 ? '' : 's'})`;
	}

	private isSpellcastingFeature(feature: CreatureFeature): boolean {
		return feature.kind === 'spellcasting' || /spellcasting|conjura/i.test(feature.name);
	}
}
