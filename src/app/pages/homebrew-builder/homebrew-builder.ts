import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, CanDeactivateFn, Router } from '@angular/router';
import { LucideBookOpen } from '@lucide/angular';
import { AppSelectComponent } from '../../components/app-select/app-select';
import { SpellPickerComponent } from '../../components/spell-picker/spell-picker';
import { SpellQuickViewComponent } from '../../components/spell-quick-view/spell-quick-view';
import { SpellReferenceTriggerDirective } from '../../components/reference-overlay/reference-trigger';
import { ReferenceOverlayService } from '../../components/reference-overlay/reference-overlay-service';
import { DialogFocusDirective } from '../../directives/dialog-focus';

import {
	HomebrewCategory,
	LocalStorageService,
} from '../../services/local-storage-service/local-storage-service';
import type {
	CreatureAbilityKey,
	CreatureAbilityRecoveryType,
	CreatureFeature,
	CreatureFeatureKind,
	CreatureSheet,
	CreatureSpecialAbility,
	CreatureSpeedType,
	CreatureSpell,
} from '../../models/creature-sheet-model';
import { normalizeArmorClass } from '../../models/creature-sheet-model';
import type { CompendiumSpellListEntry } from '../../models/compendium-spell-model';
import {
	CompendiumSuggestionsService,
	type CompendiumFeat,
	type CompendiumMonsterFeature,
} from '../../services/compendium-suggestions-service/compendium-suggestions-service';
import type { ResolvedSpellReference } from '../../models/spell-reference-model';
import { SpellReferenceResolverService } from '../../services/spell-reference-resolver-service/spell-reference-resolver-service';
import { CompendiumRendererService } from '../../services/compendium-renderer-service/compendium-renderer-service';
import type { RawFiveEToolsEntry } from '../../models/compendium-entry-model';

type SpellDraft = { name: string; uses: number; level: number };
type AbilityDraft = {
	name: string;
	description: string;
	recoveryType: CreatureAbilityRecoveryType;
	maxUses: number;
	cooldownValue: number;
	rechargeOn: string;
};
type FeatureDraft = {
	name: string;
	description: string;
	kind: CreatureFeatureKind;
	legendaryCost: number;
};
type SpeedDraft = { type: CreatureSpeedType; distance: string; hover: boolean };
type DefenseKey = 'damageVulnerabilities' | 'damageResistances' | 'damageImmunities';
type DefenseDraft = { types: string[]; note: string };
type InlineComposer =
	| 'speed'
	| 'save'
	| 'skill'
	| `defense:${DefenseKey}`
	| 'sense'
	| 'language'
	| 'condition'
	| 'spell'
	| 'special-ability';
type OptionalCreatureField =
	| 'abilityScores'
	| 'speed'
	| 'savingThrows'
	| 'skills'
	| DefenseKey
	| 'senses'
	| 'languages'
	| 'conditionImmunities'
	| 'legendaryActions'
	| 'spellcasting';

function createEmptyCreature(): CreatureSheet {
	return {
		name: '',
		maxHp: 0,
		armorClass: null,
		spellSlots: [],
		spells: [],
		specialAbilities: [],
		features: [],
	};
}

function normalizeCreature(raw: CreatureSheet): CreatureSheet {
	return {
		...createEmptyCreature(),
		...structuredClone(raw),
		spellSlots: Array.isArray(raw.spellSlots) ? raw.spellSlots : [],
		spells: Array.isArray(raw.spells) ? raw.spells : [],
		specialAbilities: Array.isArray(raw.specialAbilities) ? raw.specialAbilities : [],
		features: Array.isArray(raw.features) ? raw.features : [],
		rawFiveETools:
			raw.rawFiveETools &&
			typeof raw.rawFiveETools === 'object' &&
			!Array.isArray(raw.rawFiveETools)
				? structuredClone(raw.rawFiveETools)
				: undefined,
		fiveEToolsIdentity: raw.fiveEToolsIdentity
			? structuredClone(raw.fiveEToolsIdentity)
			: undefined,
	};
}

@Component({
	selector: 'app-homebrew-builder',
	standalone: true,
	imports: [
		AppSelectComponent,
		CommonModule,
		DialogFocusDirective,
		FormsModule,
		LucideBookOpen,
		SpellPickerComponent,
		SpellQuickViewComponent,
		SpellReferenceTriggerDirective,
	],
	templateUrl: './homebrew-builder.html',
})
export class HomebrewBuilder {
	private ls = inject(LocalStorageService);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private spellResolver = inject(SpellReferenceResolverService);
	private suggestions = inject(CompendiumSuggestionsService);
	private renderer = inject(CompendiumRendererService);
	private referenceOverlay = inject(ReferenceOverlayService);

	sheetId = signal<string | null>(null);
	title = signal<string>('');
	creature = signal<CreatureSheet>(createEmptyCreature());
	private lastAutoCreatureName = signal<string>('');

	category = signal<HomebrewCategory>('monster');
	tagsText = signal<string>('');
	source = signal<string>('');
	tagComposerOpen = signal(false);
	tagCustom = signal(false);
	tagDraft = signal('');
	originCustom = signal(false);
	readonly knownTags = computed(() =>
		this.uniqueTextList([
			...this.ls.listSheets().flatMap((sheet) => [
				...(sheet.data.tags ?? []),
				...(sheet.tags ?? []),
			]),
			'boss',
			'spellcaster',
			'undead',
		]),
	);
	readonly knownOrigins = computed(() =>
		this.uniqueTextList([
			'Homebrew',
			'5eTools',
			'Manual',
			'Notion',
			'Imported',
			...this.ls.listSheets().flatMap((sheet) => [sheet.data.origin ?? '', sheet.source ?? '']),
		]),
	);

