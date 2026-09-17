import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import type { CompendiumSpellListEntry } from '../../models/compendium-spell-model';
import { CompendiumSpellRepositoryService } from '../../services/compendium-spell-repository-service/compendium-spell-repository-service';
import { CompendiumSuggestionsService } from '../../services/compendium-suggestions-service/compendium-suggestions-service';
import { LocalStorageService } from '../../services/local-storage-service/local-storage-service';
import { CampaignWorldService } from '../../services/campaign-world-service/campaign-world-service';
import { HomebrewBuilder } from './homebrew-builder';

describe('HomebrewBuilder', () => {
	let component: HomebrewBuilder;
	let fixture: ComponentFixture<HomebrewBuilder>;

	beforeEach(async () => {
		localStorage.clear();
		await TestBed.configureTestingModule({
			imports: [HomebrewBuilder],
			providers: [
				provideZonelessChangeDetection(),
				provideRouter([]),
				{
					provide: ActivatedRoute,
					useValue: {
						snapshot: {
							paramMap: convertToParamMap({}),
						},
					},
				},
				{
					provide: CompendiumSpellRepositoryService,
					useValue: { getIndex: async () => ({ sources: [], spells: [] }) },
				},
				{
					provide: CompendiumSuggestionsService,
					useValue: {
						getSkills: async () => ['Arcana'],
						getLanguages: async () => [],
						getSenses: async () => [],
						getConditions: async () => [],
						getMonsterFeatures: async () => [
							{ name: 'Pack Tactics', effect: 'Advantage with an ally.', example: 'Example.' },
						],
						getFeats: async () => [{ name: 'Actor', source: 'PHB', entries: ['Mimicry.'] }],
					},
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(HomebrewBuilder);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('lists only formal guilds and groups for sheet organization relations', () => {
		const world = TestBed.inject(CampaignWorldService);
		world.world.set({
			empires: [],
			states: [],
			settlements: [],
			organizations: [
				{ id: 'winterhold', name: 'Winterhold', aliases: [], organizationType: 'guild', presence: [] },
				{ id: 'community', name: 'Comunidade local', aliases: [], organizationType: 'community', presence: [] },
			],
			pointsOfInterest: [],
		} as never);

		expect(component.organizationOptions().map((option) => option.label)).toEqual(['Winterhold']);
	});

	it('syncs title into creature name until the user edits the name manually', () => {
		component.setTitle('Rosa V.');
		expect(component.creature().name).toBe('Rosa V.');

		component.setTitle('Rosa Vermelha');
		expect(component.creature().name).toBe('Rosa Vermelha');

		component.setName('Lady Rosa');
		component.setTitle('Rosa Final');
		expect(component.creature().name).toBe('Lady Rosa');
	});

	it('asks before navigating away with unsaved changes', async () => {
		component.setTitle('Ficha pendente');
		const navigation = component.canDeactivate();

		expect(component.unsavedChangesModal()).toBeTrue();
		component.stayOnPage();
		expect(await navigation).toBeFalse();

		const discardNavigation = component.canDeactivate();
		component.discardChanges();
		expect(await discardNavigation).toBeTrue();
	});

	it('stores maximum spell slots without runtime usage state', () => {
		component.setSpellSlot(1, 2);

		expect(component.slotValue(1)).toBe(2);
		expect(component.creature().spellSlots).toEqual([{ level: 1, max: 2 }]);
	});

	it('shows derived ability modifiers while keeping the entered score as the source of truth', () => {
		component.setAbilityScore('str', 13);
		component.setAbilityScore('dex', 20);

		expect(component.abilityModifier('str')).toBe('+1');
		expect(component.abilityModifier('dex')).toBe('+5');
		expect(component.abilityModifier('con')).toBe('—');
	});

	it('calculates new saves and known skills from ability, CR, and expertise', () => {
		component.setAbilityScore('dex', 14);
		component.setAbilityScore('wis', 12);
		component.setCreatureText('challengeRating', '5');
		component.addSavingThrow('dex');
		component.addSkill('Acrobatics');
		component.addSkill('Perception');

		expect(component.creature().savingThrows).toEqual([{ ability: 'dex', bonus: 5 }]);
		expect(component.creature().skills).toEqual([
			{ name: 'Acrobatics', ability: 'dex', proficiencyMultiplier: 1, bonus: 5 },
			{ name: 'Perception', ability: 'wis', proficiencyMultiplier: 1, bonus: 4 },
		]);
		expect(component.passivePerception()).toBe(14);

		component.setSkillProficiencyMultiplier('Perception', true);
		expect(component.creature().skills?.[1].bonus).toBe(7);
		expect(component.passivePerception()).toBe(17);
	});

	it('keeps special ability recovery data consistent when changing its recovery type', () => {
		component.setAbilityDraft({
			name: 'Passo sombrio',
			recoveryType: 'turn-cooldown',
			cooldownValue: 2,
		});
		component.addSpecialAbility();

		const ability = component.creature().specialAbilities[0];
		expect(ability).toEqual(
			jasmine.objectContaining({ recoveryType: 'turn-cooldown', cooldownTurns: 2 }),
		);

		component.setSpecialAbilityRecovery(ability.id, 'uses-per-day');
		expect(component.creature().specialAbilities[0]).toEqual(
			jasmine.objectContaining({ recoveryType: 'uses-per-day', maxUses: 1 }),
		);
		expect(component.creature().specialAbilities[0].cooldownTurns).toBeUndefined();
	});

	it('manages case-insensitive custom tags and keeps origin separate from the source reference', () => {
		component.openTagComposer();
		component.tagDraft.set('Boss');
		component.confirmCustomTag();
		component.openTagComposer();
		component.tagDraft.set('boss');
		component.confirmCustomTag();
		component.selectOrigin('__custom__');
		component.source.set('Campanha Nagawoods');
		component.setCreatureText('source', 'XPHB');

		expect(component.tagValues()).toEqual(['Boss']);
		expect(component.source()).toBe('Campanha Nagawoods');
		expect(component.creature().source).toBe('XPHB');
	});

	it('edits formal classes only for NPCs and PCs and clears them for monsters', () => {
		component.setCategory('npc');
		component.setClass('ranger', true);
		expect(component.classes()).toEqual(['ranger']);

		component.setCategory('monster');
		expect(component.classes()).toEqual([]);
		component.setClass('rogue', true);
		expect(component.classes()).toEqual([]);
	});

	it('saves classes in the envelope and never in CreatureSheet.data', () => {
		const storage = TestBed.inject(LocalStorageService);
		component.setCategory('npc');
		component.setClass('ranger', true);
		component.setTitle('Classe formal');
		component.save();

		const saved = storage.listSheets()[0];
		expect(saved.classes).toEqual(['ranger']);
		expect('classes' in saved.data).toBeFalse();
	});

	it('reveals the matching recovery parameter before a special ability is added', () => {
		component.openInlineComposer('special-ability');
		component.setAbilityDraft({ recoveryType: 'turn-cooldown' });
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).toContain('Turnos até voltar');
		expect(fixture.nativeElement.querySelector('[name="new-ability-turns"]')).not.toBeNull();
	});

	it('opens the visible compendium action', () => {
		const buttons = fixture.nativeElement.querySelectorAll(
			'button',
		) as NodeListOf<HTMLButtonElement>;
		const action = Array.from(buttons).find((button) =>
			button.textContent?.includes('Compêndio'),
		);

		expect(action).toBeTruthy();
		action!.click();
		fixture.detectChanges();

		expect(component.spellPickerOpen()).toBeTrue();
		expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
	});

	it('opens, confirms, and closes the temporary speed composer', () => {
		expect(fixture.nativeElement.querySelector('[name="new-speed-distance"]')).toBeNull();

		component.openInlineComposer('speed');
		component.setSpeedDraft({ distance: '9 m' });
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[name="new-speed-distance"]')).not.toBeNull();

		component.confirmSpeed();
		fixture.detectChanges();
		expect(component.creature().speed).toEqual([{ type: 'walk', distance: '9 m' }]);
		expect(fixture.nativeElement.querySelector('[name="new-speed-distance"]')).toBeNull();
	});

	it('adds a compendium spell with its canonical source and rejects only that same source', () => {
		const spell: CompendiumSpellListEntry = {
			id: 'PHB:fireball',
			name: 'Fireball',
			source: 'PHB',
			level: 3,
			school: 'EV',
			ritual: false,
			concentration: false,
			aliases: [],
			classes: ['Wizard'],
		};

		component.addCompendiumSpell(spell);
		component.addCompendiumSpell(spell);

		expect(component.creature().spells).toEqual([
			jasmine.objectContaining({ name: 'Fireball', source: 'PHB', level: 3, uses: 1 }),
		]);
		expect(component.toast()?.type).toBe('warn');
	});

	it('keeps a compendium spell in the abilities data after adding it', () => {
		component.addCompendiumSpell({
			id: 'PHB:aid',
			name: 'Aid',
			source: 'PHB',
			level: 2,
			school: 'A',
			ritual: false,
			concentration: false,
			aliases: [],
			classes: [],
		});
		expect(component.creature().spells).toEqual([
			jasmine.objectContaining({ name: 'Aid', source: 'PHB', level: 2, uses: 1 }),
		]);
	});

	it('allows manual and alternate-source spells with the same name and clears stale links on rename', () => {
		component.addCompendiumSpell({
			id: 'PHB:fireball',
			name: 'Fireball',
			source: 'PHB',
			level: 3,
			school: 'EV',
			ritual: false,
			concentration: false,
			aliases: [],
			classes: [],
		});
		component.addCompendiumSpell({
			id: 'XGE:fireball',
			name: 'Fireball',
			source: 'XGE',
			level: 3,
			school: 'EV',
			ritual: false,
			concentration: false,
			aliases: [],
			classes: [],
		});
		component.setSpellDraft({ name: 'Fireball' });
		component.addSpell();
		const linkedSpellId = component.creature().spells[0].id;

		component.updateSpell(linkedSpellId, { name: 'Custom Fireball' });

		expect(component.creature().spells).toHaveSize(3);
		expect(component.creature().spells[0].source).toBeUndefined();
	});

	it('shows feedback instead of saving a sheet without a creature name', () => {
		component.save();
		expect(component.toast()?.type).toBe('warn');
		expect(component.toast()?.text).toContain('nome');
	});

	it('saves contextual metadata in the sheet envelope without changing the stat block', () => {
		const storage = TestBed.inject(LocalStorageService);
		component.setTitle('Guarda regional');
		component.archived.set(true);
		component.generic.set(true);
		component.locationRefs.set([]);
		component.organizationRefs.set([
			{ organizationId: 'missing-organization', relation: 'institution' },
		]);
		component.save();

		const saved = storage.listSheets()[0];
		expect(saved.archived).toBeTrue();
		expect(saved.generic).toBeTrue();
		expect(saved.locationRefs ?? []).toEqual(component.locationRefs());
		expect(saved.organizationRefs).toEqual(component.organizationRefs());
		expect(component.isBrokenOrganizationRef(component.organizationRefs()[0])).toBeTrue();
		expect('locationRefs' in saved.data).toBeFalse();
		expect('organizationRefs' in saved.data).toBeFalse();
	});

	it('uses the four requested semantic groups without native selects or datalists', () => {
		const text = fixture.nativeElement.textContent as string;

		expect(text).toContain('Essencial');
		expect(text).toContain('Estatísticas');
		expect(text).toContain('Defesas, percepção e idiomas');
		expect(text).toContain('Habilidades');
		expect(fixture.nativeElement.querySelector('select')).toBeNull();
		expect(fixture.nativeElement.querySelector('datalist')).toBeNull();
	});

	it('shows the selected sense in its trigger before it is added', () => {
		component.openInlineComposer('sense');
		component.senseSuggestions.set(['Darkvision']);
		component.selectSense('Darkvision');
		fixture.detectChanges();

		const root = fixture.nativeElement as HTMLElement;
		const senseSelect = Array.from(root.querySelectorAll('app-select')).find((select) =>
			select.textContent?.includes('Sentido'),
		);

		expect(senseSelect?.textContent).toContain('Darkvision');
		expect(component.creature().senses).toBeUndefined();
	});

	it('clears a previous sense selection when switching to custom input', () => {
		component.selectSense('Darkvision');
		component.selectSense('__custom__');

		expect(component.customSense()).toBeTrue();
		expect(component.senseDraft().name).toBe('');
	});

	it('focuses the catalog search and closes it with Escape', async () => {
		component.openFeatureCatalog();
		fixture.detectChanges();
		await fixture.whenStable();

		const search = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
			'[name="feature-catalog-search"]',
		);
		expect(document.body.classList.contains('app-dialog-open')).toBeTrue();
		expect(document.activeElement).toBe(search);

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		fixture.detectChanges();

		expect(component.featureCatalogOpen()).toBeFalse();
		expect(document.body.classList.contains('app-dialog-open')).toBeFalse();
	});

	it('retains a single creature type string while allowing an optional subtype', () => {
		component.setCreatureTypeBase('humanoid');
		component.setCreatureSubtype('elf');

		expect(component.creature().creatureType).toBe('humanoid (elf)');
	});

	it('builds damage defenses from selected type chips instead of comma-delimited text', () => {
		component.selectDefenseType('damageResistances', 'fire');
		component.selectDefenseType('damageResistances', 'cold');
		component.setDefenseDraft('damageResistances', { note: 'from nonmagical attacks' });
		component.addDefense('damageResistances');

		expect(component.creature().damageResistances).toEqual([
			{ types: ['fire', 'cold'], note: 'from nonmagical attacks' },
		]);
	});

	it('hides selected damage types from the remaining defense choices', () => {
		component.selectDefenseType('damageVulnerabilities', 'fire');
		component.addDefense('damageVulnerabilities');

		expect(component.defenseTypeOptions('damageVulnerabilities')).not.toContain('fire');
		expect(component.defenseTypeOptions('damageVulnerabilities')).toContain('cold');
	});

	it('copies catalog entries into editable trait features', () => {
		component.addCatalogFeature({
			name: 'Pack Tactics',
			effect: 'Advantage with an ally.',
			example: 'Example.',
		});

		expect(component.creature().features).toEqual([
			jasmine.objectContaining({
				name: 'Pack Tactics',
				description: 'Advantage with an ally.',
				kind: 'trait',
			}),
		]);
	});

	it('filters the active feature catalog tab instead of showing resources and feats at once', () => {
		component.monsterFeatures.set([
			{ name: 'Pack Tactics', effect: 'Advantage with an ally.', example: 'Example.' },
		]);
		component.feats.set([{ name: 'Actor', source: 'PHB', entries: ['Mimicry.'] }]);
		component.openFeatureCatalog();
		component.featureCatalogTab.set('feats');
		component.featureCatalogSearch.set('actor');
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).toContain('Talentos');
		expect(fixture.nativeElement.textContent).toContain('Actor');
		expect(fixture.nativeElement.textContent).not.toContain('Pack Tactics');
	});
});
