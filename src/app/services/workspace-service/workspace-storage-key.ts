export function workspaceStorageKey(workspaceId: string, key: string): string {
	return `dnd-dm-helper.workspace:${workspaceId}:${key}`;
}
