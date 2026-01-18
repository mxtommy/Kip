import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, of, switchMap } from 'rxjs';
import { AppService, ITheme } from '../../core/services/app-service';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ISkPossibleValue } from '../../core/interfaces/signalk-interfaces';
import { getColors } from '../../core/utils/themeColors.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';
import { DataService } from '../../core/services/data.service';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';

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

  //TODO: remove
  private readonly dataService = inject(DataService);
  private readonly appService = inject(AppService);

  protected readonly cfg = computed(() => this.runtime.options());
  protected readonly displayName = computed(() => this.cfg()?.displayName);
  protected readonly showLabel = computed(() => this.cfg()?.showLabel);
  private readonly controlPath = computed(() => this.getControlPath(this.cfg()));

  protected readonly labelColor = signal<string | undefined>(undefined);
  protected readonly accentColor = signal<string | undefined>(undefined);
  protected readonly accentDim = signal<string | undefined>(undefined);

  protected readonly currentValue = signal<unknown>(null);

  protected readonly meta = toSignal(
    toObservable(this.controlPath).pipe(
      distinctUntilChanged(),
      switchMap(path => (path ? this.dataService.getPathMetaObservable(path) : of(null)))
    ),
    { initialValue: null }
  );
  protected readonly options = computed<ISkPossibleValue[]>(() => {
    const meta = this.meta();
    if (!meta?.possibleValues || !Array.isArray(meta.possibleValues)) return [];
    if (meta.type && meta.type !== 'multiple') return [];
    return meta.possibleValues;
  });

  protected readonly hasOptions = computed(() => this.options().length > 0);
  protected readonly selectedValue = computed(() => this.currentValue());

  //TODO: remove and use path selection to prevent choosing a non multiple type path
  protected readonly canInteract = computed(() => {
    const cfg = this.cfg();
    const path = this.getControlPath(cfg);
    return Boolean(path && cfg?.putEnable !== false && this.hasOptions());
  });

  private readonly skRequest = toSignal(this.signalkRequestsService.subscribeRequest(), { initialValue: null });

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
        this.appService.sendSnackbarNotification(errMsg, 0);
      }
    });
  }

  protected select(option: ISkPossibleValue): void {
    if (!this.canInteract()) return;
    const path = this.getControlPath(this.cfg());
    if (!path) return;
    this.signalkRequestsService.putRequest(path, option.value, this.id());
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


}
