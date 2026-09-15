import { Injectable, computed, inject, signal } from '@angular/core';
import { APP_STORAGE_KEYS } from '../../constants/app-storage-keys';
import {
	normalizeCampaignContext,
	type CampaignContextState,
} from '../../models/campaign-context-model';
import {
	type CampaignEmpire,
	type CampaignLocationRef,
	type CampaignSettlement,
	type CampaignState,
} from '../../models/campaign-world-model';
import { CampaignWorldService } from '../campaign-world-service/campaign-world-service';
import { WorkspaceStorageService } from '../workspace-service/workspace-storage-service';

@Injectable({ providedIn: 'root' })
export class CampaignContextService {
	private readonly campaignWorld = inject(CampaignWorldService);
	private readonly storage = inject(WorkspaceStorageService);
	readonly currentLocationRef = signal<CampaignLocationRef | null>(this.loadInitial());
	readonly resolvedCurrentLocation = computed(() => {
		const ref = this.currentLocationRef();
		return ref ? this.campaignWorld.resolveLocation(ref) : null;
	});
	readonly currentEmpire = computed<CampaignEmpire | null>(
		() => this.resolvedCurrentLocation()?.empire ?? null,
	);
	readonly currentState = computed<CampaignState | null>(
		() => this.resolvedCurrentLocation()?.state ?? null,
	);
	readonly currentSettlement = computed<CampaignSettlement | null>(
		() => this.resolvedCurrentLocation()?.settlement ?? null,
	);
	readonly locationError = computed(() => {
		if (
			this.campaignWorld.status() === 'ready' &&
			this.currentLocationRef() &&
			!this.resolvedCurrentLocation()
		) {
			return 'Posição salva não encontrada no catálogo atual.';
		}
		return null;
	});

	setCurrentLocation(ref: CampaignLocationRef): void {
		const canonicalRef = this.campaignWorld.resolveLocation(ref)?.ref ?? ref;
		this.currentLocationRef.set(canonicalRef);
		this.persist();
	}

	clearCurrentLocation(): void {
		this.currentLocationRef.set(null);
		try {
			this.storage.removeItem(APP_STORAGE_KEYS.campaignContext);
		} catch {}
	}

	getState(): CampaignContextState {
		return { currentLocation: this.currentLocationRef() };
	}

	restore(state: CampaignContextState | null): void {
		if (!state || !state.currentLocation) {
			this.clearCurrentLocation();
			return;
		}
		this.setCurrentLocation(state.currentLocation);
	}

	reloadFromStorage(): void {
		this.currentLocationRef.set(this.loadInitial());
	}

	private loadInitial(): CampaignLocationRef | null {
		try {
			return normalizeCampaignContext(this.storage.getItem(APP_STORAGE_KEYS.campaignContext))?.currentLocation ?? null;
		} catch {
			return null;
		}
	}

	private persist(): void {
		try {
			this.storage.setItem(APP_STORAGE_KEYS.campaignContext, JSON.stringify(this.getState()));
		} catch {}
	}
}