	// draft de magia nova
	spellDraft = signal<SpellDraft>({ name: '', uses: 1, level: 0 });
	spellPickerOpen = signal(false);
	quickSpell = signal<ResolvedSpellReference | null>(null);
	abilityDraft = signal<AbilityDraft>({
		name: '',
		description: '',
		recoveryType: 'manual',
		maxUses: 1,
		cooldownValue: 1,
		rechargeOn: '5,6',
	});
	featureDraft = signal<FeatureDraft>({
		name: '',
		description: '',
		kind: 'trait',
		legendaryCost: 1,
	});
	speedDraft = signal<SpeedDraft>({ type: 'walk', distance: '', hover: false });
	defenseDrafts = signal<Record<DefenseKey, DefenseDraft>>({
		damageVulnerabilities: { types: [], note: '' },
		damageResistances: { types: [], note: '' },
		damageImmunities: { types: [], note: '' },
	});
	languageDraft = signal('');
	senseDraft = signal({ name: '', detail: '' });
	conditionDraft = signal('');
	skillDraft = signal('');
	customSkill = signal(false);
	customSave = signal(false);
	customSaveDraft = signal('');
	customLanguage = signal(false);
	customSense = signal(false);
	customCondition = signal(false);
	customDefense = signal<Record<DefenseKey, boolean>>({
		damageVulnerabilities: false,
		damageResistances: false,
		damageImmunities: false,
	});
	typeBase = signal('');
	typeSubtype = signal('');
	customType = signal(false);
	customTextFields = signal<Record<'size' | 'alignment' | 'challengeRating', boolean>>({
		size: false,
		alignment: false,
		challengeRating: false,
	});
	featureCatalogOpen = signal(false);
	featureCatalogTab = signal<'resources' | 'feats'>('resources');
	featureCatalogSearch = signal('');
	featureComposerKind = signal<CreatureFeatureKind | null>(null);
	inlineComposer = signal<InlineComposer | null>(null);
	monsterFeatures = signal<readonly CompendiumMonsterFeature[]>([]);
	feats = signal<readonly CompendiumFeat[]>([]);
	skillSuggestions = signal<readonly string[]>([]);
	languageSuggestions = signal<readonly string[]>([]);
	senseSuggestions = signal<readonly string[]>([]);
	conditionSuggestions = signal<readonly string[]>([]);

	SPELL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
	readonly abilityKeys: Array<{ key: CreatureAbilityKey; label: string }> = [
		{ key: 'str', label: 'Força' },
		{ key: 'dex', label: 'Destreza' },
		{ key: 'con', label: 'Constituição' },
		{ key: 'int', label: 'Inteligência' },
		{ key: 'wis', label: 'Sabedoria' },
		{ key: 'cha', label: 'Carisma' },
	];
	readonly featureSections: Array<{ kind: CreatureFeatureKind; label: string; empty: string }> = [
		{ kind: 'trait', label: 'Traits', empty: 'Nenhum trait adicionado.' },
		{ kind: 'action', label: 'Actions', empty: 'Nenhuma action adicionada.' },
		{ kind: 'bonus', label: 'Bonus Actions', empty: 'Nenhuma bonus action adicionada.' },
		{ kind: 'reaction', label: 'Reactions', empty: 'Nenhuma reaction adicionada.' },
	];
	readonly sizes = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
	readonly creatureTypes = [
		'aberration',
		'beast',
		'celestial',
		'construct',
		'dragon',
		'elemental',
		'fey',
		'fiend',
		'giant',
		'humanoid',
		'monstrosity',
		'ooze',
		'plant',
		'undead',
	];
	readonly alignments = [
		'lawful good',
		'neutral good',
		'chaotic good',
		'lawful neutral',
		'neutral',
		'chaotic neutral',
		'lawful evil',
		'neutral evil',
		'chaotic evil',
		'unaligned',
	];
	readonly challengeRatings = [
		'0',
		'1/8',
		'1/4',
		'1/2',
		'1',
		'2',
		'3',
		'4',
		'5',
		'6',
		'7',
		'8',
		'9',
		'10',
		'11',
		'12',
		'13',
		'14',
		'15',
		'16',
		'17',
		'18',
		'19',
		'20',
		'21',
		'22',
		'23',
		'24',
		'25',
		'26',
		'27',
		'28',
		'29',
		'30',
	];
	readonly damageTypes = [
		'acid',
		'bludgeoning',
		'cold',
		'fire',
		'force',
		'lightning',
		'necrotic',
		'piercing',
		'poison',
		'psychic',
		'radiant',
		'slashing',
		'thunder',
	];
	readonly recoveryOptions = [
		{ value: 'manual', label: 'Manual' },
		{ value: 'turn-cooldown', label: 'Por turnos' },
		{ value: 'round-cooldown', label: 'Por rounds' },
		{ value: 'dice-recharge', label: 'Recharge por dado' },
		{ value: 'uses-per-day', label: 'Usos por dia' },
		{ value: 'uses-per-combat', label: 'Usos por combate' },
		{ value: 'short-rest', label: 'Descanso curto' },
		{ value: 'long-rest', label: 'Descanso longo' },
	];
	readonly defenseSections: Array<{ key: DefenseKey; label: string }> = [
		{ key: 'damageVulnerabilities', label: 'Vulnerabilidades' },
		{ key: 'damageResistances', label: 'Resistências' },
		{ key: 'damageImmunities', label: 'Imunidades a dano' },
	];
	readonly catalogMonsterFeatures = computed(() => {
		const query = this.featureCatalogSearch().trim().toLocaleLowerCase();
		return this.monsterFeatures().filter(
			(feature) =>
				!query || `${feature.name} ${feature.effect}`.toLocaleLowerCase().includes(query),
		);
	});
	readonly catalogFeats = computed(() => {
		const query = this.featureCatalogSearch().trim().toLocaleLowerCase();
		return this.feats().filter(
			(feat) =>
				!query ||
				`${feat.name} ${feat.source} ${this.featDescription(feat)}`
					.toLocaleLowerCase()
					.includes(query),
		);
	});

	toast = signal<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
	unsavedChangesModal = signal(false);
	private savedSnapshot = signal('');
	private pendingNavigationResolver: ((allowed: boolean) => void) | null = null;
	private toastTimer: number | null = null;

	readonly hasUnsavedChanges = computed(
		() =>
			JSON.stringify({
				title: this.title(),
				creature: this.creature(),
				category: this.category(),
				tagsText: this.tagsText(),
				source: this.source(),
			}) !== this.savedSnapshot(),
	);

	constructor() {
		void this.loadSuggestions();
		const id = this.route.snapshot.paramMap.get('id');
		if (id) {
			const sheet = this.ls.getSheet(id);
			if (sheet) {
				this.sheetId.set(id);
				this.title.set(sheet.title);
				const data = normalizeCreature({
					...sheet.data,
					tags: sheet.data.tags ?? sheet.tags,
					origin: sheet.data.origin ?? sheet.source,
				});
				this.creature.set(data);
				this.lastAutoCreatureName.set(sheet.data.name === sheet.title ? sheet.title : '');

				// 👇 popula meta
				this.category.set(sheet.category ?? 'monster');
				this.tagsText.set((data.tags ?? []).join(', '));
				this.source.set(data.origin ?? '');
			}
		}
		this.syncCreatureType();
		this.markSaved();
	}

