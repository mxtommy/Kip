import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ITheme } from '../../core/services/app-service';
import type { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetElectricalFamilyComponent } from '../widget-electrical-family/widget-electrical-family.component';

@Component({
  selector: 'widget-ac',
  templateUrl: './widget-ac.component.html',
  styleUrl: './widget-ac.component.scss',
  imports: [WidgetElectricalFamilyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetAcComponent {
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    color: 'contrast',
    ignoreZones: false,
    ac: {
      trackedIds: [],
      groups: [],
      optionsById: {}
    }
  };

  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();
}
