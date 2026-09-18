import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';

import { EncounterBuilder } from './encounter-builder';
import { presentHomebrewSheet } from '../../models/homebrew-sheet-presentation-model';
import { BattleEncounterStorageService } from '../../services/battle-encounter-storage-service/battle-encounter-storage-service';
import { LocalStorageService } from '../../services/local-storage-service/local-storage-service';

describe('EncounterBuilder', () => {
	let component: EncounterBuilder;
	let fixture: ComponentFixture<EncounterBuilder>;

	beforeEach(async () => {
		localStorage.clear();
		await TestBed.configureTestingModule({
			imports: [EncounterBuilder],
			providers: [
				provideZonelessChangeDetection(),
				provideHttpClient(),
				provideRouter([]),
				{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(EncounterBuilder);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('creates a clean canonical encounter', () => {
		const encounter = component.encounter();
		expect(encounter.participants).toEqual([]);
		expect(encounter.lairActions).toEqual([]);
		expect(encounter.traps).toEqual([]);
		expect((encounter as any).creatures).toBeUndefined();
		expect((encounter as any).creatureIdCount).toBeUndefined();
	});

	it('creates a UUID participant for every requested manual quantity', () => {
		component.setDraftName('Skeleton');
		component.setDraftQuantity(3);
		component.addParticipants();

		const participants = component.participants();
		expect(participants).toHaveSize(3);
		expect(new Set(participants.map((participant) => participant.id)).size).toBe(3);
		expect(participants.every((participant) => participant.sheet.maxHp === 0)).toBeTrue();
	});

	it('edits durable values through the participant sheet', () => {
		component.addParticipants();
		const participant = component.participants()[0];
		component.updateSheet(participant.id, { maxHp: 18, armorClass: 14 });
		component.setSpellSlot(participant.id, 2, 3);
		component.setSpellDraft(participant.id, { name: 'Misty Step', level: 2, uses: 1 });
		component.addSpell(participant.id);

		const sheet = component.participants()[0].sheet;
		expect(sheet.maxHp).toBe(18);
		expect(sheet.spellSlots).toContain(jasmine.objectContaining({ level: 2, max: 3 }));
		expect(sheet.spells).toContain(jasmine.objectContaining({ name: 'Misty Step', level: 2 }));
		expect((component.participants()[0] as any).healthPoints).toBeUndefined();
	});

	it('shows and persists recovery values for special abilities', () => {
		component.addParticipants();
		const participant = component.participants()[0];
		component.toggleExpanded(participant.id);
		component.setAbilityDraft(participant.id, {
			name: 'Sopro flamejante',
			recoveryType: 'dice-recharge',
			rechargeOn: '5,6',
		});
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).toContain('Resultados que recarregam (d6)');
		component.addSpecialAbility(participant.id);
		expect(component.participants()[0].sheet.specialAbilities).toContain(
			jasmine.objectContaining({
				recoveryType: 'dice-recharge',
				rechargeDice: 'd6',
				rechargeOn: [5, 6],
			}),
		);

		component.setAbilityDraft(participant.id, {
			name: 'Grito de guerra',
			recoveryType: 'uses-per-day',
			maxUses: 3,
		});
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Usos por dia');
		component.addSpecialAbility(participant.id);
		expect(component.participants()[0].sheet.specialAbilities).toContain(
			jasmine.objectContaining({ recoveryType: 'uses-per-day', maxUses: 3 }),
		);
	});

	it('saves the direct encounter record and routes to its edit URL', () => {
		const router = TestBed.inject(Router);
		const navigate = spyOn(router, 'navigate').and.resolveTo(true);
		component.updateTitle('Bridge Ambush');
		component.updateDescription('Stop the cultists.');
		component.updateTags('bridge, night, bridge');
		component.save();

		const saved = TestBed.inject(LocalStorageService).getEncounter(component.savedId()!);
		expect(saved?.title).toBe('Bridge Ambush');
		expect(saved?.description).toBe('Stop the cultists.');
		expect(saved?.tags).toEqual(['bridge', 'night']);
		expect(navigate).toHaveBeenCalledWith(['/home/encounter-builder', component.savedId()]);
	});

	it('edits locations and only formal organizations in encounter context', () => {
		const router = TestBed.inject(Router);
		spyOn(router, 'navigate').and.resolveTo(true);
		component.campaignWorld.world.set({
			empires: [{ id: 'empire', name: 'Empire', aliases: [] }],
			states: [{ id: 'state', name: 'State', aliases: [], empireId: 'empire' }],
			settlements: [
				{ id: 'settlement', name: 'Settlement', aliases: [], stateId: 'state', settlementType: 'city' },
			],
			organizations: [
				{
					id: 'guild',
					name: 'Formal Guild',
					aliases: [],
					organizationType: 'guild',
					scope: 'campaign',
					presence: [],
				},
				{
					id: 'local-place',
					name: 'Local Tavern',
					aliases: [],
					organizationType: 'group',
					scope: 'local',
					sourcePath: 'Mundo/Impérios/Mornk/3-Nirvak/Guildas.md',
					presence: [],
				},
			],
			pointsOfInterest: [],
		} as never);

		expect(component.organizationOptions().map((option) => option.value)).toEqual(['guild']);
		component.setArchived(true);
		component.encounter.update((encounter) => ({
			...encounter,
			locationRefs: [{ scopeType: 'settlement', scopeId: 'settlement', relation: 'operation' }],
			organizationRefs: [{ organizationId: 'guild', relation: 'affiliated' }],
		}));
		component.setOrganizationId('local-place');
		component.saveOrganizationRef();
		expect(component.toast()?.text).toContain('guilda ou grupo formal');
		component.updateTitle('Contextual Encounter');
		component.save();

		const saved = TestBed.inject(LocalStorageService).getEncounter(component.savedId()!);
		expect(saved?.archived).toBeTrue();
		expect(saved?.locationRefs).toEqual([
			{ scopeType: 'settlement', scopeId: 'settlement', relation: 'operation' },
		]);
		expect(saved?.organizationRefs).toEqual([
			{ organizationId: 'guild', relation: 'affiliated' },
		]);
	});

	it('suggests formal encounter context from source sheets without copying tags or stat-block data', () => {
		const storage = TestBed.inject(LocalStorageService);
		const sheet = storage.createSheet({
			title: 'Feng patrol',
			category: 'npc',
			locationRefs: [{ scopeType: 'state', scopeId: 'feng', relation: 'base' }],
			organizationRefs: [{ organizationId: 'guild', relation: 'member' }],
			tags: ['Feng', 'patrol'],
			data: {
				name: 'Feng patrol',
				armorClass: 13,
				maxHp: 10,
				spellSlots: [],
				spells: [],
				specialAbilities: [],
				features: [],
			},
		});
		component.homebrewSheets.set(storage.listSheets());
		component.addFromSheet(sheet.id);

		expect(component.participantContextSuggestion()).toEqual(
			jasmine.objectContaining({ sourceCount: 1, hasSuggestions: true }),
		);
		expect(component.encounter().locationRefs).toBeUndefined();

		component.applyParticipantContext();

		expect(component.encounter().locationRefs).toEqual([
			{ scopeType: 'state', scopeId: 'feng', relation: 'base' },
		]);
		expect(component.encounter().organizationRefs).toEqual([
			{ organizationId: 'guild', relation: 'member' },
		]);
		expect(component.encounter().tags).toEqual([]);
	});

	it('suggests only monsters and NPCs for the party position in the Homebrew modal', () => {
		component.campaignWorld.saveWorld({
			schemaVersion: 1,
			calendar: {
				daysPerSeason: 30,
				seasons: [
					{ id: 'spring', label: 'Spring', color: '#9ae6b4' },
					{ id: 'summer', label: 'Summer', color: '#f6e05e' },
					{ id: 'autumn', label: 'Autumn', color: '#f6ad55' },
					{ id: 'winter', label: 'Winter', color: '#90cdf4' },
				],
				epochDate: { year: 1, season: 'spring', day: 1, hour: 0, minute: 0 },
				events: [],
			},
			empires: [{ id: 'mornk', name: 'Mornk', aliases: [] }],
			states: [{ id: 'feng', name: 'Feng', aliases: [], empireId: 'mornk' }],
			settlements: [
				{ id: 'feng-city', name: 'Feng City', aliases: [], stateId: 'feng', settlementType: 'city' },
			],
			organizations: [],
			pointsOfInterest: [],
		});
		component.campaignContext.setCurrentLocation({ scopeType: 'settlement', scopeId: 'feng-city' });
		const storage = TestBed.inject(LocalStorageService);
		const data = (name: string) => ({
			name,
			armorClass: 12,
			maxHp: 10,
			spellSlots: [],
			spells: [],
			specialAbilities: [],
			features: [],
		});
		const hereMonster = storage.createSheet({
			title: 'Feng wolf',
			category: 'monster',
			locationRefs: [{ scopeType: 'settlement', scopeId: 'feng-city', relation: 'habitat' }],
			data: data('Feng wolf'),
		});
		const stateNpc = storage.createSheet({
			title: 'Feng scout',
			category: 'npc',
			locationRefs: [{ scopeType: 'state', scopeId: 'feng', relation: 'base' }],
			data: data('Feng scout'),
		});
		const pc = storage.createSheet({
			title: 'Party wizard',
			category: 'pc',
			locationRefs: [{ scopeType: 'settlement', scopeId: 'feng-city', relation: 'base' }],
			data: data('Party wizard'),
		});
		const generic = storage.createSheet({ title: 'Generic wolf', category: 'monster', generic: true, data: data('Generic wolf') });
		component.homebrewSheets.set([hereMonster, stateNpc, pc, generic]);

		expect(component.contextualSuggestionGroups().map((group) => group.label)).toEqual([
			'Aqui',
			'Estado/região',
			'Regional/amplo',
		]);
		expect(component.contextualSuggestionGroups().flatMap((group) => group.entries).map((entry) => entry.content.id)).toEqual([
			hereMonster.id,
			stateNpc.id,
			generic.id,
		]);
		expect(component.contextualSuggestionGroups().flatMap((group) => group.entries).map((entry) => entry.content.id)).not.toContain(pc.id);

		component.openHomebrewModal();
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Sugestões para esta posição');
		expect(fixture.nativeElement.textContent).not.toContain('Organizações presentes');
	});

	it('presents formal metadata without treating legacy groups as organizations', () => {
		component.campaignWorld.saveWorld({
			schemaVersion: 1,
			calendar: {
				daysPerSeason: 30,
				seasons: [
					{ id: 'spring', label: 'Spring', color: '#9ae6b4' },
					{ id: 'summer', label: 'Summer', color: '#f6e05e' },
					{ id: 'autumn', label: 'Autumn', color: '#f6ad55' },
					{ id: 'winter', label: 'Winter', color: '#90cdf4' },
				],
				epochDate: { year: 1, season: 'spring', day: 1, hour: 0, minute: 0 },
				events: [],
			},
			empires: [{ id: 'mornk', name: 'Mornk', aliases: [] }],
			states: [{ id: 'feng', name: 'Feng', aliases: [], empireId: 'mornk' }],
			settlements: [{ id: 'feng-city', name: 'Feng City', aliases: [], stateId: 'feng', settlementType: 'city' }],
			organizations: [{ id: 'winterhold', name: 'Winterhold', aliases: [], organizationType: 'guild', scope: 'campaign', presence: [] }],
			pointsOfInterest: [],
		});
		const storage = TestBed.inject(LocalStorageService);
		const sheet = storage.createSheet({
			title: 'Wen Torger',
			category: 'npc',
			classes: ['warlock'],
			locationRefs: [{ scopeType: 'settlement', scopeId: 'feng-city', relation: 'base' }],
			organizationRefs: [{ organizationId: 'winterhold', relation: 'member' }],
			data: {
				name: 'Wen Torger', challengeRating: '4', creatureType: 'humanoid', groups: ['Legacy Winterhold'],
				armorClass: 13, maxHp: 20, spellSlots: [], spells: [], specialAbilities: [], features: [],
			},
		});

		const presentation = presentHomebrewSheet(sheet, component.campaignWorld.world());
		expect(presentation.categoryLabel).toBe('NPC');
		expect(presentation.challengeRating).toBe('4');
		expect(presentation.creatureType).toBe('Humanoid');
		expect(presentation.classes).toEqual(['Warlock']);
		expect(presentation.formalOrganizations).toEqual(['Winterhold']);
		expect(presentation.formalLocations).toEqual(['Mornk › Feng › Feng City']);
		expect(presentation.legacyGroups).toEqual(['Legacy Winterhold']);
	});

	it('filters the Homebrew browser and opens a non-mutating sheet preview', () => {
		const storage = TestBed.inject(LocalStorageService);
		const sheet = storage.createSheet({
			title: 'Eco Enraizado', category: 'monster',
			data: {
				name: 'Eco Enraizado', challengeRating: '1', creatureType: 'plant', armorClass: 12, maxHp: 10,
				spellSlots: [], spells: [], specialAbilities: [], features: [],
			},
		});
		component.homebrewSheets.set([sheet]);
		component.setHomebrewCategoryFilter('monster');
		expect(component.filteredHomebrewSheets().map((item) => item.id)).toEqual([sheet.id]);

		const before = JSON.stringify(component.encounter());
		component.openHomebrewSheetViewer(sheet.id);
		fixture.detectChanges();
		expect(component.homebrewSheetViewer()?.id).toBe(sheet.id);
		expect(fixture.nativeElement.textContent).toContain('Visualização da ficha');
		expect(fixture.nativeElement.textContent).toContain('Eco Enraizado');
		expect(JSON.stringify(component.encounter())).toBe(before);
		component.closeHomebrewSheetViewer();
		expect(component.homebrewSheetViewer()).toBeNull();
	});

	it('asks for initiatives before creating a battle', () => {
		const router = TestBed.inject(Router);
		const navigate = spyOn(router, 'navigate').and.resolveTo(true);
		component.addParticipants();
		component.saveAndStartBattle();
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).toContain('Definir iniciativas');
		expect(navigate).not.toHaveBeenCalled();
		component.setInitiativeDraft(component.participants()[0].id, '17');
		component.confirmInitiativeSetup();

		const battle = TestBed.inject(BattleEncounterStorageService).getActiveBattleByEncounterId(
			component.savedId()!,
		);
		expect(battle).not.toBeNull();
		expect(battle?.combatants[0].initiative).toBe(17);
		expect(navigate).toHaveBeenCalledWith(['/home/battle-tracker', battle?.id]);
	});

	it('asks for initiatives again when continuing an existing battle', () => {
		component.addParticipants();
		const participantId = component.participants()[0].id;
		component.saveAndStartBattle();
		component.setInitiativeDraft(participantId, '12');
		component.confirmInitiativeSetup();
		const storage = TestBed.inject(BattleEncounterStorageService);
		const firstBattle = storage.getActiveBattleByEncounterId(component.savedId()!);

		component.saveAndStartBattle();
		expect(component.initiativeSetupOpen()).toBeTrue();
		component.setInitiativeDraft(participantId, '18');
		component.confirmInitiativeSetup();

		const continuedBattle = storage.getActiveBattleByEncounterId(component.savedId()!);
		expect(continuedBattle?.id).toBe(firstBattle?.id);
		expect(continuedBattle?.combatants[0].initiative).toBe(18);
	});

	it('fills tied initiatives with sheet Dexterity and orders the direct battle by it', () => {
		const router = TestBed.inject(Router);
		spyOn(router, 'navigate').and.resolveTo(true);
		component.setDraftName('First');
		component.addParticipants();
		component.setDraftName('Second');
		component.addParticipants();
		const [first, second] = component.participants();
		component.updateSheet(first.id, { abilityScores: { dex: 12 } });
		component.updateSheet(second.id, { abilityScores: { dex: 16 } });

		component.saveAndStartBattle();
		component.setInitiativeDraft(first.id, '14');
		component.setInitiativeDraft(second.id, '14');
		expect(component.initiativeTieBreakerDrafts()).toEqual({ [first.id]: '12', [second.id]: '16' });
		component.confirmInitiativeSetup();

		const battle = TestBed.inject(BattleEncounterStorageService).getActiveBattleByEncounterId(
			component.savedId()!,
		);
		expect(battle?.combatants.map((combatant) => combatant.name)).toEqual(['Second', 'First']);
	});
});
