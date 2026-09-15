import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { canDeactivateEncounterBuilder, EncounterBuilder } from './pages/encounter-builder/encounter-builder';
import { EncounterHub } from './pages/encounter-hub/encounter-hub';
import { HomebrewSheets } from './pages/homebrew-sheets/homebrew-sheets';
import { Calendar } from './pages/calendar/calendar';
import { canDeactivateHomebrewBuilder, HomebrewBuilder } from './pages/homebrew-builder/homebrew-builder';
import { FiveEToolsHomebrewPage } from './pages/fiveetools-homebrew/fiveetools-homebrew';
import { workspaceActiveGuard } from './guards/workspace-active.guard';
import { OnboardingPage } from './pages/onboarding/onboarding';

export const routes: Routes = [
	{ path: '', redirectTo: 'home/encounter-builder', pathMatch: 'full' },
	{ path: 'onboarding', component: OnboardingPage },
	{
		path: 'home',
		component: Home,
		canActivate: [workspaceActiveGuard],
		children: [
			{ path: '', component: EncounterHub },
			{ path: 'workspaces', loadComponent: () => import('./pages/workspaces/workspaces').then((module) => module.WorkspacesPage) },
			{
				path: 'compendium/bestiary',
				loadComponent: () => import('./pages/bestiary/bestiary').then((module) => module.BestiaryPage),
			},
			{
				path: 'compendium/spells',
				loadComponent: () => import('./pages/spells/spells').then((module) => module.SpellsPage),
			},
			{
				path: 'world',
				loadComponent: () => import('./pages/world/world').then((module) => module.WorldPage),
			},
			{ path: 'encounter-builder', component: EncounterBuilder, canDeactivate: [canDeactivateEncounterBuilder] },
			{ path: 'encounter-builder/:id', component: EncounterBuilder, canDeactivate: [canDeactivateEncounterBuilder] },
			{
				path: 'battle-tracker/:battleId',
				loadComponent: () =>
					import('./pages/battle-tracker/battle-tracker').then((module) => module.BattleTrackerPage),
			},
			{ path: 'homebrew', component: HomebrewSheets },
			{ path: 'homebrew-builder', component: HomebrewBuilder, canDeactivate: [canDeactivateHomebrewBuilder] },
			{ path: 'homebrew-builder/:id', component: HomebrewBuilder, canDeactivate: [canDeactivateHomebrewBuilder] },
			{ path: '5etools-homebrew', component: FiveEToolsHomebrewPage },
			{ path: 'calendar', component: Calendar },
		],
	},

	{ path: '**', redirectTo: 'home' },
];
