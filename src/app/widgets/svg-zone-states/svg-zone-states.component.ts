import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import type { IDynamicControl } from '../../core/interfaces/widgets-interface';
import type { ITheme } from '../../core/services/app-service';
import { IDimensions } from '../widget-zones-state-panel/widget-zones-state-panel.component';
import { States } from '../../core/interfaces/signalk-interfaces';
import { getColors } from "../../core/utils/themeColors.utils";


@Component({
    selector: 'app-svg-zone-states',
    templateUrl: './svg-zone-states.component.svg',
    styleUrls: ['./svg-zone-states.component.scss']
})
export class SvgZoneStatesComponent {
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly data = input<IDynamicControl>(null, { alias: "controlData" });
  readonly theme = input<ITheme>(null);
  readonly dimensions = input.required<IDimensions>();
  readonly toggleClick = output<IDynamicControl>();

  public ctrlLabelColor = signal<string>(null);
  public ctrlStateColor = signal<string>(null);
  public messageTxtColor = signal<string>(null);

  protected shouldEmergencyBlink = computed(() => {
    const s = (this.data()?.notificationState ?? '').toLowerCase();
     return s === 'emergency';
  });

  protected shouldAlarmBlink = computed(() => {
    const s = (this.data()?.notificationState ?? '').toLowerCase();
     return s === 'alarm';
  });

  constructor() {
    effect(() => {
      const data = this.data();
      const theme = this.theme();

      untracked(() => {
        switch (data.notificationState) {
          case States.Emergency:
            this.ctrlStateColor.set(theme.zoneEmergency);
            this.messageTxtColor.set(theme.background);
            break;
          case States.Alarm:
            this.ctrlStateColor.set(theme.zoneAlarm);
            this.messageTxtColor.set(theme.background);
            break;
          case States.Warn:
            this.ctrlStateColor.set(theme.zoneWarn);
            this.messageTxtColor.set(theme.background);
            break;
          case States.Alert:
            this.ctrlStateColor.set(theme.zoneAlert);
            this.messageTxtColor.set(theme.background);
            break;
          default:
            this.ctrlStateColor.set(theme.background);
            this.messageTxtColor.set(getColors(data.color, theme).dim);
            break;
        }

        this.ctrlLabelColor.set(getColors(data.color, theme).color);
      });
    });
  }
}
