import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
	type CampaignLocationRef,
	type CampaignLocationSearchResult,
	type CampaignPointOfInterestSearchResult,
	type CampaignOrganizationPresence,
	type CampaignWorld,
	type CampaignOrganization,
	type CampaignOrganizationScope,
	type CampaignWorldScopeType,
	normalizeCampaignWorldSearchText,
	POINT_OF_INTEREST_TYPE_LABELS,
	SETTLEMENT_TYPE_LABELS,
} from '../../models/campaign-world-model';
import { CampaignContextService } from '../../services/campaign-context-service/campaign-context-service';
import { CampaignWorldService } from '../../services/campaign-world-service/campaign-world-service';
import { DialogFocusDirective } from '../../directives/dialog-focus';

type WorldEditorType = 'empire' | 'state' | 'settlement' | 'poi' | 'organization';

type OrganizationPresenceDraft = {
	scopeType: CampaignWorldScopeType;
	scopeId: string;
	presenceType: string;
	availableSheetExternalIds: string;
};

@Component({
	selector: 'app-world-page',
	standalone: true,
	imports: [CommonModule, DialogFocusDirective, FormsModule],
	templateUrl: './world.html',
})
export class WorldPage {
	readonly campaignWorld = inject(CampaignWorldService);
	readonly campaignContext = inject(CampaignContextService);
	readonly selectedLocation = signal<CampaignLocationRef | null>(null);
	readonly highlightedPointOfInterestId = signal<string | null>(null);
	readonly searchQuery = signal('');
	readonly isChoosingPartyLocation = signal(false);
	readonly positionMessage = signal<string | null>(null);
	readonly settlementTypeLabels = SETTLEMENT_TYPE_LABELS;
	readonly pointOfInterestTypeLabels = POINT_OF_INTEREST_TYPE_LABELS;
	readonly settlementTypeOptions = Object.entries(SETTLEMENT_TYPE_LABELS).map(([value, label]) => ({
		value,
		label,
	}));
	readonly pointOfInterestTypeOptions = Object.entries(POINT_OF_INTEREST_TYPE_LABELS).map(
		([value, label]) => ({ value, label }),
	);
	readonly organizationTypeOptions = [
		{ value: 'guild', label: 'Guilda' },
		{ value: 'group', label: 'Grupo' },
	];
	readonly organizationScopeOptions: Array<{ value: CampaignOrganizationScope; label: string }> = [
		{ value: 'campaign', label: 'Campanha ou internacional' },
		{ value: 'regional', label: 'Regional' },
		{ value: 'local', label: 'Local' },
	];
	readonly presenceTypeSuggestions = [
		'global-network',
		'headquarters',
		'post',
		'agent',
		'remote-contact',
		'operation',
	];
	readonly presenceScopeTypeOptions: Array<{ value: CampaignWorldScopeType; label: string }> = [
		{ value: 'global', label: 'Global' },
		{ value: 'empire', label: 'Império' },
		{ value: 'state', label: 'Estado' },
		{ value: 'settlement', label: 'Localidade' },
	];
	readonly editorType = signal<'empire' | 'state' | 'settlement' | 'poi' | 'organization' | null>(
		null,
	);
	readonly editingOrganizationId = signal<string | null>(null);
	readonly managingOrganizationId = signal<string | null>(null);
	readonly presenceReturnLocation = signal<CampaignLocationRef | null>(null);
	readonly editingPresenceIndex = signal<number | null>(null);
	readonly presenceEditorOpen = signal(false);
	readonly presenceDraft = signal<OrganizationPresenceDraft>(this.emptyPresenceDraft());
	editorName = '';
	editorParentId = '';
	editorTypeValue = '';
	editorOrganizationScope: CampaignOrganizationScope = 'campaign';
	editorAliases: string[] = [];
	editorAliasInput = '';
	editorAliasesManuallyEdited = false;
	editorSummary = '';
	editorOrganizationIds: string[] = [];
	editorMessage = signal<string | null>(null);
	readonly selectedResolvedLocation = computed(() => {
		const ref = this.selectedLocation();
		return ref ? this.campaignWorld.resolveLocation(ref) : null;
	});
	readonly locationSearchResults = computed(() =>
		this.campaignWorld.searchLocations(this.searchQuery()).slice(0, 8),
	);
	readonly pointOfInterestSearchResults = computed(() =>
		this.campaignWorld.searchPointsOfInterest(this.searchQuery()).slice(0, 8),
	);
	readonly campaignOrganizations = computed(() =>
		(this.campaignWorld.world()?.organizations ?? []).filter(
			(organization) => !organization.archived,
		),
	);
	readonly archivedCampaignOrganizations = computed(() =>
		(this.campaignWorld.world()?.organizations ?? []).filter(
			(organization) => organization.archived,
		),
	);
	readonly locationOrganizations = computed(() => {
		const location = this.selectedLocation();
		return location
			? this.campaignWorld.getRelevantOrganizations(location).filter(
					(item) => item.directPresences.length > 0,
				)
			: [];
	});
	readonly organizationParentOptions = computed(() => {
		const editingId = this.editingOrganizationId();
		return (this.campaignWorld.world()?.organizations ?? []).filter(
			(organization) => organization.id !== editingId,
		);
	});
	readonly managedOrganization = computed(() => {
		const id = this.managingOrganizationId();
		return id ? this.campaignWorld.getOrganization(id) : null;
	});
	readonly presenceScopeOptions = computed(() => {
		const scopeType = this.presenceDraft().scopeType;
		const world = this.campaignWorld.world();
		if (!world || scopeType === 'global') return [];
		const entities =
			scopeType === 'empire'
				? world.empires
				: scopeType === 'state'
					? world.states
					: world.settlements;
		return entities
			.map((entity) => {
				const location = this.campaignWorld.resolveLocation({ scopeType, scopeId: entity.id });
				return { value: entity.id, label: location?.breadcrumb.join(' › ') ?? entity.name };
			})
			.sort((left, right) => left.label.localeCompare(right.label));
	});

