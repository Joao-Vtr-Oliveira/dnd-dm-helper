import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
	type CampaignLocationRef,
	type CampaignLocationSearchResult,
	type CampaignPointOfInterestSearchResult,
	type CampaignSettlement,
	type CampaignWorld,
	type CampaignOrganization,
	normalizeCampaignWorldSearchText,
	POINT_OF_INTEREST_TYPE_LABELS,
	SETTLEMENT_TYPE_LABELS,
} from '../../models/campaign-world-model';
import { CampaignContextService } from '../../services/campaign-context-service/campaign-context-service';
import { CampaignWorldService } from '../../services/campaign-world-service/campaign-world-service';

type WorldEditorType = 'empire' | 'state' | 'settlement' | 'poi' | 'organization';

@Component({
	selector: 'app-world-page',
	standalone: true,
	imports: [CommonModule, FormsModule],
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
	readonly organizationTypeSuggestions = [
		'guild',
		'group',
		'cult',
		'family',
		'institution',
		'company',
		'government',
	];
	readonly editorType = signal<'empire' | 'state' | 'settlement' | 'poi' | 'organization' | null>(
		null,
	);
	readonly editingOrganizationId = signal<string | null>(null);
	editorName = '';
	editorParentId = '';
	editorTypeValue = '';
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
	readonly activeOrganizations = computed(() =>
		(this.campaignWorld.world()?.organizations ?? []).filter((organization) => !organization.archived),
	);
	readonly archivedOrganizations = computed(() =>
		(this.campaignWorld.world()?.organizations ?? []).filter((organization) => organization.archived),
	);
	readonly organizationParentOptions = computed(() => {
		const editingId = this.editingOrganizationId();
		return (this.campaignWorld.world()?.organizations ?? []).filter(
			(organization) => organization.id !== editingId,
		);
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

	settlementLabel(settlement: CampaignSettlement): string {
		return `${settlement.name} · ${SETTLEMENT_TYPE_LABELS[settlement.settlementType]}`;
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
		this.editorAliases = [...organization.aliases];
		this.editorAliasesManuallyEdited = true;
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

	private defaultParentId(type: WorldEditorType): string {
		const location = this.selectedResolvedLocation();
		if (!location) return '';
		if (type === 'state' && location.empire) return location.empire.id;
		if (type === 'settlement' && location.state) return location.state.id;
		if (type === 'poi' && location.settlement) return location.settlement.id;
		return '';
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
