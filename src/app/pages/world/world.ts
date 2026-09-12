import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
	type CampaignLocationRef,
	type CampaignLocationSearchResult,
	type CampaignPointOfInterestSearchResult,
	type CampaignSettlement,
	POINT_OF_INTEREST_TYPE_LABELS,
	SETTLEMENT_TYPE_LABELS,
} from '../../models/campaign-world-model';
import { CampaignContextService } from '../../services/campaign-context-service/campaign-context-service';
import { CampaignWorldService } from '../../services/campaign-world-service/campaign-world-service';

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
