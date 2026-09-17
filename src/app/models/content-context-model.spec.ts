import {
	normalizeContentLocationRelations,
	normalizeContentOrganizationRelations,
} from './content-context-model';

describe('content context metadata', () => {
	it('keeps structurally valid relations even when their IDs cannot be resolved yet', () => {
		expect(
			 normalizeContentLocationRelations([
				{ scopeType: 'state', scopeId: ' missing-state ', relation: 'habitat' },
			]),
		).toEqual([{ scopeType: 'state', scopeId: 'missing-state', relation: 'habitat' }]);
		expect(
			normalizeContentOrganizationRelations([
				{ organizationId: ' missing-organization ', relation: 'affiliated' },
			]),
		).toEqual([{ organizationId: 'missing-organization', relation: 'affiliated' }]);
	});

	it('drops malformed and superseded contextual relations', () => {
		expect(
			normalizeContentLocationRelations([
				{ scopeType: 'global', scopeId: 'campaign', relation: 'base' },
				{ scopeType: 'state', scopeId: '', relation: 'habitat' },
				{ scopeType: 'state', scopeId: 'state', relation: 'generic' },
			]),
		).toEqual([]);
		expect(
			normalizeContentOrganizationRelations([
				{ organizationId: 'guild', relation: 'enemy' },
			]),
		).toEqual([]);
	});
});