	private async loadSuggestions() {
		try {
			const [skills, languages, senses, conditions, monsterFeatures, feats] = await Promise.all([
				this.suggestions.getSkills(),
				this.suggestions.getLanguages(),
				this.suggestions.getSenses(),
				this.suggestions.getConditions(),
				this.suggestions.getMonsterFeatures(),
				this.suggestions.getFeats(),
			]);
			this.skillSuggestions.set(skills);
			this.languageSuggestions.set(languages);
			this.senseSuggestions.set(senses);
			this.conditionSuggestions.set(conditions);
			this.monsterFeatures.set(monsterFeatures);
			this.feats.set(feats);
		} catch {
			// Suggestions enhance free-text fields; editing remains available offline.
		}
	}

	@HostListener('window:beforeunload', ['$event'])
	onBeforeUnload(event: BeforeUnloadEvent) {
		if (!this.hasUnsavedChanges()) return;
		event.preventDefault();
		event.returnValue = '';
	}

	canDeactivate(): boolean | Promise<boolean> {
		if (!this.hasUnsavedChanges()) return true;
		this.unsavedChangesModal.set(true);
		return new Promise((resolve) => {
			this.pendingNavigationResolver = resolve;
		});
	}

	stayOnPage() {
		this.unsavedChangesModal.set(false);
		this.resolvePendingNavigation(false);
	}

	discardChanges() {
		this.unsavedChangesModal.set(false);
		this.resolvePendingNavigation(true);
	}

	// -------- toast --------
	private showToast(t: { type: 'success' | 'error' | 'warn'; text: string }, ms = 2200) {
		if (this.toastTimer) window.clearTimeout(this.toastTimer);
		this.toast.set(t);
		this.toastTimer = window.setTimeout(() => this.toast.set(null), ms);
	}

	private markSaved() {
		this.savedSnapshot.set(
			JSON.stringify({
				title: this.title(),
				creature: this.creature(),
				category: this.category(),
				tagsText: this.tagsText(),
				source: this.source(),
			}),
		);
	}

	private resolvePendingNavigation(allowed: boolean) {
		const resolve = this.pendingNavigationResolver;
		this.pendingNavigationResolver = null;
		resolve?.(allowed);
	}

	// -------- helpers numéricos / slug --------
	private parseNonNegInt(v: any): number {
		const n = Math.floor(Number(v));
		return Number.isFinite(n) ? Math.max(0, n) : 0;
	}

	parseRechargeOnInput(value: string): number[] {
		return (value || '')
			.split(',')
			.map((item) => this.parseNonNegInt(item))
			.filter((item) => item > 0);
	}

	// -------- setters básicos --------
	setTitle(v: string) {
		const currentName = this.creature().name;
		const previousAutoName = this.lastAutoCreatureName();
		const shouldSync = !currentName.trim() || currentName === previousAutoName;

		this.title.set(v);
		if (!shouldSync) return;

		this.creature.update((c) => ({ ...c, name: v }));
		this.lastAutoCreatureName.set(v);
	}

	setName(v: string) {
		this.creature.update((c) => ({ ...c, name: v }));
		if (v === this.title()) {
			this.lastAutoCreatureName.set(v);
		}
	}

	setHp(v: unknown) {
		const n = this.parseNonNegInt(v);
		this.creature.update((c) => ({ ...c, maxHp: n }));
	}

	setAc(v: string) {
		this.creature.update((c) => ({ ...c, armorClass: normalizeArmorClass(v) }));
	}

	// -------- stat-block fields --------
	setCreatureText(
		key:
			| 'size'
			| 'creatureType'
			| 'alignment'
			| 'challengeRating'
			| 'source'
			| 'armorClassNote'
			| 'hitPointFormula',
		value: string,
	) {
		this.creature.update((creature) => {
			const next = { ...creature };
			const text = value.trim();
			if (text) next[key] = text;
			else delete next[key];
			return next;
		});
	}

	selectCatalogText(key: 'size' | 'alignment' | 'challengeRating', value: string) {
		if (value === '__custom__') {
			this.customTextFields.update((fields) => ({ ...fields, [key]: true }));
			return;
		}
		this.customTextFields.update((fields) => ({ ...fields, [key]: false }));
		this.setCreatureText(key, value);
	}

	catalogValue(value: string | undefined, options: readonly string[]) {
		return value && options.includes(value) ? value : value ? '__custom__' : '';
	}

	setCreatureTypeBase(value: string) {
		if (value === '__custom__') {
			this.customType.set(true);
			return;
		}
		this.customType.set(false);
		this.typeBase.set(value);
		this.persistCreatureType();
	}

	setCreatureTypeCustom(value: string) {
		this.customType.set(true);
		this.typeBase.set(value);
		this.persistCreatureType();
	}

	setCreatureSubtype(value: string) {
		this.typeSubtype.set(value);
		this.persistCreatureType();
	}

	private syncCreatureType() {
		const type = this.creature().creatureType?.trim() ?? '';
		const match = type.match(/^([^()]+?)(?:\s*\((.+)\))?$/);
		this.typeBase.set(match?.[1]?.trim() ?? type);
		this.typeSubtype.set(match?.[2]?.trim() ?? '');
		this.customType.set(!!type && !this.creatureTypes.includes(this.typeBase()));
	}

	private persistCreatureType() {
		const base = this.typeBase().trim();
		const subtype = this.typeSubtype().trim();
		this.setCreatureText('creatureType', base ? `${base}${subtype ? ` (${subtype})` : ''}` : '');
	}

	setOptionalNumber(key: 'level' | 'passivePerception', value: unknown) {
		this.creature.update((creature) => {
			const next = { ...creature };
			if (value === '' || value == null || !Number.isFinite(Number(value))) delete next[key];
			else next[key] = this.parseNonNegInt(value);
			return next;
		});
	}

	setCreatureStringList(key: 'aliases' | 'groups', value: string) {
		this.creature.update((creature) => {
			const next = { ...creature };
			const values = this.parseTextList(value);
			if (values.length) next[key] = values;
			else delete next[key];
			return next;
		});
	}

	tagValues() {
		return this.parseTextList(this.tagsText());
	}

	openTagComposer() {
		this.tagComposerOpen.set(true);
		this.tagCustom.set(false);
		this.tagDraft.set('');
	}

	cancelTagComposer() {
		this.tagComposerOpen.set(false);
		this.tagCustom.set(false);
		this.tagDraft.set('');
	}

	selectTag(value: string) {
		if (value === '__custom__') {
			this.tagCustom.set(true);
			return;
		}
		this.addTag(value);
		this.cancelTagComposer();
	}

