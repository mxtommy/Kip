import { Component, effect, inject, input, signal, untracked, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { AppService, ITheme } from '../../core/services/app-service';
import { IWidgetSvcConfig, IDynamicControl, IWidgetPath } from '../../core/interfaces/widgets-interface';
import { SvgBooleanLightComponent } from '../svg-boolean-light/svg-boolean-light.component';
import { SvgBooleanButtonComponent } from '../svg-boolean-button/svg-boolean-button.component';
import { IDimensions, SvgBooleanSwitchComponent } from '../svg-boolean-switch/svg-boolean-switch.component';
import { DashboardService } from '../../core/services/dashboard.service';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';
import { getColors } from '../../core/utils/themeColors.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';

@Component({
  selector: 'widget-boolean-switch',
  templateUrl: './widget-boolean-switch.component.html',
  styleUrls: ['./widget-boolean-switch.component.scss'],
  imports: [NgxResizeObserverModule, SvgBooleanSwitchComponent, SvgBooleanButtonComponent, SvgBooleanLightComponent, WidgetTitleComponent]
})
export class WidgetBooleanSwitchComponent implements OnDestroy {
  // Host2 functional inputs (provided by widget-host2 wrapper)
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  // Static default config consumed by runtime merge
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Switch Panel Label',
    filterSelfPaths: true,
    // Each control uses a matching path entry by pathID. For Host2 we preserve existing shape.
    paths: [],
    enableTimeout: false,
    dataTimeout: 5,
    color: 'contrast',
    putEnable: true,
    putMomentary: false,
    multiChildCtrls: []
  };

  // Exposed for template access (displayName)
  protected readonly runtime = inject(WidgetRuntimeDirective, { optional: true });
  private readonly streams = inject(WidgetStreamsDirective, { optional: true });

  // Services / directives
  protected dashboard = inject(DashboardService);
  private readonly signalkRequestsService = inject(SignalkRequestsService);
  private readonly appService = inject(AppService);

  // Reactive state
  public switchControls = signal<IDynamicControl[]>([]);
  protected labelColor = signal<string | undefined>(undefined);
  private nbCtrl: number | null = null;
  public ctrlDimensions: IDimensions = { width: 0, height: 0 };
  private skRequestSub = new Subscription();

  constructor() {
    // Effect: theme / label color
    effect(() => {
      const theme = this.theme();
      const cfg = this.runtime?.options();
      if (!theme || !cfg) return;
      untracked(() => {
        this.labelColor.set(getColors(cfg.color, theme).dim);
      });
    });

    // Effect: rebuild controls & register streams when config changes
    effect(() => {
      const cfg = this.runtime?.options();
      if (!cfg) return;
      const controls = (cfg.multiChildCtrls || []).map(c => ({ ...c, isNumeric: c.isNumeric ?? false }));
      this.nbCtrl = controls.length;
      untracked(() => {
        this.switchControls.set(controls);
        // Register path observers for each control (idempotent via directive)
        if (!this.streams) return;
        controls.forEach(ctrl => {
          const pathEntry = (cfg.paths as IWidgetPath[] | undefined)?.find(p => p.pathID === ctrl.pathID);
          if (!pathEntry?.path) return; // guard empty path
          this.streams.observe(pathEntry.pathID, pkt => {
            // packet shape: pkt.data.value
            const val = pkt?.data?.value;
            if (ctrl.isNumeric) {
              if ([0, 1, null].includes(val)) {
                ctrl.value = Boolean(val);
              }
            } else {
              ctrl.value = val;
            }
          });
        });
      });
      // subscribe PUT responses (re-init on config change to ensure uuid matches)
      this.subscribeSKRequest();
    });
  }

  onResized(event: ResizeObserverEntry): void {
    const nb = this.nbCtrl || 1;
    const calcH: number = event.contentRect.height / nb;
    const ctrlHeightProportion = (35 * event.contentRect.width / 180);
    const h: number = (ctrlHeightProportion < calcH) ? ctrlHeightProportion : calcH;
    this.ctrlDimensions = { width: event.contentRect.width, height: h };
  }

  private subscribeSKRequest(): void {
    this.skRequestSub?.unsubscribe();
    this.skRequestSub = this.signalkRequestsService.subscribeRequest().subscribe(requestResult => {
      // Match widget ID
      if (requestResult.widgetUUID == this.id()) {
        const cfg = this.runtime?.options();
        let errMsg = `Toggle Widget ${cfg?.displayName || 'Switch Panel'}: `;
        if (requestResult.statusCode != 200) {
          if (requestResult.message) {
            errMsg += requestResult.message;
          } else {
            errMsg += requestResult.statusCode + ' - ' + requestResult.statusCodeDescription;
          }
          this.appService.sendSnackbarNotification(errMsg, 0);
        }
      }
    });
  }

  public toggle(ctrl: IDynamicControl): void {
    const cfg = this.runtime?.options();
    if (!cfg?.putEnable) return;
    const paths = cfg.paths as IWidgetPath[] | undefined;
    if (!paths) return;
    const i = paths.findIndex(p => p.pathID === ctrl.pathID);
    if (i < 0) return;
    const targetPath = paths[i].path;
    if (!targetPath) return;
    if (ctrl.isNumeric) {
      this.signalkRequestsService.putRequest(targetPath, ctrl.value ? 1 : 0, this.id());
    } else {
      this.signalkRequestsService.putRequest(targetPath, ctrl.value, this.id());
    }
  }

  ngOnDestroy(): void {
    this.skRequestSub?.unsubscribe();
  }
}
