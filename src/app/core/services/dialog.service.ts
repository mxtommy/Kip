import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { DialogComponentData, DialogConfirmationData, DialogNameData, DialogDashboardPageEditorData, DialogWidgetOptionsData } from '../interfaces/dialog-data';
import { DialogFrameComponent } from '../components/dialog-frame/dialog-frame.component';
import { DialogConfirmationComponent } from '../components/dialog-confirmation/dialog-confirmation.component';
import { DialogNameComponent } from '../components/dialog-name/dialog-name.component';
import { ModalWidgetConfigComponent } from '../../widget-config/modal-widget-config/modal-widget-config.component';
import { WidgetsListComponent } from '../components/widgets-list/widgets-list.component';
import { UpgradeConfigComponent } from '../components/upgrade-config/upgrade-config.component';
import { DialogDashboardPageEditorComponent } from '../components/dialog-dashboard-page-editor/dialog-dashboard-page-editor.component';

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private dialog = inject(MatDialog);


  public openFrameDialog(data: DialogComponentData, fullscreen: boolean): Observable<boolean> {
    switch (data.component) {
      case 'select-widget':
        data.componentType = WidgetsListComponent;
        break;
      case 'upgrade-config':
        data.componentType = UpgradeConfigComponent;
        break;
    }

    return this.dialog.open(DialogFrameComponent,
      {
        data: data,
        height: fullscreen ? "calc(100% - 30px)" : "",
        width: fullscreen ? "calc(100% - 30px)" : "",
        maxWidth: fullscreen ? "100%" : "",
        maxHeight: fullscreen ? "100%" : "",
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
        disableClose: false,
      }
    );
  }

  public openDashboardPageEditorDialog(data: DialogDashboardPageEditorData): MatDialogRef<DialogDashboardPageEditorComponent> {
    return this.dialog.open(DialogDashboardPageEditorComponent,
      {
        data: data,
        minWidth: "60vw",
        maxWidth: "90vw",
        maxHeight: "95vh",
        disableClose: false,
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
