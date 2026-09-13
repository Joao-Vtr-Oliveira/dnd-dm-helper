import { routes } from './app.routes';

describe('app routes', () => {
	it('loads the world explorer lazily under Home', async () => {
		const homeRoute = routes.find((route) => route.path === 'home');
		const worldRoute = homeRoute?.children?.find((route) => route.path === 'world');

		expect(worldRoute?.loadComponent).toBeDefined();
		const component = (await worldRoute!.loadComponent!()) as { name: string };
		expect(component.name).toContain('WorldPage');
	});

	it('loads the spells compendium lazily under Home', async () => {
		const homeRoute = routes.find((route) => route.path === 'home');
		const spellsRoute = homeRoute?.children?.find((route) => route.path === 'compendium/spells');

		expect(spellsRoute?.loadComponent).toBeDefined();
		const component = (await spellsRoute!.loadComponent!()) as { name: string };
		expect(component.name).toContain('SpellsPage');
	});
});
