import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';

import { ToastService } from './toast.service';
import { AppSettingsService } from './app-settings.service';
import { ToastSnackbarComponent } from '../components/toast-snackbar/toast-snackbar.component';

class MatSnackBarMock {
  public openFromComponent = jasmine.createSpy('openFromComponent').and.callFake(() => ({
    onAction: () => new BehaviorSubject<void>(undefined).asObservable()
  } as unknown as MatSnackBarRef<ToastSnackbarComponent>));
}

class AppSettingsServiceMock {
  private readonly cfg = { sound: { disableSound: true } };

  public getNotificationServiceConfigAsO() {
    return new BehaviorSubject(this.cfg).asObservable();
  }

  public getNotificationConfig() {
    return this.cfg;
  }
}

describe('ToastService', () => {
  let service: ToastService;
  let snackBar: MatSnackBarMock;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ToastService,
        { provide: MatSnackBar, useClass: MatSnackBarMock },
        { provide: AppSettingsService, useClass: AppSettingsServiceMock }
      ]
    });
    service = TestBed.inject(ToastService);
    snackBar = TestBed.inject(MatSnackBar) as unknown as MatSnackBarMock;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('show passes action into snackbar data and returns MatSnackBarRef', () => {
    const ref = service.show('Plugin disabled', 0, true, 'warn', 'Enable Plugin');

    expect(snackBar.openFromComponent).toHaveBeenCalled();
    const openArgs = snackBar.openFromComponent.calls.mostRecent().args;
    expect(openArgs[0]).toBe(ToastSnackbarComponent);
    expect(openArgs[1].data.action).toBe('Enable Plugin');
    expect(openArgs[1].data.message).toBe('Plugin disabled');
    expect(ref).toBeTruthy();
  });

  it('show updates lastSnack including action', () => {
    service.show('Plugin disabled', 0, true, 'warn', 'Enable Plugin');

    const lastSnack = service.lastSnack();
    expect(lastSnack).toBeTruthy();
    expect(lastSnack?.action).toBe('Enable Plugin');
    expect(lastSnack?.severity).toBe('warn');
  });
});