	constructor() {
		effect(() => {
			if (this.campaignWorld.status() !== 'ready') return;
			const current = this.campaignContext.currentLocationRef();
			const resolved = current && this.campaignWorld.resolveLocation(current);
			if (resolved) this.selectedLocation.set(resolved.ref);
		});
	}

	selectLocation(ref: CampaignLocationRef): void {
		if (!this.campaignWorld.resolveLocation(ref)) return;
		this.selectedLocation.set(ref);
		this.highlightedPointOfInterestId.set(null);
	}

	selectSearchResult(result: CampaignLocationSearchResult): void {
		if (this.isChoosingPartyLocation()) {
			this.setPartyLocation(result.ref);
		} else {
			this.selectLocation(result.ref);
		}
		this.searchQuery.set('');
	}

	selectPointOfInterestSearchResult(result: CampaignPointOfInterestSearchResult): void {
		this.selectLocation({ scopeType: 'settlement', scopeId: result.settlement.id });
		this.highlightedPointOfInterestId.set(result.pointOfInterest.id);
		this.searchQuery.set('');
	}

	setPartyHere(): void {
		const ref = this.selectedLocation();
		if (ref) this.setPartyLocation(ref);
	}

	beginPartyLocationSelection(): void {
		this.isChoosingPartyLocation.set(true);
		this.searchQuery.set('');
		this.positionMessage.set('Busque e escolha uma localização para atualizar a posição da party.');
	}

	cancelPartyLocationSelection(): void {
		this.isChoosingPartyLocation.set(false);
		this.searchQuery.set('');
	}

	clearPartyLocation(): void {
		this.campaignContext.clearCurrentLocation();
		this.isChoosingPartyLocation.set(false);
		this.positionMessage.set('Posição da party removida.');
	}

	selectRoot(): void {
		this.selectedLocation.set(null);
		this.highlightedPointOfInterestId.set(null);
	}

	selectBreadcrumb(scopeType: CampaignLocationRef['scopeType'], scopeId: string): void {
		this.selectLocation({ scopeType, scopeId });
	}

