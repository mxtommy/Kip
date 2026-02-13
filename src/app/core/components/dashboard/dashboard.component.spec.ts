import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { DashboardComponent } from './dashboard.component';
import { DashboardService } from '../../services/dashboard.service';
import { ToastService } from '../../services/toast.service';
import { SignalkPluginConfigService } from '../../services/signalk-plugin-config.service';
import { DatasetService } from '../../services/data-set.service';
import { DialogService } from '../../services/dialog.service';
import { uiEventService } from '../../services/uiEvent.service';

interface DashboardComponentPrivateApi {
  saveDashboard: () => void;
  nextDashboard: () => void;
  previousDashboard: () => void;
  _gridstack: () => {
    grid: {
      save: (saveContent: boolean, saveGridOpt: boolean) => unknown;
      offAll: () => void;
      destroy: () => void;
    };
  };
}

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let privateApi: DashboardComponentPrivateApi;
  let mockDashboardService: jasmine.SpyObj<DashboardService>;

  beforeEach(async () => {
    mockDashboardService = jasmine.createSpyObj('DashboardService', [
      'updateConfiguration',
      'setStaticDashboard',
      'notifyLayoutEditSaved',
      'notifyLayoutEditCanceled',
      'navigateToNextDashboard',
      'navigateToPreviousDashboard',
      'setWidgetClipboardFromNode',
      'clearWidgetClipboard'
    ], {
      isDashboardStatic: signal(true),
      activeDashboard: signal(0),
      dashboards: signal([{ configuration: [] }]),
      widgetClipboard: signal(null),
      widgetAction$: new Subject()
    });

    const mockToastService = jasmine.createSpyObj('ToastService', ['show']);
    const mockPluginConfigService = jasmine.createSpyObj('SignalkPluginConfigService', ['getPlugin', 'setPluginEnabled']);
    const mockDatasetService = jasmine.createSpyObj('DatasetService', ['list', 'remove']);
    const mockDialogService = jasmine.createSpyObj('DialogService', ['openFrameDialog']);
    const mockUiEventService = jasmine.createSpyObj('uiEventService', ['addHotkeyListener', 'removeHotkeyListener'], {
      isDragging: signal(false)
    });

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: DashboardService, useValue: mockDashboardService },
        { provide: ToastService, useValue: mockToastService },
        { provide: SignalkPluginConfigService, useValue: mockPluginConfigService },
        { provide: DatasetService, useValue: mockDatasetService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: uiEventService, useValue: mockUiEventService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    privateApi = component as unknown as DashboardComponentPrivateApi;
    spyOn(component, 'ngOnDestroy').and.callFake(() => undefined);

    const gridMock = {
      grid: {
        save: jasmine.createSpy('save').and.returnValue([]),
        offAll: jasmine.createSpy('offAll'),
        destroy: jasmine.createSpy('destroy')
      }
    };

    spyOn(privateApi, '_gridstack').and.returnValue(gridMock);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should save dashboard configuration', () => {
    privateApi.saveDashboard();

    expect(privateApi._gridstack().grid.save).toHaveBeenCalledWith(false, false);
    expect(mockDashboardService.updateConfiguration).toHaveBeenCalledWith(0, []);
  });

  it('should navigate to next dashboard when static', () => {
    mockDashboardService.isDashboardStatic.set(true);

    privateApi.nextDashboard();

    expect(mockDashboardService.navigateToNextDashboard).toHaveBeenCalled();
  });

  it('should navigate to previous dashboard when static', () => {
    mockDashboardService.isDashboardStatic.set(true);

    privateApi.previousDashboard();

    expect(mockDashboardService.navigateToPreviousDashboard).toHaveBeenCalled();
  });

  it('should not navigate when dashboard is not static', () => {
    mockDashboardService.isDashboardStatic.set(false);

    privateApi.nextDashboard();

    expect(mockDashboardService.navigateToNextDashboard).not.toHaveBeenCalled();
  });
});
