import { Component, effect, signal, inject, input, untracked, computed } from '@angular/core';
import { SvgSimpleLinearGaugeComponent } from '../svg-simple-linear-gauge/svg-simple-linear-gauge.component';
import { IDataHighlight, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ITheme } from '../../core/services/app-service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { WidgetMetadataDirective } from '../../core/directives/widget-metadata.directive';
import { getColors } from '../../core/utils/themeColors.utils';
import { getHighlights } from '../../core/utils/zones-highlight.utils';
import { UnitsService } from '../../core/services/units.service';
import { States } from '../../core/interfaces/signalk-interfaces';

@Component({
  selector: 'widget-simple-linear',
  templateUrl: './widget-simple-linear.component.html',
  styleUrls: ['./widget-simple-linear.component.scss'],
  imports: [ SvgSimpleLinearGaugeComponent ]
})
export class WidgetSimpleLinearComponent {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme|null>();
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Gauge Label',
    filterSelfPaths: true,
    paths: {
      'gaugePath': {
        description: 'Numeric Data',
        path: null,
        source: null,
        pathType: 'number',
        isPathConfigurable: true,
        showPathSkUnitsFilter: true,
        pathSkUnitsFilter: 'V',
        convertUnitTo: 'V',
        sampleTime: 500
      }
    },
    displayScale: { lower: 0, upper: 15, type: 'linear' },
    gauge: { type: 'simpleLinear', unitLabelFormat: 'full' },
    numInt: 1,
    numDecimal: 2,
    ignoreZones: false,
    color: 'contrast',
    enableTimeout: false,
    dataTimeout: 5
  };

  // Inject directives/services
  protected readonly runtime = inject(WidgetRuntimeDirective); // expose in template if needed later
  private readonly streams = inject(WidgetStreamsDirective);
  private readonly metadata = inject(WidgetMetadataDirective, { optional: true }); // Only used when ignoreZones=false
  private readonly unitsService = inject(UnitsService);

  // Signals (presentation state)
  protected readonly unitsLabel = signal<string>('');
  protected readonly dataLabelValue = signal<string>('0');
  protected readonly dataValue = signal<number>(null);
  protected readonly barColor = signal<string>('');
  protected readonly barColorGradient = signal<string>('');
  protected readonly barColorBackground = signal<string>('');

  // Computed signal for highlights (zones)
  protected highlights = computed<IDataHighlight[]>(() => {
    const zones = this.metadata.zones();
    const cfg = this.runtime.options();
    const theme = this.theme();
    if (!cfg || !theme) return [];
    if (cfg.ignoreZones || !this.metadata) return [];
    if (!zones?.length) return [];

    const unit = cfg.paths['gaugePath'].convertUnitTo;
    const min = cfg.displayScale.lower;
    const max = cfg.displayScale.upper;
    return getHighlights(zones, theme, unit, this.unitsService, min, max);
  });
  private lastState: States | null = null; // simple cache to avoid redundant color sets

  constructor() {
    // Data stream registration
    effect(() => {
      const cfg = this.runtime.options();
      const path = cfg?.paths?.['gaugePath']?.path;
      if (!cfg || !path) return;
      untracked(() => {
        this.streams.observe('gaugePath', pkt => {
          const theme = this.theme();
          if (!cfg || !theme) return;
          const raw = pkt?.data?.value as number | null;
            // Clamp & label formatting
          if (raw == null) {
            this.dataValue.set(cfg.displayScale.lower);
            this.dataLabelValue.set('--');
          } else {
            const clamped = Math.min(Math.max(raw, cfg.displayScale.lower), cfg.displayScale.upper);
            this.dataValue.set(clamped);
            this.dataLabelValue.set(clamped.toFixed(cfg.numDecimal));
          }

          if (!cfg.ignoreZones) {
            const s = pkt?.state as States | undefined;
            if (s && s !== this.lastState) {
              this.lastState = s;
              switch (s) {
                case States.Alarm: this.barColor.set(theme.zoneAlarm); break;
                case States.Warn: this.barColor.set(theme.zoneWarn); break;
                case States.Alert: this.barColor.set(theme.zoneAlert); break;
                case States.Nominal: this.barColor.set(theme.zoneNominal); break;
                default: this.barColor.set(getColors(cfg.color, theme).color); break;
              }
            }
          }
        });

        // Unit label (abr|full)
        const unit = cfg.paths['gaugePath'].convertUnitTo;
        this.unitsLabel.set(cfg.gauge.unitLabelFormat === 'abr' ? unit?.substring(0,1) : unit);
      });
    });

    // Theme + base colors + unit label
    effect(() => {
      const cfg = this.runtime.options();
      const theme = this.theme();
      if (!cfg || !theme) return;
      untracked(() => {
        this.barColorBackground.set(theme.background);
        const palette = getColors(cfg.color, theme);
        // Set baseline colors (may be overridden by zone state effect above)
        if (cfg.ignoreZones) {
          this.barColor.set(palette.color);
        } else if (!this.lastState) { // no state yet
          this.barColor.set(palette.color);
        }
        // Gradient: choose a dimmer role when available; fallback to same color
        this.barColorGradient.set(palette.dimmer || palette.dim || palette.color);
      });
    });

    // Zones metadata observation (only when needed)
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg || cfg.ignoreZones || !this.metadata) return;
      untracked(() => this.metadata.observe('gaugePath'));
    });
  }
}
