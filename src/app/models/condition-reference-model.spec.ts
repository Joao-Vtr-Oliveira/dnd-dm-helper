import { conditionReferenceFor } from './condition-reference-model';

describe('conditionReferenceFor', () => {
	it('resolves every official condition referenced in creature features', () => {
		for (const condition of [
			'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated',
			'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned',
			'unconscious',
		]) {
			expect(conditionReferenceFor(condition).description).not.toContain('condição personalizada');
		}
	});

	it('retains the fallback for genuinely custom conditions', () => {
		expect(conditionReferenceFor('marked by moonlight').description).toContain('condição personalizada');
	});
});
