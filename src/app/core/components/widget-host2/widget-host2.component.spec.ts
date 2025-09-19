import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Component, Type } from '@angular/core';
import { WidgetHost2Component } from './widget-host2.component';
import { IWidget, IWidgetSvcConfig, IWidgetPath } from '../../interfaces/widgets-interface';
import { of, Subject } from 'rxjs';
import { WidgetService } from '../../services/widget.service';

// Dummy numeric presentational component used for testing
@Component({
  selector: 'widget-numeric',
  template: '<div>Numeric Test Widget</div>'
})
class DummyNumericComponent {
  static DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Numeric',
    enableTimeout: false,
    dataTimeout: 5,
    paths: {
      value: {
        description: 'Speed',
        path: 'navigation.speedThroughWater',
        source: null,
        pathType: 'number',
        isPathConfigurable: true,
        sampleTime: 500,
        convertUnitTo: 'knots'
      } as IWidgetPath
    }
  };
  defaultConfig = DummyNumericComponent.DEFAULT_CONFIG;
}

// Minimal stubs for injected services/directives dependencies
class DataServiceStub {
  subscribePath() { return new Subject<{ data: { value: unknown; timestamp?: number }, state?: unknown }>(); }
  getPathMetaObservable() { return new Subject<unknown>(); }
  timeoutPathObservable() { /* noop */ }
}
class UnitsServiceStub { convertToUnit(_u: string, v: number) { return v; } }
class DashboardServiceStub { isDashboardStatic() { return false; } deleteWidget(){} duplicateWidget(){} }
class DialogServiceStub { openWidgetOptions() { return { afterClosed: () => of(undefined) }; } }
class MatBottomSheetStub { open() { return { afterDismissed: () => of(undefined) }; } }
class SignalkPluginsServiceStub { isEnabled() { return Promise.resolve(true); } }

// Custom WidgetService stub providing only the dummy numeric mapping
class WidgetServiceStub extends WidgetService {
  constructor() { super(); }
  override getComponentType(selector: string): Type<unknown> | undefined {
    if (selector === 'widget-numeric') return DummyNumericComponent as unknown as Type<unknown>;
    return undefined;
  }
}

xdescribe('WidgetHost2Component Add/Edit Cycle (SKIPPED)', () => {
  let fixture: ComponentFixture<WidgetHost2Component>;
  let component: WidgetHost2Component;
  let widgetProps: IWidget;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetHost2Component, DummyNumericComponent],
      providers: [
        { provide: WidgetService, useClass: WidgetServiceStub },
        { provide: 'SignalkPluginsService', useClass: SignalkPluginsServiceStub },
        { provide: 'DataService', useClass: DataServiceStub },
        { provide: 'UnitsService', useClass: UnitsServiceStub },
        { provide: 'DashboardService', useClass: DashboardServiceStub },
        { provide: 'DialogService', useClass: DialogServiceStub },
        { provide: 'MatBottomSheet', useClass: MatBottomSheetStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WidgetHost2Component);
    component = fixture.componentInstance;

    widgetProps = {
      uuid: 'w1',
      type: 'widget-numeric',
      config: {
        displayName: 'Speed',
        paths: {
          value: {
            description: 'Speed',
            path: 'navigation.speedThroughWater',
            source: null,
            pathType: 'number',
            isPathConfigurable: true,
            sampleTime: 1000,
            convertUnitTo: 'knots'
          } as IWidgetPath
        }
      }
    } as IWidget;
    (component as unknown as { widgetProperties: IWidget }).widgetProperties = widgetProps;
  });

  it('should merge default + saved config on first creation', () => {
    fixture.detectChanges(); // triggers ngOnInit + ngAfterViewInit
    const cfg = widgetProps.config as IWidgetSvcConfig;
    expect(cfg.displayName).toBe('Speed'); // user override preserved
  const pathCfg = (cfg.paths as Record<string, IWidgetPath>).value;
  expect(pathCfg.path).toBe('navigation.speedThroughWater'); // path exists
    // from default config: enableTimeout default false
    expect(cfg.enableTimeout).toBe(false);
  });

  it('should persist edited config after applyRuntimeConfig and serialize', () => {
    fixture.detectChanges();
    // simulate edit: change sampleTime
  const edited = { ...widgetProps.config, paths: { ...widgetProps.config.paths as Record<string, IWidgetPath>, value: { ...(widgetProps.config.paths as Record<string, IWidgetPath>).value, sampleTime: 250 } } } as IWidgetSvcConfig;
  (component as unknown as { applyRuntimeConfig: (c: IWidgetSvcConfig) => void }).applyRuntimeConfig(edited);
    const serialized = component.serialize();
    const persisted = (serialized.widgetProperties as IWidget).config as IWidgetSvcConfig;
    const persistedPathCfg = (persisted.paths as Record<string, IWidgetPath>).value;
    expect(persistedPathCfg.sampleTime).toBe(250);
  });
});
