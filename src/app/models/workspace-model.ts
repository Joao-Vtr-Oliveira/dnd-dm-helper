export type WorkspaceType = 'local' | 'remote';

export interface WorkspaceRemoteConfiguration {
	backupUrl?: string;
	worldUrl?: string;
	manifestUrl?: string;
}

export interface Workspace {
	id: string;
	name: string;
	type: WorkspaceType;
	createdAt: number;
	updatedAt?: number;
	lastSyncedAt?: number;
	remote?: WorkspaceRemoteConfiguration;
}

export interface WorkspaceManifest {
	schemaVersion: 1;
	name: string;
	backupUrl: string;
	worldUrl: string;
	id?: string;
}

export interface WorkspaceRegistry {
	schemaVersion: 1;
	activeWorkspaceId: string | null;
	workspaces: Workspace[];
	legacyMigrationCompleted: boolean;
}

export interface WorkspaceManifestValidationResult {
	valid: boolean;
	manifest?: WorkspaceManifest;
	error?: string;
}

function isPublicHttpUrl(value: unknown): value is string {
	if (typeof value !== 'string' || !value.trim()) return false;
	try {
		const url = new URL(value);
		return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
	} catch {
		return false;
	}
}

export function validateWorkspaceManifest(raw: unknown): WorkspaceManifestValidationResult {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return { valid: false, error: 'Workspace inválido.' };
	}
	const candidate = raw as Partial<WorkspaceManifest>;
	if (candidate.schemaVersion !== 1 || typeof candidate.name !== 'string' || !candidate.name.trim()) {
		return { valid: false, error: 'Workspace inválido.' };
	}
	if (!isPublicHttpUrl(candidate.backupUrl) || !isPublicHttpUrl(candidate.worldUrl)) {
		return { valid: false, error: 'As URLs do workspace precisam ser HTTP(S) públicas e válidas.' };
	}
	if (candidate.id !== undefined && (typeof candidate.id !== 'string' || !candidate.id.trim())) {
		return { valid: false, error: 'Workspace inválido.' };
	}
	return {
		valid: true,
		manifest: {
			schemaVersion: 1,
			name: candidate.name.trim(),
			backupUrl: candidate.backupUrl,
			worldUrl: candidate.worldUrl,
			...(candidate.id ? { id: candidate.id } : {}),
		},
	};
}

export function isWorkspaceRemoteUrl(value: string): boolean {
	return isPublicHttpUrl(value);
}