	confirmCustomTag() {
		this.addTag(this.tagDraft());
		if (this.tagValues().some((tag) => tag.toLocaleLowerCase() === this.tagDraft().trim().toLocaleLowerCase()))
			this.cancelTagComposer();
	}

	removeTag(value: string) {
		this.tagsText.set(
			this.tagValues()
				.filter((tag) => tag.toLocaleLowerCase() !== value.toLocaleLowerCase())
				.join(', '),
		);
	}

	selectOrigin(value: string) {
		if (value === '__custom__') {
			this.originCustom.set(true);
			return;
		}
		this.originCustom.set(false);
		this.source.set(value);
	}

	originValue() {
		const origin = this.source().trim();
		return origin && this.knownOrigins().includes(origin) ? origin : origin ? '__custom__' : '';
	}

	private addTag(value: string) {
		const tags = this.uniqueTextList([...this.tagValues(), value]);
		this.tagsText.set(tags.join(', '));
	}

	setAbilityScore(ability: CreatureAbilityKey, value: unknown) {
		this.creature.update((creature) => {
			const abilityScores = { ...(creature.abilityScores ?? {}) };
			if (value === '' || value == null || !Number.isFinite(Number(value)))
				delete abilityScores[ability];
			else abilityScores[ability] = Math.floor(Number(value));
			return this.replaceOptional(
				creature,
				'abilityScores',
				Object.keys(abilityScores).length ? abilityScores : undefined,
			);
		});
	}

	abilityModifier(ability: CreatureAbilityKey): string {
		const modifier = this.abilityModifierValue(ability);
		if (modifier === null) return '—';
		return `${modifier >= 0 ? '+' : ''}${modifier}`;
	}

	private abilityModifierValue(ability: CreatureAbilityKey): number | null {
		const score = this.creature().abilityScores?.[ability];
		return score === undefined ? null : Math.floor((score - 10) / 2);
	}

	setSpeedDraft(patch: Partial<SpeedDraft>) {
		this.speedDraft.update((draft) => ({ ...draft, ...patch }));
	}

	openInlineComposer(composer: InlineComposer) {
		this.inlineComposer.set(composer);
	}

	openDefenseComposer(key: DefenseKey) {
		this.openInlineComposer(`defense:${key}`);
	}

	cancelInlineComposer() {
		const composer = this.inlineComposer();
		if (composer === 'speed') this.speedDraft.set({ type: 'walk', distance: '', hover: false });
		if (composer === 'save') {
			this.customSave.set(false);
			this.customSaveDraft.set('');
		}
		if (composer === 'skill') {
			this.customSkill.set(false);
			this.skillDraft.set('');
		}
		if (composer?.startsWith('defense:')) {
			const key = composer.slice('defense:'.length) as DefenseKey;
			this.setDefenseDraft(key, { types: [], note: '' });
			this.customDefense.update((values) => ({ ...values, [key]: false }));
		}
		if (composer === 'sense') {
			this.customSense.set(false);
			this.senseDraft.set({ name: '', detail: '' });
		}
		if (composer === 'language') {
			this.customLanguage.set(false);
			this.languageDraft.set('');
		}
		if (composer === 'condition') {
			this.customCondition.set(false);
			this.conditionDraft.set('');
		}
		if (composer === 'spell') this.spellDraft.set({ name: '', uses: 1, level: 0 });
		if (composer === 'special-ability') {
			this.abilityDraft.set({
				name: '',
				description: '',
				recoveryType: 'manual',
				maxUses: 1,
				cooldownValue: 1,
				rechargeOn: '5,6',
			});
		}
		this.inlineComposer.set(null);
	}

	speedLabel(type: string) {
		const labels: Record<string, string> = {
			walk: 'Caminhada',
			fly: 'Voo',
			swim: 'Natação',
			climb: 'Escalada',
			burrow: 'Escavação',
		};
		return labels[type] ?? type;
	}

	addSpeed() {
		const draft = this.speedDraft();
		const distance = draft.distance.trim();
		if (!distance) return;
		this.creature.update((creature) => ({
			...creature,
			speed: [
				...(creature.speed ?? []),
				{ type: draft.type, distance, ...(draft.hover ? { hover: true } : {}) },
			],
		}));
		this.speedDraft.set({ type: 'walk', distance: '', hover: false });
	}

	confirmSpeed() {
		if (!this.speedDraft().distance.trim()) return;
		this.addSpeed();
		this.inlineComposer.set(null);
	}

	updateSpeed(index: number, patch: Partial<NonNullable<CreatureSheet['speed']>[number]>) {
		this.creature.update((creature) => {
			const speed = (creature.speed ?? []).map((entry, entryIndex) => {
				if (entryIndex !== index) return entry;
				const next = { ...entry, ...patch };
				const distance = next.distance?.trim();
				if (distance) next.distance = distance;
				else delete next.distance;
				if (!next.hover) delete next.hover;
				return next;
			});
			return this.replaceOptional(creature, 'speed', speed.length ? speed : undefined);
		});
	}

	removeSpeed(index: number) {
		this.creature.update((creature) => {
			const speed = (creature.speed ?? []).filter((_, entryIndex) => entryIndex !== index);
			return this.replaceOptional(creature, 'speed', speed.length ? speed : undefined);
		});
	}

	addSavingThrow(ability: string) {
		if (
			!this.isAbilityKey(ability) ||
			this.creature().savingThrows?.some((save) => save.ability === ability)
		)
			return;
		this.creature.update((creature) => ({
			...creature,
			savingThrows: [
				...(creature.savingThrows ?? []),
				{ ability, bonus: this.abilityModifierValue(ability) ?? 0 },
			],
		}));
	}

	selectSavingThrow(value: string) {
		if (value === '__custom__') {
			this.customSave.set(true);
			return;
		}
		this.customSave.set(false);
		this.addSavingThrow(value);
		this.inlineComposer.set(null);
	}

	addCustomSavingThrow() {
		const value = this.customSaveDraft().trim().toLocaleLowerCase();
		if (!this.isAbilityKey(value)) {
			this.showToast({
				type: 'warn',
				text: 'Use STR, DEX, CON, INT, WIS ou CHA para a salvaguarda.',
			});
			return;
		}
		this.addSavingThrow(value);
		this.customSaveDraft.set('');
		this.inlineComposer.set(null);
	}

	updateSavingThrow(ability: CreatureAbilityKey, bonus: unknown) {
		this.creature.update((creature) => ({
			...creature,
			savingThrows: (creature.savingThrows ?? []).map((save) =>
				save.ability === ability ? { ...save, bonus: this.parseSignedInt(bonus) } : save,
			),
		}));
	}

