import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { DialogComponentData, DialogConfirmationData, DialogNameData, DialogWidgetOptionsData } from '../interfaces/dialog-data';
import { DialogFrameComponent } from '../components/dialog-frame/dialog-frame.component';
import { DialogConfirmationComponent } from '../components/dialog-confirmation/dialog-confirmation.component';
import { AppSettingsComponent } from '../../settings/settings/settings.component';
import { DialogNameComponent } from '../components/dialog-name/dialog-name.component';
import { ModalWidgetConfigComponent } from '../../widget-config/modal-widget-config/modal-widget-config.component';

@Injectable({
  providedIn: 'root'
})
export class DialogService {

  constructor(private dialog: MatDialog) { }

  public openFrameDialog(data: DialogComponentData, fullscreen: boolean): Observable<boolean> {
    switch (data.component) {
      case 'settings':
        data.componentType = AppSettingsComponent;
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

  public openConfirmationDialog(data: DialogConfirmationData): Observable<boolean> {
    return this.dialog.open(DialogConfirmationComponent,
      {
        data: data,
        minWidth: "35vw",
        minHeight: "25vh",
      }
    ).afterClosed();
  }

  public openNameDialog(data: DialogNameData): MatDialogRef<DialogNameComponent> {
    return this.dialog.open(DialogNameComponent,
      {
        data: data,
        minWidth: "20vw",
        minHeight: "20vh",
      }
    );
  }

  public openWidgetOptions(data: DialogWidgetOptionsData): MatDialogRef<ModalWidgetConfigComponent> {
    return this.dialog.open(ModalWidgetConfigComponent,
      {
        data: data.config,
        minWidth: "50vw",
        maxWidth: "90vw"
      }
    );
  }
}