import { Component, inject, Type, ViewChild, ViewContainerRef, Input, effect, ComponentRef, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { IWidget, IWidgetSvcConfig } from '../../interfaces/widgets-interface';
import { WidgetStreamsDirective } from '../../directives/widget-streams.directive';
import { WidgetMetadataDirective } from '../../directives/widget-metadata.directive';
import { WidgetRuntimeDirective } from '../../directives/widget-runtime.directive';
import { WidgetService } from '../../services/widget.service';
import { AppService } from '../../services/app-service';

// Base shape expected from view components
interface WidgetViewComponentBase { defaultConfig?: IWidgetSvcConfig }

@Component({
  selector: 'widget-embedded',
  imports: [MatCardModule],
  templateUrl: './widget-embedded.component.html',
  styleUrl: './widget-embedded.component.scss',
  hostDirectives: [
    { directive: WidgetStreamsDirective },
    { directive: WidgetMetadataDirective },
    { directive: WidgetRuntimeDirective }
  ]
})

/**
 * Embedded widget host (lightweight, no dashboard chrome)
 *
 * Responsibilities:
 * 1. Resolve the concrete widget view component from WidgetService (by type).
 * 2. Accept a fully-formed static widgetProperties object (no persistence writes).
 * 3. Initialize WidgetRuntimeDirective with ONLY the provided saved/user config (no default merge unless caller already merged).
 * 4. Apply streams + metadata diff configs before the child component is created so its
 *    observe(...) calls succeed immediately.
 * 5. Create the child component and supply the minimal structural inputs: id, type, theme.
 *
 * REQUIRED INPUT: [widgetProperties] as IWidget
 * The object MUST at least include:
 * {
 *   uuid: string;              // unique stable id for this embedded instance
 *   type: string;              // widget type key (must be registered in WidgetService)
 *   config: IWidgetSvcConfig;  // complete runtime config (already merged if you need defaults)
 * }
 *
 * IMPORTANT:
 * - Options / bottom sheet / drag / resize / gestures features are intentionally not present.
 * - Default configs are NOT auto-fetched; supply the final config you want rendered.
 * - Streams + metadata operate only on paths/zones present in widgetProperties.config.
 *
 * SIMPLE USAGE:
 *
 * Create a properties object in the parent component:
 *   xteWidgetProps: IWidget = {
 *     uuid: this.id() + '-xte',
 *     type: 'widget-numeric',
 *     config: {
 *       type: 'widget-numeric',
 *       title: 'XTE',
 *       // minimal required numeric widget settings
 *       paths: {
 *         numericPath: {
 *           description: 'Cross Track Error',
 *           path: 'navigation.course.crossTrackError',
 *           pathType: 'number',
 *           convertUnitTo: 'nm',
 *           sampleTime: 1000,
 *           isPathConfigurable: false
 *         }
 *       },
 *       numDecimal: 2
 *     }
 *   };
 *
 * In the parent component template use:
 *   <widget-embedded [widgetProperties]="xteWidgetProps"></widget-embedded>
 */
export class WidgetEmbeddedComponent implements OnInit {
  @Input({ required: true }) protected widgetProperties!: IWidget;
  // Mark static:true so the outlet is available during ngOnInit allowing
  // runtime initialization + child creation before the first stability check.
  @ViewChild('childOutlet', { read: ViewContainerRef, static: true }) private outlet!: ViewContainerRef;
  private readonly _streams = inject(WidgetStreamsDirective, { optional: true });
  private readonly _meta = inject(WidgetMetadataDirective, { optional: true });
  private readonly _runtime = inject(WidgetRuntimeDirective, { optional: true });
  private readonly _widgetService = inject(WidgetService);
  private readonly _app = inject(AppService);
  protected theme = toSignal(this._app.cssThemeColorRoles$, { requireSync: true });
  private childRef: ComponentRef<WidgetViewComponentBase>;
  private compType: Type<WidgetViewComponentBase>

  constructor() {
    effect(() => {
      const theme = this.theme();
      if (this.childRef) {
        this.childRef.setInput('theme', theme);
      }
    });
  }

  ngOnInit(): void {
    const type = this.widgetProperties.type;
    if (!type) return;
    this.compType = this._widgetService.getComponentType(type) as Type<WidgetViewComponentBase> | undefined;

    // Initialize runtime
    this._runtime?.initialize?.(undefined, this.widgetProperties.config);
    const merged = this._runtime?.options();
    if (merged) this.widgetProperties.config = merged;
    // Initial diff-based streams wiring (registrations occur when child calls observe)
    this._streams?.applyStreamsConfigDiff?.(merged);
    this._meta?.applyMetaConfigDiff?.(merged);

    // Create the child component BEFORE first change detection completes so its
    if (this.outlet && this.compType) {
      this.childRef = this.outlet.createComponent(this.compType);
      this.childRef.setInput('id', this.widgetProperties.uuid);
      this.childRef.setInput('type', this.widgetProperties.type);
      // Pass current theme value; ongoing updates handled by effect in ctor.
      this.childRef.setInput('theme', this.theme());
    }
  }
}