	removeSavingThrow(ability: CreatureAbilityKey) {
		this.creature.update((creature) => {
			const savingThrows = (creature.savingThrows ?? []).filter((save) => save.ability !== ability);
			return this.replaceOptional(
				creature,
				'savingThrows',
				savingThrows.length ? savingThrows : undefined,
			);
		});
	}

	addSkill(name: string) {
		const trimmed = name.trim();
		if (
			!trimmed ||
			this.creature().skills?.some((skill) => skill.name.toLowerCase() === trimmed.toLowerCase())
		)
			return;
		this.creature.update((creature) => ({
			...creature,
			skills: [
				...(creature.skills ?? []),
				{ name: trimmed, bonus: this.skillDefaultBonus(trimmed) },
			],
		}));
	}

	selectSkill(value: string) {
		if (value === '__custom__') {
			this.customSkill.set(true);
			return;
		}
		this.customSkill.set(false);
		this.addSkill(value);
		this.inlineComposer.set(null);
	}

	confirmCustomSkill() {
		if (!this.skillDraft().trim()) return;
		this.addSkill(this.skillDraft());
		this.cancelInlineComposer();
	}

	updateSkill(name: string, bonus: unknown) {
		this.creature.update((creature) => ({
			...creature,
			skills: (creature.skills ?? []).map((skill) =>
				skill.name === name ? { ...skill, bonus: this.parseSignedInt(bonus) } : skill,
			),
		}));
	}

	removeSkill(name: string) {
		this.creature.update((creature) => {
			const skills = (creature.skills ?? []).filter((skill) => skill.name !== name);
			return this.replaceOptional(creature, 'skills', skills.length ? skills : undefined);
		});
	}

	setDefenseDraft(key: DefenseKey, patch: Partial<DefenseDraft>) {
		this.defenseDrafts.update((drafts) => ({ ...drafts, [key]: { ...drafts[key], ...patch } }));
	}

	addDefense(key: DefenseKey) {
		const draft = this.defenseDrafts()[key];
		const types = this.uniqueTextList(draft.types);
		if (!types.length) return;
		this.creature.update((creature) => ({
			...creature,
			[key]: [
				...(creature[key] ?? []),
				{ types, ...(draft.note.trim() ? { note: draft.note.trim() } : {}) },
			],
		}));
		this.setDefenseDraft(key, { types: [], note: '' });
	}

	confirmDefense(key: DefenseKey) {
		if (!this.defenseDrafts()[key].types.length) return;
		this.addDefense(key);
		this.inlineComposer.set(null);
	}

	updateDefenseNote(key: DefenseKey, index: number, noteValue: string) {
		this.creature.update((creature) => {
			const defenses = (creature[key] ?? []).map((defense, defenseIndex) => {
				if (defenseIndex !== index) return defense;
				if (noteValue.trim()) return { ...defense, note: noteValue.trim() };
				const next = { ...defense };
				delete next.note;
				return next;
			});
			return { ...creature, [key]: defenses };
		});
	}

	selectDefenseType(key: DefenseKey, value: string) {
		if (value === '__custom__') {
			this.customDefense.update((values) => ({ ...values, [key]: true }));
			return;
		}
		this.customDefense.update((values) => ({ ...values, [key]: false }));
		this.addDefenseType(key, value);
	}

	defenseTypeOptions(key: DefenseKey) {
		const selected = new Set(
			[...(this.creature()[key] ?? []).flatMap((defense) => defense.types), ...this.defenseDrafts()[key].types].map(
				(type) => type.toLocaleLowerCase(),
			),
		);
		return this.damageTypes.filter((type) => !selected.has(type.toLocaleLowerCase()));
	}

	addDefenseType(key: DefenseKey, value: string) {
		const type = value.trim();
		if (!type) return;
		this.setDefenseDraft(key, {
			types: this.uniqueTextList([...this.defenseDrafts()[key].types, type]),
		});
	}

	removeDefenseType(key: DefenseKey, type: string) {
		this.setDefenseDraft(key, {
			types: this.defenseDrafts()[key].types.filter((item) => item !== type),
		});
	}

	removeDefense(key: DefenseKey, index: number) {
		this.creature.update((creature) => {
			const defenses = (creature[key] ?? []).filter((_, defenseIndex) => defenseIndex !== index);
			return this.replaceOptional(creature, key, defenses.length ? defenses : undefined);
		});
	}

	removeSimpleDefenseType(key: DefenseKey, type: string) {
		this.creature.update((creature) => {
			const defenses = (creature[key] ?? []).flatMap((defense) => {
				if (defense.note) return [defense];
				const types = defense.types.filter((candidate) => candidate !== type);
				return types.length ? [{ ...defense, types }] : [];
			});
			return this.replaceOptional(creature, key, defenses.length ? defenses : undefined);
		});
	}

	addLanguage() {
		this.addTextListItem('languages', this.languageDraft(), () => this.languageDraft.set(''));
	}

	confirmCustomLanguage() {
		if (!this.languageDraft().trim()) return;
		this.addLanguage();
		this.cancelInlineComposer();
	}

	selectLanguage(value: string) {
		if (value === '__custom__') {
			this.customLanguage.set(true);
			return;
		}
		this.customLanguage.set(false);
		this.languageDraft.set(value);
		this.addLanguage();
		this.inlineComposer.set(null);
	}

	removeLanguage(language: string) {
		this.removeTextListItem('languages', language);
	}

	addCondition() {
		this.addTextListItem('conditionImmunities', this.conditionDraft(), () =>
			this.conditionDraft.set(''),
		);
	}

	confirmCustomCondition() {
		if (!this.conditionDraft().trim()) return;
		this.addCondition();
		this.cancelInlineComposer();
	}

	selectCondition(value: string) {
		if (value === '__custom__') {
			this.customCondition.set(true);
			return;
		}
		this.customCondition.set(false);
		this.conditionDraft.set(value);
		this.addCondition();
		this.inlineComposer.set(null);
	}

	removeCondition(condition: string) {
		this.removeTextListItem('conditionImmunities', condition);
	}

	addSense() {
		const draft = this.senseDraft();
		const name = draft.name.trim();
		if (!name) return;
		this.creature.update((creature) => ({
			...creature,
			senses: [
				...(creature.senses ?? []),
				{ name, ...(draft.detail.trim() ? { detail: draft.detail.trim() } : {}) },
			],
		}));
		this.senseDraft.set({ name: '', detail: '' });
	}

	confirmSense() {
		if (!this.senseDraft().name.trim()) return;
		this.addSense();
		this.inlineComposer.set(null);
	}