	goBack(): void {
		const location = this.selectedResolvedLocation();
		if (!location) return;
		if (location.ref.scopeType === 'settlement') {
			this.selectLocation({ scopeType: 'state', scopeId: location.state!.id });
			return;
		}
		if (location.ref.scopeType === 'state') {
			this.selectLocation({ scopeType: 'empire', scopeId: location.empire!.id });
			return;
		}
		this.selectRoot();
	}

	isCurrentPartyLocation(ref: CampaignLocationRef): boolean {
		const current = this.campaignContext.currentLocationRef();
		return current?.scopeType === ref.scopeType && current.scopeId === ref.scopeId;
	}

	locationLabel(ref: CampaignLocationRef): string {
		return this.campaignWorld.resolveLocation(ref)?.label ?? ref.scopeId;
	}

	locationTypeLabel(ref: CampaignLocationRef): string {
		if (ref.scopeType === 'empire') return 'Império';
		if (ref.scopeType === 'state') return 'Estado';
		const settlement = this.campaignWorld.getSettlement(ref.scopeId);
		return settlement ? SETTLEMENT_TYPE_LABELS[settlement.settlementType] : 'Localidade';
	}

	pointOfInterestTypeLabel(type: string): string {
		const label =
			this.pointOfInterestTypeLabels[type as keyof typeof this.pointOfInterestTypeLabels];
		return label ?? type.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
	}

	openEditor(type: WorldEditorType): void {
		this.editorType.set(type);
		this.editingOrganizationId.set(null);
		this.editorName = '';
		this.editorParentId = this.defaultParentId(type);
		this.editorTypeValue =
			type === 'settlement'
				? 'city'
				: type === 'poi'
					? 'other'
					: type === 'organization'
						? 'group'
						: '';
		this.editorOrganizationScope = this.defaultOrganizationScope();
		this.editorAliases = [];
		this.editorAliasInput = '';
		this.editorAliasesManuallyEdited = false;
		this.editorSummary = '';
		this.editorOrganizationIds = [];
		this.editorMessage.set(null);
	}

	openOrganizationEditor(organization: CampaignOrganization): void {
		this.openEditor('organization');
		this.editingOrganizationId.set(organization.id);
		this.editorName = organization.name;
		this.editorParentId = organization.parentOrganizationId ?? '';
		this.editorTypeValue = organization.organizationType;
		this.editorOrganizationScope = this.campaignWorld.getOrganizationScope(organization);
		this.editorAliases = [...organization.aliases];
		this.editorAliasesManuallyEdited = true;
	}

	openPresenceManager(organizationId: string): void {
		if (!this.campaignWorld.getOrganization(organizationId)) return;
		this.presenceReturnLocation.set(this.selectedLocation());
		this.selectRoot();
		this.managingOrganizationId.set(organizationId);
		this.cancelPresenceEditor();
		this.editorMessage.set(null);
	}

	closePresenceManager(): void {
		const returnLocation = this.presenceReturnLocation();
		this.managingOrganizationId.set(null);
		this.presenceReturnLocation.set(null);
		this.cancelPresenceEditor();
		if (returnLocation) this.selectLocation(returnLocation);
	}

	openPresenceEditor(): void {
		this.editingPresenceIndex.set(null);
		this.presenceDraft.set(this.emptyPresenceDraft());
		this.presenceEditorOpen.set(true);
		this.editorMessage.set(null);
	}

	editPresence(index: number): void {
		const presence = this.managedOrganization()?.presence[index];
		if (!presence) return;
		this.editingPresenceIndex.set(index);
		this.presenceDraft.set({
			scopeType: presence.scopeType,
			scopeId: presence.scopeId ?? '',
			presenceType: presence.presenceType,
			availableSheetExternalIds: presence.availableSheetExternalIds?.join(', ') ?? '',
		});
		this.presenceEditorOpen.set(true);
		this.editorMessage.set(null);
	}

	cancelPresenceEditor(): void {
		this.editingPresenceIndex.set(null);
		this.presenceEditorOpen.set(false);
		this.presenceDraft.set(this.emptyPresenceDraft());
	}

