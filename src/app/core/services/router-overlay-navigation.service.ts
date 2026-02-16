import { DestroyRef, Injectable, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root'
})
export class RouterOverlayNavigationService {
  private readonly _router = inject(Router);
  private readonly _dialog = inject(MatDialog);
  private readonly _bottomSheet = inject(MatBottomSheet);
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    this._router.events
      .pipe(
        filter((event): event is NavigationStart => event instanceof NavigationStart),
        takeUntilDestroyed(this._destroyRef)
      )
      .subscribe(() => {
        if (this._dialog.openDialogs.length > 0) {
          this._dialog.closeAll();
        }
        this._bottomSheet.dismiss();
      });
  }
}
