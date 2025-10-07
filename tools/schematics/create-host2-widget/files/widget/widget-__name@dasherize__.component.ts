<%# keep ejs tags intact %>
import { AfterViewInit, Component, effect, inject, input, signal, untracked<% if (zonesSupport) { %>, computed<% } %> } from '@angular/core';
import { IWidgetSvcConfig<% if (zonesSupport) { %>, IDataHighlight<% } %> } from '../../core/interfaces/widgets-interface';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';<% if (zonesSupport) { %>
import { WidgetMetadataDirective } from '../../core/directives/widget-metadata.directive';
import { getHighlights } from '../../core/utils/zones-highlight.utils';
import { UnitsService } from '../../core/services/units.service';<% } %>
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
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = { <%= todoBlock ? "// TODO: Update default configuration values as required. See IWidgetSvcConfig interface for all options." : "" %>
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
    dataTimeout: 5<% if (zonesSupport) { %>,
    ignoreZones: false<%= todoBlock ? " // TODO: Signal K Zones support: delete if disabling zones should not be a widget Option users can configure." : "" %><% } %>
  };

  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);<% if (zonesSupport) { %>
  private readonly metadata = inject(WidgetMetadataDirective);
  private readonly unitsService = inject(UnitsService);<% } %>

  protected titleColor = signal<string | undefined>(undefined);
  protected pathValue = signal<number | null>(null);<% if (zonesSupport) { %>

  protected highlights = computed<IDataHighlight[]>(() => {<%= todoBlock ? " // TODO: Signal K Zones support: Sample computed signal for zones highlights. Adjust depending on your widget needs." : "" %>
    const zones = this.metadata.zones();
    const cfg = this.runtime.options();
    const theme = this.theme();

    if (cfg?.ignoreZones || !zones?.length || !theme) return [];
    const unit = cfg.paths['gaugePath'].convertUnitTo;
    const min = cfg.displayScale.lower;
    const max = cfg.displayScale.upper;
    return getHighlights(zones, theme, unit, this.unitsService, min, max);
  });<% } %>

  constructor() {
    effect(() => {
      const theme = this.theme();
      const cfg = this.runtime.options();
      if (!theme || !cfg) return;

      untracked(() => {
        this.titleColor.set(getColors(this.runtime.options().color, theme).dim);<%= todoBlock ? " // TODO: Themes are either, Dark, Light or Red Night mode. Add signals to include more colors and variants in your template." : "" %>
      });
    });

    effect(() => {<%= todoBlock ? " // React to widget Options configuration changes." : "" %>
      const cfg = this.runtime.options();
      untracked(() => {
        const pathCfg = cfg.paths['signalKPath'];
        if (pathCfg.path) {
          this.streams.observe('signalKPath', path => {<%= todoBlock ? " // TODO: Update the signal with the latest path value and/or do more data processing as required." : "" %>
            this.pathValue.set(path.data.value);
          });<% if (zonesSupport) { %>
          this.metadata.observe('signalKPath');<% } %>
        }
      });
    });
  }

  // eslint-disable-next-line @angular-eslint/no-empty-lifecycle-method
  ngAfterViewInit() {<%= todoBlock ? " // TODO: Add additional widget logic here (canvas drawing, animations, etc.) here or remove if not needed." : "" %>
  }
}