	setPresenceScopeType(scopeType: CampaignWorldScopeType): void {
		this.presenceDraft.update((draft) => ({ ...draft, scopeType, scopeId: '' }));
	}

	setPresenceScopeId(scopeId: string): void {
		this.presenceDraft.update((draft) => ({ ...draft, scopeId }));
	}

	setPresenceType(presenceType: string): void {
		this.presenceDraft.update((draft) => ({ ...draft, presenceType }));
	}

	setAvailableSheetExternalIds(value: string): void {
		this.presenceDraft.update((draft) => ({ ...draft, availableSheetExternalIds: value }));
	}

	savePresence(): void {
		const organizationId = this.managingOrganizationId();
		const world = this.campaignWorld.world();
		if (!organizationId || !world) return;
		const draft = this.presenceDraft();
		const presenceType = draft.presenceType.trim();
		const availableSheetExternalIds = this.parseExternalIds(draft.availableSheetExternalIds);
		if (!presenceType) {
			this.editorMessage.set('Informe o tipo de presença.');
			return;
		}
		if (draft.scopeType !== 'global' && !this.isValidPresenceScopeId(draft.scopeType, draft.scopeId)) {
			this.editorMessage.set('Escolha uma localização válida para esta presença.');
			return;
		}
		const presence: CampaignOrganizationPresence = {
			scopeType: draft.scopeType,
			...(draft.scopeType === 'global' ? {} : { scopeId: draft.scopeId }),
			presenceType,
			...(availableSheetExternalIds.length ? { availableSheetExternalIds } : {}),
		};
		const editingIndex = this.editingPresenceIndex();
		const organization = world.organizations.find((item) => item.id === organizationId);
		if (!organization) {
			this.closePresenceManager();
			return;
		}
		const isDuplicate = organization.presence.some(
			(item, index) => index !== editingIndex && this.samePresence(item, presence),
		);
		if (isDuplicate) {
			this.editorMessage.set('Esta presença já está cadastrada para a organização.');
			return;
		}
		const next = structuredClone(world);
		const nextOrganization = next.organizations.find((item) => item.id === organizationId)!;
		if (editingIndex === null) nextOrganization.presence.push(presence);
		else nextOrganization.presence[editingIndex] = presence;
		this.campaignWorld.saveWorld(next);
		this.cancelPresenceEditor();
	}

	removePresence(index: number): void {
		const organizationId = this.managingOrganizationId();
		const world = this.campaignWorld.world();
		if (!organizationId || !world || !this.managedOrganization()?.presence[index]) return;
		if (!confirm('Remover esta presença da organização?')) return;
		const next = structuredClone(world);
		const organization = next.organizations.find((item) => item.id === organizationId);
		if (!organization) return;
		organization.presence.splice(index, 1);
		this.campaignWorld.saveWorld(next);
		this.cancelPresenceEditor();
	}

	presenceScopeLabel(presence: CampaignOrganizationPresence): string {
		if (presence.scopeType === 'global') return 'Global';
		const location = this.campaignWorld.resolveLocation({
			scopeType: presence.scopeType,
			scopeId: presence.scopeId ?? '',
		});
		return location?.breadcrumb.join(' › ') ?? `${this.locationTypeLabel({
			scopeType: presence.scopeType,
			scopeId: presence.scopeId ?? '',
		})} removido`;
	}

	onEditorNameChange(value: string): void {
		this.editorName = value;
		if (!this.editorAliasesManuallyEdited) {
			const alias = normalizeCampaignWorldSearchText(value);
			this.editorAliases = alias ? [alias] : [];
		}
	}

	commitAlias(): void {
		const aliases = this.editorAliasInput
			.split(/[\s,]+/)
			.map((alias) => alias.trim())
			.filter(Boolean);
		if (aliases.length) {
			this.editorAliases = [...new Set([...this.editorAliases, ...aliases])];
			this.editorAliasesManuallyEdited = true;
		}
		this.editorAliasInput = '';
	}

	commitAliasOnKeydown(event: KeyboardEvent): void {
		if (event.key !== ',' && event.key !== ' ' && event.key !== 'Enter') return;
		event.preventDefault();
		this.commitAlias();
	}

