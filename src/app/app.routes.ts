import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { EncounterBuilder } from './pages/encounter-builder/encounter-builder';
import { EncounterHub } from './pages/encounter-hub/encounter-hub';
import { HomebrewSheets } from './pages/homebrew-sheets/homebrew-sheets';
import { Calendar } from './pages/calendar/calendar';

export const routes: Routes = [
	{ path: '', redirectTo: 'home/encounter-builder', pathMatch: 'full' },
	{
		path: 'home',
		component: Home,
		children: [
			{ path: '', component: EncounterHub },
			{ path: 'encounter-builder', component: EncounterBuilder },
			{ path: 'encounter-builder/:id', component: EncounterBuilder },
			{ path: 'homebrew', component: HomebrewSheets },
			{ path: 'calendar', component: Calendar },
		],
	},

	{ path: '**', redirectTo: 'home' },
];
