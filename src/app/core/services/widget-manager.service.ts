/**
 * This service runs all Widget management operations, handles widget
 * persistance and defines possible Widget properties.
 */
import { Injectable } from '@angular/core';
import { AppSettingsService } from './app-settings.service';
import { IWidget, IWidgetSvcConfig } from '../interfaces/widgets-interface';
import { UUID } from '../utils/uuid'

@Injectable()
export class WidgetManagerService {

  widgets: Array<IWidget>;

  constructor(private settings: AppSettingsService) {
    this.widgets = this.settings.getWidgets();
  }

  getWidget(uuid: string) {
    const widget = this.widgets.find(w => w.uuid == uuid);
    return widget;
  }

  /**
   * Creates and persists a new widget.
   *
   * @returns {string} The UUID of the newly created widget.
   */
  public newWidget(): string {
    const uuid = UUID.create();
    this.widgets.push({ uuid: uuid, type: 'WidgetBlank', config: {displayName: ''} });
    this.saveWidgets();
    return uuid;
  }

  deleteWidget(uuid) {
    const wIndex = this.widgets.findIndex(w => w.uuid == uuid);
    if (wIndex < 0) { return; } // not found
    this.widgets.splice(wIndex, 1);
  }

  updateWidgetType(uuid: string, newNodeType: string) {
    const wIndex = this.widgets.findIndex(w => w.uuid == uuid);
    if (wIndex < 0) { return; } // not found
    this.widgets[wIndex].config = null;
    this.widgets[wIndex].type = newNodeType;
    this.saveWidgets();
  }

  updateWidgetConfig(uuid: string, newConfig: IWidgetSvcConfig) {
    const widget = this.widgets.find(w => w.uuid == uuid);

    if (!widget) { return; } // not found

    widget.config = newConfig;
    this.saveWidgets();
  }

  //TODO: update or delete this method
  saveWidgets() {
    this.settings.saveWidgets(this.widgets);
  }

}