	removeAlias(alias: string): void {
		this.editorAliases = this.editorAliases.filter((item) => item !== alias);
		this.editorAliasesManuallyEdited = true;
	}

	cancelEditor(): void {
		this.editorType.set(null);
		this.editingOrganizationId.set(null);
	}

	saveEditor(): void {
		const type = this.editorType();
		const world = this.campaignWorld.world();
		if (!type || !world || !this.editorName.trim()) return;
		const next = structuredClone(world);
		const editingOrganizationId = this.editingOrganizationId();
		const id = editingOrganizationId ?? this.newId(type);
		this.commitAlias();
		const aliases = this.editorAliases;
		if (type === 'empire') next.empires.push({ id, name: this.editorName.trim(), aliases });
		if (type === 'state') {
			if (!next.empires.some((item) => item.id === this.editorParentId)) {
				this.editorMessage.set('Escolha o império ao qual este estado pertence.');
				return;
			}
			next.states.push({
				id,
				name: this.editorName.trim(),
				aliases,
				empireId: this.editorParentId,
			});
		}
		if (type === 'settlement') {
			if (!next.states.some((item) => item.id === this.editorParentId)) {
				this.editorMessage.set('Escolha o estado ao qual esta localidade pertence.');
				return;
			}
			next.settlements.push({
				id,
				name: this.editorName.trim(),
				aliases,
				stateId: this.editorParentId,
				settlementType: this.editorTypeValue || 'other',
			});
		}
		if (type === 'poi') {
			if (!next.settlements.some((item) => item.id === this.editorParentId)) {
				this.editorMessage.set('Escolha a localidade deste ponto de interesse.');
				return;
			}
			next.pointsOfInterest.push({
				id,
				name: this.editorName.trim(),
				aliases,
				settlementId: this.editorParentId,
				poiType: this.editorTypeValue || 'other',
				...(this.editorSummary.trim() ? { summary: this.editorSummary.trim() } : {}),
				...(this.editorOrganizationIds.length
					? { organizationIds: this.editorOrganizationIds }
					: {}),
			});
		}
		if (type === 'organization') {
			const existing = editingOrganizationId
				? next.organizations.find((item) => item.id === editingOrganizationId)
				: undefined;
			if (editingOrganizationId && !existing) {
				this.editorMessage.set('A organização que você está editando não existe mais.');
				return;
			}
			const organization: CampaignOrganization = {
				...existing,
				id,
				name: this.editorName.trim(),
				aliases,
				organizationType: this.editorTypeValue.trim() || 'group',
				scope: this.editorOrganizationScope,
				presence: existing?.presence ?? [],
			};
			if (
				this.editorParentId &&
				this.editorParentId !== id &&
				next.organizations.some((item) => item.id === this.editorParentId)
			) {
				organization.parentOrganizationId = this.editorParentId;
			} else {
				delete organization.parentOrganizationId;
			}
			if (existing) {
				next.organizations = next.organizations.map((item) =>
					item.id === id ? organization : item,
				);
			} else {
				next.organizations.push(organization);
			}
		}
		this.campaignWorld.saveWorld(next);
		this.editorType.set(null);
		this.editingOrganizationId.set(null);
	}

	toggleOrganizationArchived(id: string): void {
		const world = this.campaignWorld.world();
		if (!world) return;
		const next = structuredClone(world);
		const organization = next.organizations.find((item) => item.id === id);
		if (!organization) return;
		if (organization.archived) delete organization.archived;
		else organization.archived = true;
		this.campaignWorld.saveWorld(next);
	}

