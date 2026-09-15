import { normalizeWorkspaceRemoteUrl, validateWorkspaceManifest } from './workspace-model';

describe('workspace remote URLs', () => {
	const dropboxShareUrl =
		'https://www.dropbox.com/scl/fi/3trduahrz438c9uic48zp/dnd-dm-helper-backup-v2.json?rlkey=0ec481n1xfnqe2hewszox02o2&st=elu5f9fk&dl=0';
	const dropboxRawUrl =
		'https://dl.dropboxusercontent.com/scl/fi/3trduahrz438c9uic48zp/dnd-dm-helper-backup-v2.json?rlkey=0ec481n1xfnqe2hewszox02o2&st=elu5f9fk&dl=0';

	it('converts Dropbox share URLs to raw delivery URLs', () => {
		expect(normalizeWorkspaceRemoteUrl(dropboxShareUrl)).toBe(dropboxRawUrl);
	});

	it('normalizes Dropbox URLs imported from a workspace manifest', () => {
		const validation = validateWorkspaceManifest({
			schemaVersion: 1,
			name: 'Campanha',
			backupUrl: dropboxShareUrl,
			worldUrl: 'https://example.com/campaign-world.json',
		});

		expect(validation.valid).toBeTrue();
		expect(validation.manifest?.backupUrl).toBe(dropboxRawUrl);
	});
});
