import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, of, switchMap } from 'rxjs';
import { DashboardService } from './../../core/services/dashboard.service';
import { AppService, ITheme } from '../../core/services/app-service';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ISkPossibleValue } from '../../core/interfaces/signalk-interfaces';
import { getColors } from '../../core/utils/themeColors.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';
import { DataService } from '../../core/services/data.service';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';

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

  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);
  private readonly signalkRequestsService = inject(SignalkRequestsService);

  protected readonly dashboard = inject(DashboardService);
  //TODO: remove
  private readonly data = inject(DataService);
  private readonly app = inject(AppService);

  private readonly skRequest = toSignal(this.signalkRequestsService.subscribeRequest(), { initialValue: null });

  protected readonly cfg = computed(() => this.runtime.options());
  protected readonly displayName = computed(() => this.cfg()?.displayName);
  protected readonly showLabel = computed(() => this.cfg()?.showLabel);
  private readonly controlPath = computed(() => this.getControlPath(this.cfg()));

  protected readonly labelColor = signal<string | undefined>(undefined);
  protected readonly accentColor = signal<string | undefined>(undefined);
  protected readonly accentDim = signal<string | undefined>(undefined);

  protected readonly currentValue = signal<unknown>(null);

    protected readonly sortedOptions = computed<UiOption[]>(() => {
    const opts = this.options();
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

    return mapped;
  });
  protected readonly menuHeight = computed(() => this.sortedOptions().length * this.itemHeight);
  protected readonly hasOptions = computed(() => this.options().length > 0);
  protected readonly selectedValue = computed(() => this.currentValue());

  protected readonly meta = toSignal(
    toObservable(this.controlPath).pipe(
      distinctUntilChanged(),
      switchMap(path => (path ? this.data.getPathMetaObservable(path) : of(null)))
    ),
    { initialValue: null }
  );
  protected readonly options = computed<ISkPossibleValue[]>(() => {
    const meta = this.meta();
    if (!meta?.possibleValues || !Array.isArray(meta.possibleValues)) return [];
    if (meta.type && meta.type !== 'multiple') return [];
    return meta.possibleValues;
  });

  protected readonly menuWidth = 240;
  protected readonly itemHeight = 36;
  protected readonly cornerRadius = 12;

  protected readonly fullRoundedItemPathD = computed(() =>
    this.buildRoundedRectPath(this.menuWidth, this.itemHeight, this.cornerRadius, true, true)
  );
  protected readonly topRoundedItemPathD = computed(() =>
    this.buildRoundedRectPath(this.menuWidth, this.itemHeight, this.cornerRadius, true, false)
  );
  protected readonly bottomRoundedItemPathD = computed(() =>
    this.buildRoundedRectPath(this.menuWidth, this.itemHeight, this.cornerRadius, false, true)
  );

  //TODO: remove and use path selection to prevent choosing a non multiple type path
  protected readonly canInteract = computed(() => {
    const cfg = this.cfg();
    const path = this.getControlPath(cfg);
    return Boolean(path && this.hasOptions());
  });

  constructor() {
    effect(() => {
      const theme = this.theme();
      const cfg = this.cfg();
      if (!theme || !cfg) return;
      untracked(() => {
        const colors = getColors(cfg.color ?? 'contrast', theme);
        if (!colors) return;
        this.labelColor.set(colors.dim);
        this.accentColor.set(colors.color);
        this.accentDim.set(colors.dim);
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
    if (!this.canInteract()) return;
    const path = this.getControlPath(this.cfg());
    if (!path) return;
    this.signalkRequestsService.putRequest(path, option.value, this.id());
  }

  protected selectUi(option: UiOption): void {
    this.select(option.raw);
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
