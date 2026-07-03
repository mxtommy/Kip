import { Component, effect, signal, input, inject, untracked, computed, ChangeDetectionStrategy } from '@angular/core';
import type { IWidgetPath, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { GaugeSteelComponent } from '../gauge-steel/gauge-steel.component';
import { ISkZone } from '../../core/interfaces/signalk-interfaces';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { WidgetMetadataDirective } from '../../core/directives/widget-metadata.directive';
import { ITheme } from '../../core/services/app-service';

@Component({
  selector: 'widget-gauge-steel',
  templateUrl: './widget-gauge-steel.component.html',
  styleUrls: ['./widget-gauge-steel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GaugeSteelComponent],
})
export class WidgetSteelGaugeComponent {
  // Functional Host2 inputs
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme>();

  // Inject host directives
  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);
  private readonly metadata = inject(WidgetMetadataDirective);

  // Static default config (parity with legacy defaultConfig)
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    supportAutomaticHistoricalSeries: true,
    displayName: 'Gauge Label',
    filterSelfPaths: true,
    paths: {
      gaugePath: {
        description: 'Numeric Data',
        path: null,
        source: null,
        pathType: 'number',
        isPathConfigurable: true,
        showPathSkUnitsFilter: true,
        pathSkUnitsFilter: null,
        convertUnitTo: 'unitless',
        sampleTime: 500
      }
    },
    displayScale: { type: 'linear', lower: 0, upper: 100 },
    gauge: {
      type: 'steel',
      subType: 'radial',
      backgroundColor: 'carbon',
      faceColor: 'anthracite',
      radialSize: 'full',
      rotateFace: false,
      digitalMeter: false
    },
    numDecimal: 2,
    enableTimeout: false,
    dataTimeout: 5,
    ignoreZones: false
  };

  // Reactive state
  protected readonly dataValue = signal<number>(0);
  protected readonly zones = signal<ISkZone[]>([]);
  private readonly normalizedConfig = computed<IWidgetSvcConfig>(() => this.runtime.options() ?? WidgetSteelGaugeComponent.DEFAULT_CONFIG);
  private readonly gaugePathConfig = computed<IWidgetPath | undefined>(() => {
    const paths = this.normalizedConfig().paths as Record<string, IWidgetPath> | undefined;
    return paths?.gaugePath;
  });
  protected readonly displayName = computed(() => this.normalizedConfig().displayName || 'Gauge Label');
  protected readonly gaugeUnits = computed(() => this.gaugePathConfig()?.convertUnitTo ?? '');

  constructor() {
    // Data path effect
    effect(() => {
      const cfg = this.normalizedConfig();
      const pathCfg = this.gaugePathConfig();
      if (!pathCfg?.path) return;
      untracked(() => this.streams.observe('gaugePath', pkt => {
        const raw = pkt?.data?.value as number | undefined;
        const lower = cfg.displayScale?.lower ?? 0;
        const upper = cfg.displayScale?.upper ?? lower + 100;
        if (raw == null) {
          this.dataValue.set(lower);
        } else {
          const clamped = Math.min(Math.max(raw, lower), upper);
          this.dataValue.set(clamped);
        }
      }));
    });

    // Zones observation effect
    effect(() => {
      const cfg = this.normalizedConfig();
      if (cfg.ignoreZones) {
        this.zones.set([]);
        return;
      }
      const pathCfg = this.gaugePathConfig();
      if (!pathCfg?.path) {
        this.zones.set([]);
        return;
      }
      // Establish metadata subscription (idempotent internally)
      untracked(() => this.metadata.observe('gaugePath'));
      // Mirror metadata directive zones
      this.zones.set(this.metadata.zones());
    });
  }
}
