import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { migrateBackupV1, migrateFile, validateLegacyBackupV1 } from './migrate-data-model-v2.mjs';
import { validateBackupV2 } from './validate-backup-v2.mjs';

const fixtureUrl = new URL('./fixtures/backup-v1-representative.json', import.meta.url);

test('rejects an invalid or non-v1 backup', () => {
	assert.throws(() => validateLegacyBackupV1({}), /Backup app/);
	assert.throws(
		() =>
			migrateBackupV1({
				app: 'dnd-dm-helper',
				type: 'campaign-backup',
				schemaVersion: 2,
				exportedAt: '2026-09-11T12:00:00.000Z',
				data: {},
			}),
		/schemaVersion 1/,
	);
});

test('migrates representative v1 encounters, battle references, sheets, and raw storage', async () => {
	const input = JSON.parse(await readFile(fixtureUrl, 'utf8'));
	const { backup, report } = migrateBackupV1(input);
	validateBackupV2(backup);

	assert.equal(backup.schemaVersion, 2);
	const encounter = backup.data.encounters[0];
	const participant = encounter.participants[0];
	assert.equal(participant.id, 'encounter-1:participant:7');
	assert.equal(participant.sheet.maxHp, 18);
	assert.deepEqual(participant.sheet.spells, [{ id: 'moonbeam', name: 'Moonbeam', uses: 2 }]);
	assert.equal(participant.sheet.specialAbilities[0].recoveryType, 'dice-recharge');
	assert.equal(encounter.lairActions[0].currentCooldownRounds, undefined);
	assert.equal(encounter.lairActions[0].lastTriggeredAtRound, undefined);

	const combatant = backup.data.battleEncounters[0].combatants[0];
	assert.equal(combatant.sourceParticipantId, participant.id);
	assert.equal(combatant.sourceCreatureId, undefined);
	assert.deepEqual(combatant.spells, [{ id: 'moonbeam', name: 'Moonbeam', uses: 1 }]);
	assert.equal(combatant.features[0].name, 'Keen Hearing');
	assert.equal(combatant.sheetFeatures, undefined);
	assert.equal(combatant.specialAbilities[0].currentCooldownRounds, 1);
	assert.equal(combatant.specialAbilities[0].recoveryType, 'dice-recharge');

	const sheet = backup.data.homebrewSheets[0];
	assert.equal(sheet.externalId, 'sheet-wolf');
	assert.deepEqual(sheet.data.fiveEToolsIdentity, { name: 'Moon Wolf', source: 'LUN' });
	assert.equal(backup.data.rawLocalStorage['dnd-dm-helper.encounters.v1'], undefined);
	assert.equal(backup.data.rawLocalStorage['dnd-dm-helper.sheets.v1'], undefined);
	assert.equal(backup.data.rawLocalStorage['unrelated.key'], 'preserve-me');
	assert.deepEqual(backup.data.fiveEToolsHomebrewCompositionPackages, [
		{ id: 'package-1', name: 'Moon Pack' },
	]);
	assert.equal(report.output.participants, 1);
});

test('refuses to overwrite a v1 input or an existing output without --force', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'dnd-dm-helper-v2-'));
	const inputPath = join(directory, 'backup-v1.json');
	const outputPath = join(directory, 'backup-v2.json');
	const fixture = await readFile(fixtureUrl, 'utf8');
	try {
		await writeFile(inputPath, fixture);
		await assert.rejects(() => migrateFile(inputPath, inputPath), /Refusing to overwrite/);
		await writeFile(outputPath, '{}');
		await assert.rejects(() => migrateFile(inputPath, outputPath), /Output already exists/);
		const { backup } = await migrateFile(inputPath, outputPath, { force: true });
		assert.equal(backup.schemaVersion, 2);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