	setSenseDraft(patch: Partial<{ name: string; detail: string }>) {
		this.senseDraft.update((draft) => ({ ...draft, ...patch }));
	}

	selectSense(value: string) {
		if (value === '__custom__') {
			this.customSense.set(true);
			this.setSenseDraft({ name: '' });
			return;
		}
		this.customSense.set(false);
		this.setSenseDraft({ name: value });
	}

	updateSense(index: number, nameValue: string, detailValue: string) {
		this.creature.update((creature) => {
			const name = nameValue.trim();
			const senses = (creature.senses ?? []).flatMap((sense, senseIndex) =>
				senseIndex !== index
					? [sense]
					: name
						? [{ name, ...(detailValue.trim() ? { detail: detailValue.trim() } : {}) }]
						: [],
			);
			return this.replaceOptional(creature, 'senses', senses.length ? senses : undefined);
		});
	}

	removeSense(index: number) {
		this.creature.update((creature) => {
			const senses = (creature.senses ?? []).filter((_, senseIndex) => senseIndex !== index);
			return this.replaceOptional(creature, 'senses', senses.length ? senses : undefined);
		});
	}

	setFeatureDraft(patch: Partial<FeatureDraft>) {
		this.featureDraft.update((draft) => ({ ...draft, ...patch }));
	}

	featuresByKind(kind: CreatureFeatureKind) {
		return this.creature().features.filter((feature) => feature.kind === kind);
	}

	openFeatureComposer(kind: CreatureFeatureKind) {
		this.featureDraft.set({ name: '', description: '', kind, legendaryCost: 1 });
		this.featureComposerKind.set(kind);
	}

	cancelFeatureComposer() {
		this.featureComposerKind.set(null);
		this.featureDraft.set({ name: '', description: '', kind: 'trait', legendaryCost: 1 });
	}

	addFeature() {
		const draft = this.featureDraft();
		const name = draft.name.trim();
		if (!name) return;
		this.creature.update((creature) => ({
			...creature,
			features: [
				...creature.features,
				{
					id: crypto.randomUUID(),
					name,
					kind: draft.kind,
					...(draft.description.trim() ? { description: draft.description.trim() } : {}),
					...(draft.kind === 'legendary'
						? { legendaryCost: Math.max(1, this.parseNonNegInt(draft.legendaryCost)) }
						: {}),
				},
			],
		}));
		this.cancelFeatureComposer();
	}

	openFeatureCatalog() {
		this.featureCatalogTab.set('resources');
		this.featureCatalogSearch.set('');
		this.featureCatalogOpen.set(true);
	}

	addCatalogFeature(item: CompendiumMonsterFeature | CompendiumFeat) {
		const description = 'effect' in item ? item.effect : this.featDescription(item);
		this.creature.update((creature) => ({
			...creature,
			features: [
				...creature.features,
				{ id: crypto.randomUUID(), name: item.name, description, kind: 'trait' },
			],
		}));
		this.featureCatalogOpen.set(false);
	}

	featDescription(feat: CompendiumFeat) {
		return this.renderer.renderEntries(feat.entries as RawFiveEToolsEntry[]);
	}

	private skillDefaultBonus(name: string): number {
		const skillAbilities: Record<string, CreatureAbilityKey> = {
			acrobatics: 'dex',
			'animal handling': 'wis',
			arcana: 'int',
			athletics: 'str',
			deception: 'cha',
			history: 'int',
			insight: 'wis',
			intimidation: 'cha',
			investigation: 'int',
			medicine: 'wis',
			nature: 'int',
			perception: 'wis',
			performance: 'cha',
			persuasion: 'cha',
			religion: 'int',
			'sleight of hand': 'dex',
			stealth: 'dex',
			survival: 'wis',
		};
		const ability = skillAbilities[name.trim().toLocaleLowerCase()];
		return ability ? (this.abilityModifierValue(ability) ?? 0) : 0;
	}

	updateFeature(id: string, patch: Partial<CreatureFeature>) {
		this.creature.update((creature) => ({
			...creature,
			features: creature.features.map((feature) => {
				if (feature.id !== id) return feature;
				const next = { ...feature, ...patch };
				const description = next.description?.trim();
				if (description) next.description = description;
				else delete next.description;
				if (next.kind !== 'legendary') delete next.legendaryCost;
				return next;
			}),
		}));
	}

	removeFeature(id: string) {
		this.creature.update((creature) => ({
			...creature,
			features: creature.features.filter((feature) => feature.id !== id),
		}));
	}

	setLegendaryMetadata(key: 'count' | 'intro', value: unknown) {
		this.creature.update((creature) => {
			const legendaryActions = { ...(creature.legendaryActions ?? {}) };
			if (key === 'count') {
				if (value === '' || value == null || Number(value) <= 0 || !Number.isFinite(Number(value)))
					delete legendaryActions.count;
				else legendaryActions.count = this.parseNonNegInt(value);
			} else {
				const text = String(value ?? '').trim();
				if (text) legendaryActions.intro = text;
				else delete legendaryActions.intro;
			}
			return this.replaceOptional(
				creature,
				'legendaryActions',
				Object.keys(legendaryActions).length ? legendaryActions : undefined,
			);
		});
	}

	setSpellcastingMetadata(
		key: 'ability' | 'spellSaveDc' | 'spellAttackBonus' | 'header' | 'slotRecovery',
		value: unknown,
	) {
		this.creature.update((creature) => {
			const spellcasting = { ...(creature.spellcasting ?? {}) };
			if (key === 'ability') {
				if (this.isAbilityKey(value)) spellcasting.ability = value;
				else delete spellcasting.ability;
			} else if (key === 'header' || key === 'slotRecovery') {
				const text = String(value ?? '').trim();
				if (text) spellcasting[key] = text;
				else delete spellcasting[key];
			} else if (value === '' || value == null || !Number.isFinite(Number(value))) {
				delete spellcasting[key];
			} else {
				spellcasting[key] =
					key === 'spellSaveDc' ? this.parseNonNegInt(value) : this.parseSignedInt(value);
			}
			return this.replaceOptional(
				creature,
				'spellcasting',
				Object.keys(spellcasting).length ? spellcasting : undefined,
			);
		});
	}

	private addTextListItem(
		key: 'languages' | 'conditionImmunities',
		value: string,
		clear: () => void,
	) {
		const additions = this.parseTextList(value);
		if (!additions.length) return;
		this.creature.update((creature) => ({
			...creature,
			[key]: this.uniqueTextList([...(creature[key] ?? []), ...additions]),
		}));
		clear();
	}

