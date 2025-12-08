import { Component, inject } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { environment } from '../../../environments/environment';

type NavLink = {
	label: string;
	icon: string;
	path: string;
	exact?: boolean;
	requiresDmCalendar?: boolean; // 👈 novo
};

@Component({
	selector: 'app-home',
	imports: [RouterOutlet, RouterModule],
	templateUrl: './home.html',
})
export class Home {
	private router = inject(Router);

	dmCalendarEnabled = environment.showDmCalendar;

	onClickTitle() {
		this.router.navigate(['/home']);
	}

	navLinks: NavLink[] = [
		{
			label: 'Encounter Hub',
			icon: '/svgs/home.svg',
			path: '/home',
			exact: true,
		},
		{
			label: 'Encounter Builder',
			icon: '/svgs/sword.svg',
			path: '/home/encounter-builder',
		},
		{
			label: 'Homebrew Sheets',
			icon: '/svgs/sheet.svg',
			path: '/home/homebrew',
		},
		{
			label: 'Calendar',
			icon: '/svgs/calendar.svg',
			path: '/home/calendar',
			requiresDmCalendar: true,
		},
	];
}
