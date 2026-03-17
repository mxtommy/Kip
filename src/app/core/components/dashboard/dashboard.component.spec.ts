import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { DashboardComponent } from './dashboard.component';
import { DashboardService } from '../../services/dashboard.service';
import { ToastService } from '../../services/toast.service';
import { PluginConfigClientService } from '../../services/plugin-config-client.service';
import { WidgetDatasetOrchestratorService } from '../../services/widget-dataset-orchestrator.service';
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
  let gridMock: {
    grid: {
      save: jasmine.Spy;
      offAll: jasmine.Spy;
      destroy: jasmine.Spy;
      addWidget: jasmine.Spy;
      willItFit: jasmine.Spy;
      isAreaEmpty: jasmine.Spy;
      getGridItems: jasmine.Spy;
      setStatic: jasmine.Spy;
      on: jasmine.Spy;
      removeWidget: jasmine.Spy;
      getCellFromPixel: jasmine.Spy;
    };
  };

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
    const mockPluginConfigService = jasmine.createSpyObj('PluginConfigClientService', ['getPlugin', 'setPluginEnabled']);
    const mockDatasetLifecycleService = jasmine.createSpyObj('WidgetDatasetOrchestratorService', ['removeOwnedDatasets']);
    const mockDialogService = jasmine.createSpyObj('DialogService', ['openFrameDialog']);
    mockDialogService.openFrameDialog.and.returnValue(of(null));
    const mockUiEventService = jasmine.createSpyObj('uiEventService', ['addHotkeyListener', 'removeHotkeyListener'], {
      isDragging: signal(false)
    });

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: DashboardService, useValue: mockDashboardService },
        { provide: ToastService, useValue: mockToastService },
        { provide: PluginConfigClientService, useValue: mockPluginConfigService },
        { provide: WidgetDatasetOrchestratorService, useValue: mockDatasetLifecycleService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: uiEventService, useValue: mockUiEventService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    privateApi = component as unknown as DashboardComponentPrivateApi;
    spyOn(component, 'ngOnDestroy').and.callFake(() => undefined);

    gridMock = {
      grid: {
        save: jasmine.createSpy('save').and.returnValue([]),
        offAll: jasmine.createSpy('offAll'),
        destroy: jasmine.createSpy('destroy'),
        addWidget: jasmine.createSpy('addWidget').and.returnValue({ gridstackNode: { subGrid: null, subGridOpts: {} } }),
        willItFit: jasmine.createSpy('willItFit').and.returnValue(true),
        isAreaEmpty: jasmine.createSpy('isAreaEmpty').and.returnValue(true),
        getGridItems: jasmine.createSpy('getGridItems').and.returnValue([]),
        setStatic: jasmine.createSpy('setStatic'),
        on: jasmine.createSpy('on'),
        removeWidget: jasmine.createSpy('removeWidget'),
        getCellFromPixel: jasmine.createSpy('getCellFromPixel').and.returnValue({ x: 1, y: 1 })
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

  it('should mark newly added host widget to auto-open options on create', () => {
    const widget = {
      name: 'Numeric',
      selector: 'widget-numeric',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6
    };

    (component as unknown as { addWidgetToGrid: (w: unknown, x: number, y: number) => void }).addWidgetToGrid(widget, 1, 1);

    const addedWidget = gridMock.grid.addWidget.calls.mostRecent().args[0];
    expect(addedWidget.input.widgetProperties.autoOpenOptionsOnCreate).toBeTrue();
  });

  it('should mark newly added group widget to auto-open options on create', () => {
    const widget = {
      name: 'Group Widget',
      selector: 'group-widget',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 3,
      defaultHeight: 4
    };

    (component as unknown as { addWidgetToGrid: (w: unknown, x: number, y: number) => void }).addWidgetToGrid(widget, 1, 1);

    const addedWidget = gridMock.grid.addWidget.calls.mostRecent().args[0];
    expect(addedWidget.input.widgetProperties.autoOpenOptionsOnCreate).toBeTrue();
  });

  it('should not mark duplicated widget for auto-open options', () => {
    const sourceConfig = { displayName: 'Source' };
    const item = {
      gridstackNode: {
        w: 2,
        h: 2,
        selector: 'widget-host2',
        input: {
          widgetProperties: {
            type: 'widget-numeric',
            config: sourceConfig
          }
        }
      }
    };

    (component as unknown as { duplicateWidget: (node: unknown) => void }).duplicateWidget(item);

    const duplicatedWidget = gridMock.grid.addWidget.calls.mostRecent().args[0];
    expect(duplicatedWidget.input.widgetProperties.autoOpenOptionsOnCreate).toBeUndefined();
  });

  it('should not mark pasted widget for auto-open options', () => {
    mockDashboardService.isDashboardStatic.set(false);
    mockDashboardService.widgetClipboard.set({
      w: 2,
      h: 3,
      selector: 'widget-host2',
      input: {
        widgetProperties: {
          type: 'widget-numeric',
          config: { displayName: 'Clipboard' }
        }
      }
    });

    (component as unknown as { pasteCopiedWidget: (x?: number, y?: number) => void }).pasteCopiedWidget(1, 1);

    const pastedWidget = gridMock.grid.addWidget.calls.mostRecent().args[0];
    expect(pastedWidget.input.widgetProperties.autoOpenOptionsOnCreate).toBeUndefined();
  });

  it('should not add a widget when add-widget dialog is canceled', () => {
    spyOn(component as unknown as { addWidgetToGrid: () => void }, 'addWidgetToGrid');

    (component as unknown as { openAddWidgetDialog: (x: number, y: number) => void }).openAddWidgetDialog(1, 1);

    expect((component as unknown as { addWidgetToGrid: jasmine.Spy }).addWidgetToGrid).not.toHaveBeenCalled();
  });

  it('should copy widget without creating a new grid item', () => {
    const actionStream = mockDashboardService.widgetAction$ as Subject<{ id: string; operation: string }>;
    const existingNode = { id: 'widget-copy-id' };
    gridMock.grid.getGridItems.and.returnValue([
      { gridstackNode: existingNode }
    ]);

    component.ngAfterViewInit();
    actionStream.next({ id: 'widget-copy-id', operation: 'copy' });

    expect(mockDashboardService.setWidgetClipboardFromNode).toHaveBeenCalledWith(existingNode);
    expect(gridMock.grid.addWidget).not.toHaveBeenCalled();
  });
});
