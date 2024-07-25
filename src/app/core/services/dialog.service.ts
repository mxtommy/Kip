import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { DialogComponentData, DialogConfirmationData } from '../interfaces/dialog-data';
import { DialogFrameComponent } from '../components/dialog-frame/dialog-frame.component';
import { DialogConfirmationComponent } from '../components/dialog-confirmation/dialog-confirmation.component';
import { SettingsTabsComponent } from '../../settings/tabs/tabs.component';

@Injectable({
  providedIn: 'root'
})
export class DialogService {

  constructor(private dialog: MatDialog) { }

  public openFrameDialog(data: DialogComponentData, fullscreen: boolean): Observable<boolean> {
    switch (data.component) {
      case 'settings':
        data.componentType = SettingsTabsComponent;
        break;
    }

    return this.dialog.open(DialogFrameComponent,
      {
        data: data,
        height: fullscreen ? "calc(100% - 30px)" : "",
        width: fullscreen ? "calc(100% - 30px)" : "",
        maxWidth: fullscreen ? "100%" : "",
        maxHeight: fullscreen ? "100%" : ""
      }
    ).afterClosed();
  }

  public openConfirmationDialog(data: DialogConfirmationData, fullscreen: boolean): Observable<boolean> {
    return this.dialog.open(DialogConfirmationComponent,
      {
        data: data,
        minWidth: "35vw",
        minHeight: "25vh",
      }
    ).afterClosed();
  }
}