	deleteEntity(type: 'empire' | 'state' | 'settlement' | 'poi' | 'organization', id: string): void {
		const world = this.campaignWorld.world();
		if (!world) return;
		const dependencies = this.dependenciesFor(world, type, id);
		if (dependencies.length) {
			this.editorMessage.set(`Não é possível excluir: ${dependencies.join(', ')}.`);
			return;
		}
		if (!confirm('Excluir este item do mundo?')) return;
		const next = structuredClone(world);
		if (type === 'empire') next.empires = next.empires.filter((item) => item.id !== id);
		if (type === 'state') next.states = next.states.filter((item) => item.id !== id);
		if (type === 'settlement') next.settlements = next.settlements.filter((item) => item.id !== id);
		if (type === 'poi')
			next.pointsOfInterest = next.pointsOfInterest.filter((item) => item.id !== id);
		if (type === 'organization')
			next.organizations = next.organizations.filter((item) => item.id !== id);
		this.campaignWorld.saveWorld(next);
		this.selectRoot();
	}

	private dependenciesFor(world: CampaignWorld, type: string, id: string): string[] {
		if (type === 'empire') {
			const count = world.states.filter((item) => item.empireId === id).length;
			return count ? [`${count} estado(s)`] : [];
		}
		if (type === 'state') {
			const count = world.settlements.filter((item) => item.stateId === id).length;
			return count ? [`${count} localidade(s)`] : [];
		}
		if (type === 'settlement') {
			const count = world.pointsOfInterest.filter((item) => item.settlementId === id).length;
			return count ? [`${count} ponto(s) de interesse`] : [];
		}
		if (type === 'organization') {
			const children = world.organizations.filter(
				(item) => item.parentOrganizationId === id,
			).length;
			const pois = world.pointsOfInterest.filter((item) =>
				item.organizationIds?.includes(id),
			).length;
			return [
				...(children ? [`${children} organização(ões) filha(s)`] : []),
				...(pois ? [`${pois} POI(s)`] : []),
			];
		}
		return [];
	}

	private newId(prefix: string): string {
		return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
	}

	private emptyPresenceDraft(): OrganizationPresenceDraft {
		return {
			scopeType: 'global',
			scopeId: '',
			presenceType: 'global-network',
			availableSheetExternalIds: '',
		};
	}

	private parseExternalIds(value: string): string[] {
		return [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean))];
	}

	private isValidPresenceScopeId(scopeType: Exclude<CampaignWorldScopeType, 'global'>, scopeId: string): boolean {
		if (scopeType === 'empire') return !!this.campaignWorld.getEmpire(scopeId);
		if (scopeType === 'state') return !!this.campaignWorld.getState(scopeId);
		return !!this.campaignWorld.getSettlement(scopeId);
	}

	private samePresence(
		left: CampaignOrganizationPresence,
		right: CampaignOrganizationPresence,
	): boolean {
		return (
			left.scopeType === right.scopeType &&
			(left.scopeId ?? '') === (right.scopeId ?? '') &&
			left.presenceType.trim().toLocaleLowerCase() === right.presenceType.trim().toLocaleLowerCase()
		);
	}

	private defaultParentId(type: WorldEditorType): string {
		const location = this.selectedResolvedLocation();
		if (!location) return '';
		if (type === 'state' && location.empire) return location.empire.id;
		if (type === 'settlement' && location.state) return location.state.id;
		if (type === 'poi' && location.settlement) return location.settlement.id;
		return '';
	}

	organizationScopeLabel(organization: CampaignOrganization): string {
		return (
			this.organizationScopeOptions.find(
				(option) => option.value === this.campaignWorld.getOrganizationScope(organization),
			)?.label ?? 'Regional'
		);
	}

	locationOrganizationTitle(): string {
		return this.selectedLocation()?.scopeType === 'settlement'
			? 'Organizações nesta localidade'
			: 'Organizações nesta região';
	}

	private defaultOrganizationScope(): CampaignOrganizationScope {
		const scopeType = this.selectedLocation()?.scopeType;
		return scopeType === 'settlement' ? 'local' : scopeType ? 'regional' : 'campaign';
	}

	private setPartyLocation(ref: CampaignLocationRef): void {
		const resolved = this.campaignWorld.resolveLocation(ref);
		if (!resolved) return;
		this.campaignContext.setCurrentLocation(ref);
		this.selectedLocation.set(ref);
		this.highlightedPointOfInterestId.set(null);
		this.isChoosingPartyLocation.set(false);
		this.positionMessage.set(`Posição atualizada para ${resolved.label}.`);
	}
}
