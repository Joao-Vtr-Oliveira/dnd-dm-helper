import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { WorkspaceService } from '../services/workspace-service/workspace-service';

export const workspaceActiveGuard: CanActivateFn = () => {
	const workspaces = inject(WorkspaceService);
	return workspaces.activeWorkspace() ? true : inject(Router).createUrlTree(['/onboarding']);
};
