import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DashboardService } from './../../core/services/dashboard.service';
import { AppService, ITheme } from '../../core/services/app-service';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ISkPossibleValue } from '../../core/interfaces/signalk-interfaces';
import { getColors } from '../../core/utils/themeColors.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { WidgetMetadataDirective } from '../../core/directives/widget-metadata.directive';
import { createSwipeGuard } from '../../core/utils/pointer-swipe-guard.util';

interface NumComparable {
  kind: 'num';
  value: number;
}

interface StrComparable {
  kind: 'str';
  value: string;
}

type Comparable = NumComparable | StrComparable;

interface UiOption {
  raw: ISkPossibleValue;
  label: string;
  comparable: Comparable;
  index: number;
}

@Component({
  selector: 'widget-multi-state-switch',
  templateUrl: './widget-multi-state-switch.component.html',
  styleUrl: './widget-multi-state-switch.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WidgetTitleComponent]
})
export class WidgetMultiStateSwitchComponent {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Switch Label',
    showLabel: true,
    filterSelfPaths: true,
    paths: {
      controlPath: {
        description: 'Multi-state control path',
        path: null,
        source: null,
        pathType: 'multiple',
        supportsPut: true,
        isPathConfigurable: true,
        pathRequired: true,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: null,
        showConvertUnitTo: false,
        convertUnitTo: null,
        sampleTime: 500
      }
    },
    enableTimeout: false,
    dataTimeout: 5,
    color: 'contrast',
  };

  private readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);
  private readonly meta = inject(WidgetMetadataDirective);

  private readonly signalkRequestsService = inject(SignalkRequestsService);
  protected readonly dashboard = inject(DashboardService);
  private readonly app = inject(AppService);

  private readonly skRequest = toSignal(this.signalkRequestsService.subscribeRequest(), { initialValue: null });

  protected readonly cfg = computed(() => this.runtime.options());
  protected readonly displayName = computed(() => this.cfg()?.displayName);
  protected readonly showLabel = computed(() => this.cfg()?.showLabel);
  private readonly controlPath = computed(() => this.getControlPath(this.cfg()));

  protected readonly accentColor = signal<string | undefined>(undefined);
  protected readonly accentDim = signal<string | undefined>(undefined);
  protected readonly accentDimmer = signal<string | undefined>(undefined);

  protected readonly textColor = signal<string | undefined>(undefined);
  protected readonly textDim = signal<string | undefined>(undefined);
  protected readonly textDimmer = signal<string | undefined>(undefined);

  protected readonly currentValue = signal<unknown>(null);

  protected readonly sortedOptions = computed<UiOption[]>(() => {
    const opts = this.meta.possibleValues();
    if (!opts.length) return [];

    const mapped = opts.map(raw => ({
      raw,
      label: raw.title || raw.abbrev || String(raw.value),
      comparable: this.toComparable(raw.value)
    }));

    mapped.sort((a, b) => {
      const av = a.comparable;
      const bv = b.comparable;
      if (av.kind === 'num' && bv.kind === 'num') return av.value - bv.value;
      if (av.kind === 'str' && bv.kind === 'str') return av.value.localeCompare(bv.value);
      // Prefer numeric ordering when mixed types.
      return av.kind === 'num' ? -1 : 1;
    });

    return mapped.map((opt, index) => ({ ...opt, index }));
  });

  /**
   * Fixed SVG coordinate system (viewBox units).
   *
   * The rendered SVG (CSS `width/height: 100%`) will scale uniformly to the
   * available widget space (see template `preserveAspectRatio`), keeping
   * item/text proportions consistent as the widget resizes.
   */
  protected readonly menuWidth = 220;
  protected readonly itemHeight = 50;
  protected readonly itemGap = 1;
  // Internal padding in SVG viewBox units (proportional to item height).
  protected readonly svgPadding = Math.max(1, Math.round(this.itemHeight * 0.2));
  protected readonly optionsCount = computed(() => this.sortedOptions().length);
  protected readonly menuHeight = computed(() => {
    const count = this.sortedOptions().length;
    if (count <= 0) return 0;
    return count * this.itemHeight + (count - 1) * this.itemGap;
  });
  protected readonly hasOptions = computed(() => this.meta.possibleValues().length > 0);
  protected readonly selectedValue = computed(() => this.currentValue());
  protected readonly canPut = computed(() => this.meta.supportsPut());
  private readonly swipeGuard = createSwipeGuard();

  // Render selected option last so its focus/outline is never covered by later rows in SVG paint order.
  protected readonly unselectedOptions = computed(() => this.sortedOptions().filter(opt => !this.isSelected(opt.raw)));
  protected readonly selectedOptions = computed(() => this.sortedOptions().filter(opt => this.isSelected(opt.raw)));

  protected readonly fullRoundedItemPathD = computed(() =>
    this.buildRoundedRectPath(this.menuWidth, this.itemHeight, this.cornerRadius, true, true)
  );
  protected readonly topRoundedItemPathD = computed(() =>
    this.buildRoundedRectPath(this.menuWidth, this.itemHeight, this.cornerRadius, true, false)
  );
  protected readonly bottomRoundedItemPathD = computed(() =>
    this.buildRoundedRectPath(this.menuWidth, this.itemHeight, this.cornerRadius, false, true)
  );

  protected readonly cornerRadius = 7;

  constructor() {
    effect(() => {
      const theme = this.theme();
      const wdColor = this.cfg().color;
      if (!theme || !wdColor) return;
      untracked(() => {
        //getColors(cfg.color ?? 'contrast', theme);
        this.accentColor.set(getColors(wdColor, theme).color);
        this.accentDim.set(getColors(wdColor, theme).dim);
        this.accentDimmer.set(getColors(wdColor, theme).dimmer);
        if (wdColor === 'contrast') {
          this.textColor.set(theme.background);
          this.textDim.set(theme.contrastDim);
          this.textDimmer.set(theme.contrastDimmer);
        } else {
          this.textColor.set(theme.contrast);
          this.textDim.set(getColors(wdColor, theme).dim);
          this.textDimmer.set(getColors(wdColor, theme).dimmer);
        }
      });
    });

    effect(() => {
      const path = this.controlPath();
      if (!path) {
        this.currentValue.set(null);
        return;
      }

      untracked(() => {
        this.streams.observe('controlPath', pkt => {
          this.currentValue.set(pkt?.data?.value ?? null);
        });
        this.meta.observe('controlPath');
      });
    });

    effect(() => {
      const requestResult = this.skRequest();
      if (!requestResult || requestResult.widgetUUID !== this.id()) return;
      const cfg = this.cfg();
      let errMsg = `Multi-State Switch ${cfg?.displayName || ''}: `;
      if (requestResult.statusCode !== 200) {
        if (requestResult.message) {
          errMsg += requestResult.message;
        } else {
          errMsg += `${requestResult.statusCode} - ${requestResult.statusCodeDescription}`;
        }
        this.app.sendSnackbarNotification(errMsg, 0);
      }
    });
  }

  protected select(option: ISkPossibleValue): void {
    const path = this.getControlPath(this.cfg());
    if (!path) return;
    this.signalkRequestsService.putRequest(path, option.value, this.id());
  }

  protected selectUi(option: UiOption): void {
    this.select(option.raw);
  }

  protected onPointerDown(event: PointerEvent): void {
    if (!this.canPut()) return;
    this.swipeGuard.onPointerDown(event);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.canPut()) return;
    this.swipeGuard.onPointerMove(event);
  }

  protected onPointerUp(event: PointerEvent, option: UiOption): void {
    if (!this.canPut()) return;
    if (!this.swipeGuard.onPointerUp(event)) return;
    this.selectUi(option);
  }

  protected onPointerCancel(event: PointerEvent): void {
    this.swipeGuard.onPointerCancel(event);
  }

  private getControlPath(cfg?: IWidgetSvcConfig): string | null {
    const paths = cfg?.paths;
    if (!paths || Array.isArray(paths)) return null;
    return paths.controlPath?.path ?? null;
  }

  protected isSelected(option: ISkPossibleValue): boolean {
    const current = this.selectedValue();
    if (typeof option.value === 'number' && typeof current === 'string') {
      return option.value === Number(current);
    }
    if (typeof option.value === 'string' && typeof current === 'number') {
      return Number(option.value) === current || option.value === String(current);
    }
    return Object.is(option.value, current);
  }

  private toComparable(value: unknown): Comparable {
    if (typeof value === 'number' && Number.isFinite(value)) return { kind: 'num', value };
    if (typeof value === 'boolean') return { kind: 'num', value: value ? 1 : 0 };

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed)) return { kind: 'num', value: parsed };
      }
      return { kind: 'str', value: trimmed };
    }

    return { kind: 'str', value: String(value) };
  }

  private buildRoundedRectPath(width: number, height: number, radius: number, roundTop: boolean, roundBottom: boolean): string {
    const w = Math.max(0, width);
    const h = Math.max(0, height);
    const r = Math.max(0, Math.min(radius, w / 2, h / 2));

    if (w === 0 || h === 0) return '';
    if (r === 0) return `M0 0H${w}V${h}H0Z`;

    if (roundTop && roundBottom) {
      return [
        `M${r} 0`,
        `H${w - r}`,
        `A${r} ${r} 0 0 1 ${w} ${r}`,
        `V${h - r}`,
        `A${r} ${r} 0 0 1 ${w - r} ${h}`,
        `H${r}`,
        `A${r} ${r} 0 0 1 0 ${h - r}`,
        `V${r}`,
        `A${r} ${r} 0 0 1 ${r} 0`,
        'Z'
      ].join('');
    }

    if (roundTop) {
      return [
        `M0 ${r}`,
        `A${r} ${r} 0 0 1 ${r} 0`,
        `H${w - r}`,
        `A${r} ${r} 0 0 1 ${w} ${r}`,
        `V${h}`,
        `H0`,
        'Z'
      ].join('');
    }

    if (roundBottom) {
      return [
        'M0 0',
        `H${w}`,
        `V${h - r}`,
        `A${r} ${r} 0 0 1 ${w - r} ${h}`,
        `H${r}`,
        `A${r} ${r} 0 0 1 0 ${h - r}`,
        'V0',
        'Z'
      ].join('');
    }

    return `M0 0H${w}V${h}H0Z`;
  }
}
