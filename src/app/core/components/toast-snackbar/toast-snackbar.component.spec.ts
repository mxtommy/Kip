import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';
import { ToastSnackbarComponent, ToastSnackbarData } from './toast-snackbar.component';

class MatSnackBarRefMock {
  public dismiss = jasmine.createSpy('dismiss');
  public dismissWithAction = jasmine.createSpy('dismissWithAction');
}

describe('ToastSnackbarComponent', () => {
  let fixture: ComponentFixture<ToastSnackbarComponent>;
  let snackBarRef: MatSnackBarRefMock;

  const createComponent = (data: ToastSnackbarData): void => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ToastSnackbarComponent],
      providers: [
        { provide: MAT_SNACK_BAR_DATA, useValue: data },
        { provide: MatSnackBarRef, useClass: MatSnackBarRefMock }
      ]
    });

    fixture = TestBed.createComponent(ToastSnackbarComponent);
    snackBarRef = TestBed.inject(MatSnackBarRef) as unknown as MatSnackBarRefMock;
    fixture.detectChanges();
  };

  it('renders action button when action label exists', () => {
    createComponent({ message: 'Plugin disabled', action: 'Enable Plugin', severity: 'warn' });

    const actionButton = fixture.debugElement.query(By.css('button[matSnackBarAction]'));
    expect(actionButton).toBeTruthy();
    expect((actionButton.nativeElement as HTMLButtonElement).textContent?.trim()).toBe('Enable Plugin');
  });

  it('does not render action button when action is missing', () => {
    createComponent({ message: 'Saved', severity: 'success' });

    const actionGroup = fixture.debugElement.query(By.css('.button-group'));
    expect(actionGroup).toBeFalsy();
  });

  it('clicking action button triggers dismissWithAction', () => {
    createComponent({ message: 'Plugin disabled', action: 'Enable Plugin', severity: 'warn' });

    const actionButton = fixture.debugElement.query(By.css('button[matSnackBarAction]'));
    actionButton.nativeElement.click();

    expect(snackBarRef.dismissWithAction).toHaveBeenCalled();
    expect(snackBarRef.dismiss).not.toHaveBeenCalled();
  });

  it('clicking close button triggers dismiss only', () => {
    createComponent({ message: 'Plugin disabled', severity: 'warn' });

    const closeButton = fixture.debugElement.query(By.css('.toast-close'));
    closeButton.nativeElement.click();

    expect(snackBarRef.dismiss).toHaveBeenCalled();
    expect(snackBarRef.dismissWithAction).not.toHaveBeenCalled();
  });
});
