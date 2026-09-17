import {
	normalizeContentLocationRelations,
	normalizeContentOrganizationRelations,
	resolveLegacyContentContextRelations,
} from './content-context-model';
import type { CampaignWorld } from './campaign-world-model';

describe('content context metadata', () => {
	it('keeps structurally valid relations even when their IDs cannot be resolved yet', () => {
		expect(
			normalizeContentLocationRelations([
				{ scopeType: 'state', scopeId: ' missing-state ', relation: 'regional' },
			]),
		).toEqual([{ scopeType: 'state', scopeId: 'missing-state', relation: 'regional' }]);
		expect(
			normalizeContentOrganizationRelations([
				{ organizationId: ' missing-organization ', relation: 'affiliated' },
			]),
		).toEqual([{ organizationId: 'missing-organization', relation: 'affiliated' }]);
	});

	it('drops malformed contextual relations', () => {
		expect(
			normalizeContentLocationRelations([
				{ scopeType: 'global', scopeId: 'campaign', relation: 'regional' },
				{ scopeType: 'state', scopeId: '', relation: 'regional' },
			]),
		).toEqual([]);
		expect(
			normalizeContentOrganizationRelations([
				{ organizationId: 'guild', relation: 'enemy' },
			]),
		).toEqual([]);
	});

	it('derives only exact empire and organization tags from the registered world', () => {
		const world = {
			empires: [{ id: 'komic', name: 'Komic', aliases: [] }],
			states: [{ id: 'nirvak', name: 'Nirvak', aliases: [], empireId: 'komic' }],
			settlements: [
				{ id: 'nirvak-city', name: 'Nirvak', aliases: [], stateId: 'nirvak', settlementType: 'city' },
			],
			organizations: [
				{ id: 'winterhold', name: 'Winterhold', aliases: ['WH'], organizationType: 'guild', presence: [] },
			],
			pointsOfInterest: [],
		} as unknown as CampaignWorld;

		expect(
			resolveLegacyContentContextRelations({ tags: ['Komic', 'WH', 'Nirvak'] }, world),
		).toEqual({
			locationRefs: [{ scopeType: 'empire', scopeId: 'komic', relation: 'regional' }],
			organizationRefs: [{ organizationId: 'winterhold', relation: 'associated' }],
		});
	});
});