	private removeTextListItem(key: 'languages' | 'conditionImmunities', value: string) {
		this.creature.update((creature) => {
			const values = (creature[key] ?? []).filter((item) => item !== value);
			return this.replaceOptional(creature, key, values.length ? values : undefined);
		});
	}

	private parseTextList(value: string): string[] {
		return this.uniqueTextList(value.split(','));
	}

	private uniqueTextList(values: readonly string[]): string[] {
		const unique = new Map<string, string>();
		for (const value of values) {
			const trimmed = value.trim();
			if (trimmed && !unique.has(trimmed.toLocaleLowerCase()))
				unique.set(trimmed.toLocaleLowerCase(), trimmed);
		}
		return [...unique.values()];
	}

	private replaceOptional<Key extends OptionalCreatureField>(
		creature: CreatureSheet,
		key: Key,
		value: CreatureSheet[Key] | undefined,
	): CreatureSheet {
		const next = { ...creature };
		if (value === undefined) delete next[key];
		else next[key] = value;
		return next;
	}

	private parseSignedInt(value: unknown): number {
		const number = Math.floor(Number(value));
		return Number.isFinite(number) ? number : 0;
	}

	private isAbilityKey(value: unknown): value is CreatureAbilityKey {
		return this.abilityKeys.some((ability) => ability.key === value);
	}

	savingThrowOptions() {
		const selected = new Set((this.creature().savingThrows ?? []).map((save) => save.ability));
		const options = this.abilityKeys
			.filter((ability) => !selected.has(ability.key))
			.map((ability) => ({ value: ability.key, label: ability.label }));
		return [...options, { value: '__custom__', label: 'Personalizado' }];
	}

	savingThrowLabel(ability: CreatureAbilityKey) {
		return (
			this.abilityKeys.find((candidate) => candidate.key === ability)?.label ??
			ability.toUpperCase()
		);
	}

	skillOptions() {
		const selected = new Set(
			(this.creature().skills ?? []).map((skill) => skill.name.trim().toLocaleLowerCase()),
		);
		return this.skillSuggestions()
			.filter((skill) => !selected.has(skill.trim().toLocaleLowerCase()))
			.map((skill) => ({ value: skill, label: skill }));
	}

	// -------- spellcasting --------
	slotValue(level: number): number | null {
		return this.creature().spellSlots.find((slot) => slot.level === level)?.max ?? null;
	}

	setSpellSlot(level: number, v: unknown) {
		const value = this.parseNonNegInt(v);

		this.creature.update((c) => {
			const spellSlots = c.spellSlots.filter((slot) => slot.level !== level);
			if (value > 0) spellSlots.push({ level, max: value });
			return { ...c, spellSlots: spellSlots.sort((left, right) => left.level - right.level) };
		});
	}

	setSpellDraft(patch: Partial<SpellDraft>) {
		this.spellDraft.update((d) => ({ ...d, ...patch }));
	}

	addSpell() {
		const d = this.spellDraft();
		const name = (d.name || '').trim();
		if (!name) return;

		this.creature.update((c) => {
			return {
				...c,
				spells: [
					...c.spells,
					{
						id: crypto.randomUUID(),
						name,
						uses: this.parseNonNegInt(d.uses),
						level: this.parseNonNegInt(d.level),
					},
				],
			};
		});

		this.spellDraft.set({ name: '', uses: 1, level: 0 });
	}

	confirmSpell() {
		if (!this.spellDraft().name.trim()) return;
		this.addSpell();
		this.inlineComposer.set(null);
	}

	openSpellPicker() {
		this.spellPickerOpen.set(true);
	}

	closeSpellPicker() {
		this.spellPickerOpen.set(false);
	}

	addCompendiumSpell(spell: CompendiumSpellListEntry) {
		const name = spell.name.trim();
		const source = spell.source.trim();
		const duplicate = this.creature().spells.some(
			(candidate) =>
				candidate.source?.trim().toLocaleLowerCase() === source.toLocaleLowerCase() &&
				candidate.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
		);
		if (duplicate) {
			this.showToast({ type: 'warn', text: 'Essa magia dessa fonte já foi adicionada.' });
			return;
		}

		this.creature.update((creature) => ({
			...creature,
			spells: [
				...creature.spells,
				{
					id: crypto.randomUUID(),
					name,
					source,
					level: spell.level,
					uses: 1,
				},
			],
		}));
		this.closeSpellPicker();
	}

	openSpellQuickView(spell: CreatureSpell) {
		this.referenceOverlay.openSpell({ name: spell.name, source: spell.source });
	}

	updateSpell(id: string, patch: Partial<CreatureSheet['spells'][number]>) {
		this.creature.update((c) => {
			return {
				...c,
				spells: c.spells.map((spell) => {
					if (spell.id !== id) return spell;
					const source =
						spell.source && patch.name !== undefined && patch.name !== spell.name
							? undefined
							: spell.source;
					return { ...spell, ...patch, source };
				}),
			};
		});
	}

	removeSpell(id: string) {
		this.creature.update((c) => ({ ...c, spells: c.spells.filter((spell) => spell.id !== id) }));
	}

	// -------- special abilities --------
	setAbilityDraft(patch: Partial<AbilityDraft>) {
		this.abilityDraft.update((draft) => ({ ...draft, ...patch }));
	}

	addSpecialAbility() {
		const draft = this.abilityDraft();
		const name = (draft.name || '').trim();
		if (!name) {
			this.showToast({ type: 'warn', text: 'Defina um nome para a habilidade.' });
			return;
		}

		const rechargeOn = (draft.rechargeOn || '')
			.split(',')
			.map((value) => this.parseNonNegInt(value))
			.filter((value) => value > 0);

		const ability: CreatureSpecialAbility = {
			id: crypto.randomUUID(),
			name,
			description: (draft.description || '').trim() || undefined,
			recoveryType: draft.recoveryType,
			maxUses:
				draft.recoveryType === 'uses-per-day' ||
				draft.recoveryType === 'uses-per-combat' ||
				draft.recoveryType === 'short-rest' ||
				draft.recoveryType === 'long-rest'
					? Math.max(1, this.parseNonNegInt(draft.maxUses) || 1)
					: undefined,
			cooldownTurns:
				draft.recoveryType === 'turn-cooldown'
					? Math.max(1, this.parseNonNegInt(draft.cooldownValue))
					: undefined,
			cooldownRounds:
				draft.recoveryType === 'round-cooldown'
					? Math.max(1, this.parseNonNegInt(draft.cooldownValue))
					: undefined,
			rechargeDice: draft.recoveryType === 'dice-recharge' ? 'd6' : undefined,
			rechargeOn: draft.recoveryType === 'dice-recharge' ? rechargeOn : undefined,
		};

		this.creature.update((creature) => ({
			...creature,
			specialAbilities: [...(creature.specialAbilities ?? []), ability],
		}));

		this.abilityDraft.set({
			name: '',
			description: '',
			recoveryType: 'manual',
			maxUses: 1,
			cooldownValue: 1,
			rechargeOn: '5,6',
		});
	}

