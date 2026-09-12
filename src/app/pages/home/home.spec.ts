import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Home } from './home';
import { AppBackupService } from '../../services/app-backup-service/app-backup-service';

describe('Home', () => {
	let component: Home;
	let fixture: ComponentFixture<Home>;
	let appBackupService: jasmine.SpyObj<AppBackupService>;

	beforeEach(async () => {
		localStorage.clear();
		appBackupService = jasmine.createSpyObj<AppBackupService>('AppBackupService', [
			'consumePostSyncToast',
			'createSafetyBackupBeforeSync',
			'applyBackup',
			'storePostSyncToast',
			'fetchRemoteBackup',
			'buildSummary',
		]);
		appBackupService.consumePostSyncToast.and.returnValue(null);

		await TestBed.configureTestingModule({
			imports: [Home],
			providers: [
				provideZonelessChangeDetection(),
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([]),
				{ provide: AppBackupService, useValue: appBackupService },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(Home);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('includes Mundo in the Campanha navigation group', () => {
		const campaign = component.navGroups.find((group) => group.label === 'Campanha');
		expect(campaign?.links?.map((link) => link.label)).toEqual([
			'Dashboard',
			'Mundo',
			'Calendário',
		]);
	});

	it('opens and closes the compact mobile navigation', () => {
		expect(component.mobileNavigationOpen()).toBeFalse();
		component.toggleMobileNavigation();
		expect(component.mobileNavigationOpen()).toBeTrue();
		component.closeMobileNavigation();
		expect(component.mobileNavigationOpen()).toBeFalse();
	});

	it('closes the mobile navigation with Escape', () => {
		component.toggleMobileNavigation();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(component.mobileNavigationOpen()).toBeFalse();
	});

	it('reloads the app after applying a confirmed sync', async () => {
		const reloadSpy = spyOn<any>(component, 'reloadPage');
		const backup = { exportedAt: '2026-01-01T10:00:00.000Z' } as any;

		component.syncPreview.set({
			backup,
			summary: {
				encounters: 1,
				battleEncounters: 0,
				homebrewSheets: 0,
				hasCalendar: false,
				calendarLabel: null,
				exportedAt: '2026-01-01T10:00:00.000Z',
			},
		});

		await component.confirmSync();

		expect(appBackupService.createSafetyBackupBeforeSync).toHaveBeenCalled();
		expect(appBackupService.applyBackup).toHaveBeenCalledWith(backup);
		expect(appBackupService.storePostSyncToast).toHaveBeenCalledWith('Sincronização concluída');
		expect(reloadSpy).toHaveBeenCalled();
	});

	it('opens a V2 restore confirmation when only local V1 data exists', async () => {
		const backup = { exportedAt: '2026-01-01T10:00:00.000Z' } as any;
		appBackupService.fetchRemoteBackup.and.resolveTo(backup);
		appBackupService.buildSummary.and.returnValue({
			encounters: 7,
			battleEncounters: 5,
			homebrewSheets: 17,
			hasCalendar: true,
			calendarLabel: 'Primavera',
			exportedAt: backup.exportedAt,
		});
		localStorage.setItem('dnd-dm-helper.encounters.v1', '[]');

		const restoreFixture = TestBed.createComponent(Home);
		restoreFixture.detectChanges();
		await Promise.resolve();

		expect(appBackupService.fetchRemoteBackup).toHaveBeenCalled();
		expect(restoreFixture.componentInstance.syncPreview()?.backup).toBe(backup);
	});
});
