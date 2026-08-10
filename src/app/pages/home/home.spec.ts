import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Home } from './home';
import { AppBackupService } from '../../services/app-backup-service/app-backup-service';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let appBackupService: jasmine.SpyObj<AppBackupService>;

  beforeEach(async () => {
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
      providers: [provideRouter([]), { provide: AppBackupService, useValue: appBackupService }],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
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
});
