import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ITheme } from '../../core/services/app-service';
import type { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetElectricalFamilyComponent } from '../widget-electrical-family/widget-electrical-family.component';

@Component({
  selector: 'widget-charger',
  templateUrl: './widget-charger.component.html',
  styleUrl: './widget-charger.component.scss',
  imports: [WidgetElectricalFamilyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetChargerComponent {
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    color: 'contrast',
    ignoreZones: false,
    charger: {
      trackedIds: [],
      groups: [],
      optionsById: {}
    }
  };

  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();
}
