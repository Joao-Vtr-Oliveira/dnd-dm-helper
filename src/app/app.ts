import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ReferenceOverlayComponent } from './components/reference-overlay/reference-overlay';

@Component({
	selector: 'app-root',
	imports: [ReferenceOverlayComponent, RouterOutlet],
	templateUrl: './app.html',
})
export class App {
	protected readonly title = signal('dnd-dm-helper');
}
