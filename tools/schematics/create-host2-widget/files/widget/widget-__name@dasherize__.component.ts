<%# keep ejs tags intact %>
import { AfterViewInit, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
// TODO: Signal K Zones support: Uncomment or delete depending on your widget needs.
//import { WidgetMetadataDirective } from '../../core/directives/widget-metadata.directive';
//import { IDataHighlight } from '../../core/interfaces/widgets-interface';
//import { computed } from '@angular/core';
//import { getHighlights } from '../../core/utils/zones-highlight.utils';
//import { UnitsService } from '../../core/services/units.service';
import { ITheme } from '../../core/services/app-service';
import { getColors } from '../../core/utils/themeColors.utils';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';

@Component({
  selector: '<%= selector %>',
  templateUrl: './<%= selector %>.component.html',
  styleUrls: ['./<%= selector %>.component.scss'],
  imports: [WidgetTitleComponent]
})
export class <%= className %> implements AfterViewInit {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: "My New Widget Label",
    color: "contrast",
    paths: {
      "signalKPath": {
        description: "My new widget Options path description",
        path: <%= pathDefault === null ? 'null' : `'${pathDefault}'` %>,
        source: null,
        pathType: '<%= pathType %>',
        isPathConfigurable: true,
        pathRequired: true,
        convertUnitTo: null,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: null,
        sampleTime: 1000
      }
    },
    filterSelfPaths: true,
    enableTimeout: false,
    dataTimeout: 5,
    // TODO: Signal K Zones support: Uncomment or delete depending on your widget needs.
    // Well known widget Options properties (see IWidgetSvcConfig interface) are
    // automatically included in the widget configuration UI if present in config object.
    //ignoreZones: <%= ignoreZones %>,
  };

  protected runtime = inject(WidgetRuntimeDirective);
  private streams = inject(WidgetStreamsDirective);
  // TODO: Signal K Zones support: Uncomment or delete depending on your widget needs.
  //private readonly metadata = inject(WidgetMetadataDirective);
  //private readonly unitsService = inject(UnitsService);

  protected titleColor = signal<string | undefined>(undefined);
  protected pathValue = signal<number | null>(null);

  // TODO: Signal K Zones support: Uncomment or delete depending on your widget needs.
  // Sample computed signal for zones highlights.
  //protected highlights = computed<IDataHighlight[]>(() => {
  //  const zones = this.metadata.zones();
  //  const cfg = this.runtime.options();
  //  const theme = this.theme();
  //
  //  if (cfg?.ignoreZones || !zones?.length || !theme) return [];
  //  const unit = cfg.paths['gaugePath'].convertUnitTo;
  //  const min = cfg.displayScale.lower;
  //  const max = cfg.displayScale.upper;
  //  return getHighlights(zones, theme, unit, this.unitsService, min, max);
  //});

  constructor() {
    effect(() => {
      const theme = this.theme();
      const cfg = this.runtime.options();
      if (!theme || !cfg) return;

      untracked(() => {
        // Update title color when theme colors are changed. Themes are either, Dark, Light or Red Night mode.
        // Uses the theme color selected in widget configuration (default is 'contrast') and its variants. Add
        // signals to include more colors and variants in your template.
        this.titleColor.set(getColors(this.runtime.options().color, theme).dim);
      });
    });

    effect(() => {
      // React to widget Options configuration changes.
      const cfg = this.runtime.options();
      untracked(() => {
        const pathCfg = cfg.paths['signalKPath'];
        if (pathCfg.path) {
          this.streams.observe('signalKPath', path => {
            // Update the signal with the latest path value
            // and/or do more data processing as required.
            this.pathValue.set(path.data.value);
          });
          // TODO: Signal K Zones support: Uncomment or delete depending on your widget needs.
          // Zones updates are emitted in signal this.metadata.zones()
          //this.metadata.observe('signalKPath')
        }
      });
    });
  }

  // eslint-disable-next-line @angular-eslint/no-empty-lifecycle-method
  ngAfterViewInit() {
    // TODO: Add additional widget logic here (canvas drawing, animations, etc.) here or remove if not needed.
  }
}
