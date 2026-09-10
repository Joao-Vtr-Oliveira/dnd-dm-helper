import type { CampaignLocationRef } from './campaign-world-model';
import { isCampaignLocationRef } from './campaign-world-model';

export interface CampaignContextState {
	currentLocation: CampaignLocationRef | null;
}

export function normalizeCampaignContext(raw: unknown): CampaignContextState | null {
	let parsed = raw;
	if (typeof parsed === 'string') {
		try {
			parsed = JSON.parse(parsed);
		} catch {
			return null;
		}
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
	const currentLocation = (parsed as { currentLocation?: unknown }).currentLocation;
	if (currentLocation === null) return { currentLocation: null };
	if (!isCampaignLocationRef(currentLocation)) return null;
	return { currentLocation };
}
