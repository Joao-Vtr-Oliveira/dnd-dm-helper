import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
	selector: 'app-homebrew-sheets',
	standalone: true,
	imports: [CommonModule],
	template: `
		<div class="max-w-5xl mx-auto px-4 py-6 space-y-2">
			<h2 class="text-xl font-semibold">Homebrew Sheets</h2>
			<p class="text-sm opacity-70">
				Em breve: sistema para criar e salvar fichas homebrew no navegador.
			</p>
		</div>
	`,
})
export class HomebrewSheets {}
