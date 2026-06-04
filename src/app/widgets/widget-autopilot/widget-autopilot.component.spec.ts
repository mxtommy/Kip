import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { EMPTY, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WidgetAutopilotComponent } from './widget-autopilot.component';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { UnitsService } from '../../core/services/units.service';
import { DataService } from '../../core/services/data.service';

describe('WidgetAutopilotComponent', () => {
  let component: WidgetAutopilotComponent;

  const runtimeOptions = {
    autopilot: {
      apiVersion: 'v2' as 'v1' | 'v2',
      instanceId: 'test-autopilot',
      pluginId: 'autopilot',
      modes: ['auto', 'wind', 'route'],
      invertRudder: true,
      headingDirectionTrue: false,
      courseDirectionTrue: false
    }
  };

  const runtimeMock = {
    options: () => runtimeOptions
  };

  const streamsMock = {
    observe: vi.fn()
  };

  const requestsMock = {
    subscribeRequest: () => EMPTY,
    putRequest: vi.fn()
  };

  const httpMock = {
    post: vi.fn(() => of({ statusCode: 200 })),
    put: vi.fn(() => of({ statusCode: 200 })),
    delete: vi.fn(() => of({ statusCode: 200 }))
  };

  const dashboardMock = {
    isDashboardStatic: () => true
  };

  const unitsMock = {
    convertToUnit: (_unit: string, value: unknown) => value
  };

  const dataMock = {
    subscribePath: vi.fn(() => EMPTY)
  };

  beforeEach(async () => {
    runtimeOptions.autopilot.apiVersion = 'v2';
    streamsMock.observe.mockClear();

    TestBed.configureTestingModule({
      providers: [
        { provide: WidgetRuntimeDirective, useValue: runtimeMock },
        { provide: WidgetStreamsDirective, useValue: streamsMock },
        { provide: SignalkRequestsService, useValue: requestsMock },
        { provide: HttpClient, useValue: httpMock },
        { provide: DashboardService, useValue: dashboardMock },
        { provide: UnitsService, useValue: unitsMock },
        { provide: DataService, useValue: dataMock }
      ]
    });

    component = TestBed.runInInjectionContext(() => new WidgetAutopilotComponent());
  });

  it('labels the v2 standby toggle as Engage when autopilot is not engaged', () => {
    (component as unknown as { apEngaged: { set: (value: boolean) => void } }).apEngaged.set(false);

    const label = (component as unknown as { standbyButtonLabel: () => string }).standbyButtonLabel();

    expect(label).toBe('Engage');
  });

  it('labels the v2 standby toggle as Disengage when autopilot is engaged', () => {
    (component as unknown as { apEngaged: { set: (value: boolean) => void } }).apEngaged.set(true);

    const label = (component as unknown as { standbyButtonLabel: () => string }).standbyButtonLabel();

    expect(label).toBe('Disengage');
  });

  it('keeps the v1 standby command label as Disengage', () => {
    runtimeOptions.autopilot.apiVersion = 'v1';
    (component as unknown as { apEngaged: { set: (value: boolean) => void } }).apEngaged.set(false);

    const label = (component as unknown as { standbyButtonLabel: () => string }).standbyButtonLabel();

    expect(label).toBe('Disengage');
  });
});