	confirmSpecialAbility() {
		if (!this.abilityDraft().name.trim()) return;
		this.addSpecialAbility();
		this.inlineComposer.set(null);
	}

	updateSpecialAbility(id: string, patch: Partial<CreatureSpecialAbility>) {
		this.creature.update((creature) => ({
			...creature,
			specialAbilities: (creature.specialAbilities ?? []).map((ability) =>
				ability.id === id ? { ...ability, ...patch } : ability,
			),
		}));
	}

	setSpecialAbilityRecovery(id: string, recoveryType: CreatureAbilityRecoveryType) {
		const ability = this.creature().specialAbilities.find((candidate) => candidate.id === id);
		if (!ability) return;
		this.updateSpecialAbility(id, {
			recoveryType,
			cooldownTurns: recoveryType === 'turn-cooldown' ? (ability.cooldownTurns ?? 1) : undefined,
			cooldownRounds: recoveryType === 'round-cooldown' ? (ability.cooldownRounds ?? 1) : undefined,
			rechargeDice: recoveryType === 'dice-recharge' ? 'd6' : undefined,
			rechargeOn: recoveryType === 'dice-recharge' ? (ability.rechargeOn ?? [5, 6]) : undefined,
			maxUses:
				recoveryType === 'uses-per-day' ||
				recoveryType === 'uses-per-combat' ||
				recoveryType === 'short-rest' ||
				recoveryType === 'long-rest'
					? (ability.maxUses ?? 1)
					: undefined,
		});
	}

	setSpecialAbilityCooldown(id: string, type: 'turn-cooldown' | 'round-cooldown', value: unknown) {
		const cooldown = Math.max(1, this.parseNonNegInt(value) || 1);
		this.updateSpecialAbility(
			id,
			type === 'turn-cooldown' ? { cooldownTurns: cooldown } : { cooldownRounds: cooldown },
		);
	}

	setSpecialAbilityMaxUses(id: string, value: unknown) {
		this.updateSpecialAbility(id, { maxUses: Math.max(1, this.parseNonNegInt(value) || 1) });
	}

	setSpecialAbilityRechargeOn(id: string, value: string) {
		const rechargeOn = value
			.split(',')
			.map((entry) => this.parseNonNegInt(entry))
			.filter((entry) => entry > 0 && entry <= 6);
		this.updateSpecialAbility(id, { rechargeOn });
	}

	toggleSpecialAbilityRechargeFace(id: string, face: number) {
		const ability = this.creature().specialAbilities.find((candidate) => candidate.id === id);
		if (!ability) return;
		const faces = ability.rechargeOn ?? [5, 6];
		const rechargeOn = faces.includes(face)
			? faces.filter((candidate) => candidate !== face)
			: [...faces, face].sort((left, right) => left - right);
		this.updateSpecialAbility(id, { rechargeOn });
	}

	specialAbilityRechargeOnValue(ability: CreatureSpecialAbility): string {
		return ability.rechargeOn?.join(', ') ?? '5, 6';
	}

	removeSpecialAbility(id: string) {
		this.creature.update((creature) => ({
			...creature,
			specialAbilities: (creature.specialAbilities ?? []).filter((ability) => ability.id !== id),
		}));
	}

	abilityStatusPreview(ability: CreatureSpecialAbility): string {
		if (ability.recoveryType === 'turn-cooldown') {
			const turns = Math.max(1, ability.cooldownTurns ?? 1);
			return turns === 1 ? 'Volta em 1 turno' : `Volta em ${turns} turnos`;
		}
		if (ability.recoveryType === 'round-cooldown') {
			const rounds = Math.max(1, ability.cooldownRounds ?? 1);
			return rounds === 1 ? 'Volta em 1 round' : `Volta em ${rounds} rounds`;
		}
		if (ability.recoveryType === 'dice-recharge') {
			const targets = ability.rechargeOn?.length ? ability.rechargeOn.join('–') : '5–6';
			return `Recharge ${targets}`;
		}
		if (ability.recoveryType === 'uses-per-day') {
			const uses = Math.max(1, ability.maxUses ?? 1);
			return uses === 1 ? '1 uso por dia' : `${uses} usos por dia`;
		}
		if (ability.recoveryType === 'uses-per-combat') {
			const uses = Math.max(1, ability.maxUses ?? 1);
			return uses === 1 ? '1 uso por combate' : `${uses} usos por combate`;
		}
		if (ability.recoveryType === 'short-rest') {
			const uses = Math.max(1, ability.maxUses ?? 1);
			return uses === 1 ? '1 uso por descanso curto' : `${uses} usos por descanso curto`;
		}
		if (ability.recoveryType === 'long-rest') {
			const uses = Math.max(1, ability.maxUses ?? 1);
			return uses === 1 ? '1 uso por descanso longo' : `${uses} usos por descanso longo`;
		}
		return 'Recarga manual';
	}

	// -------- salvar sheet --------
	save() {
		const title = this.title().trim() || this.creature().name;
		const category = this.category();
		const data = structuredClone(this.creature());

		if (!data.name.trim()) {
			this.showToast({ type: 'warn', text: 'Defina um nome para a criatura.' });
			return;
		}

		const rawTags = this.tagsText()
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		const source = this.source().trim();
		if (rawTags.length) data.tags = this.uniqueTextList(rawTags);
		else delete data.tags;
		if (source) data.origin = source;
		else delete data.origin;

		const id = this.sheetId();
		if (!id) {
			const saved = this.ls.createSheet({
				title,
				data: structuredClone(data),
				category,
				tags: rawTags,
				source,
			});

			this.sheetId.set(saved.id);
			this.markSaved();
			this.showToast({ type: 'success', text: 'Sheet criada!' });
			this.router.navigate(['/home/homebrew-builder', saved.id]);
		} else {
			this.ls.updateSheet(id, {
				title,
				data: structuredClone(data),
				category,
				tags: rawTags,
				source,
			});
			this.markSaved();
			this.showToast({ type: 'success', text: 'Sheet atualizada.' });
		}
	}

	backToList() {
		this.router.navigate(['/home/homebrew']);
	}
}

export const canDeactivateHomebrewBuilder: CanDeactivateFn<HomebrewBuilder> = (component) =>
	component.canDeactivate();
