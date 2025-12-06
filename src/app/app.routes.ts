import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { EncounterBuilder } from './pages/encounter-builder/encounter-builder';

export const routes: Routes = [
	{ path: '', redirectTo: 'home/encounter-builder', pathMatch: 'full' },
	{
		path: 'home',
		component: Home,
		children: [{ path: 'encounter-builder', component: EncounterBuilder }],
	},
];
