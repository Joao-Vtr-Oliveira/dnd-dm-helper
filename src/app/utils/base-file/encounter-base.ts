import { BattleTracker } from '../../models/battleTracker-model';

export let encounterBase: BattleTracker = {
	creatures: [],
	creatureIdCount: 0,
	round: 0,
	battleCreated: false,
	shareEnabled: false,
	battleTrackerVersion: '5.123.0',
	sharedTimestamp: null,
	loaded: false,
};
