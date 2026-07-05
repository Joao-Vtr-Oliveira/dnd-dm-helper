import { TestBed } from '@angular/core/testing';

import { EncounterIoService } from './encounter-io-service';

describe('EncounterIoService', () => {
  let service: EncounterIoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EncounterIoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

	it('preserves lair actions and traps on export/import', () => {
		const result = service.fromObject(
			service.toExportObject({
				creatures: [],
				creatureIdCount: 0,
				lairActions: [
					{
						id: 'l1',
						name: 'Olho do Covil',
						initiative: 20,
						active: true,
						frequency: 'every-round',
					},
				],
				traps: [
					{
						id: 't1',
						name: 'Dardos',
						triggerType: 'initiative',
						initiative: 10,
						active: true,
						frequency: 'once',
					},
				],
				round: 0,
				battleCreated: false,
				shareEnabled: false,
				battleTrackerVersion: '5.123.0',
				sharedTimestamp: null,
				loaded: true,
			}),
		);

		expect(result.encounter.lairActions).toHaveSize(1);
		expect(result.encounter.traps).toHaveSize(1);
		expect(result.encounter.lairActions?.[0].name).toBe('Olho do Covil');
		expect(result.encounter.traps?.[0].name).toBe('Dardos');
	});
});
