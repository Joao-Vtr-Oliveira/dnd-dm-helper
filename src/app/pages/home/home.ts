import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

@Component({
	selector: 'app-home',
	imports: [RouterOutlet],
	templateUrl: './home.html',
})
export class Home {
	private router = inject(Router);

	onClickTitle () {
		this.router.navigate(['/home'])
	}
}
