import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { EncounterBuilder } from './pages/encounter-builder/encounter-builder';
import { EncounterHub } from './pages/encounter-hub/encounter-hub';

export const routes: Routes = [
	{ path: '', redirectTo: 'home/encounter-builder', pathMatch: 'full' },
	{
		path: 'home',
		component: Home,
		children: [
			{ path: '', component: EncounterHub },
			{ path: 'encounter-builder', component: EncounterBuilder },
			{ path: 'encounter-builder/:id', component: EncounterBuilder },
		],
	},
];
