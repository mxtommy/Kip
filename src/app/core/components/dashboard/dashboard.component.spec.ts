import type { Mock } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    let mockDashboardService: DashboardService;
    let gridMock: {
        grid: {
            save: Mock;
            offAll: Mock;
            destroy: Mock;
            load: Mock;
            batchUpdate: Mock;
            addWidget: Mock;
            willItFit: Mock;
            isAreaEmpty: Mock;
            getGridItems: Mock;
            getRow: Mock;
            cellHeight: Mock;
            setStatic: Mock;
            on: Mock;
            removeWidget: Mock;
            getCellFromPixel: Mock;
        };
    };

    beforeEach(async () => {
        mockDashboardService = {
            updateConfiguration: vi.fn().mockName("DashboardService.updateConfiguration"),
            setStaticDashboard: vi.fn().mockName("DashboardService.setStaticDashboard"),
            notifyLayoutEditSaved: vi.fn().mockName("DashboardService.notifyLayoutEditSaved"),
            notifyLayoutEditCanceled: vi.fn().mockName("DashboardService.notifyLayoutEditCanceled"),
            navigateToNextDashboard: vi.fn().mockName("DashboardService.navigateToNextDashboard"),
            navigateToPreviousDashboard: vi.fn().mockName("DashboardService.navigateToPreviousDashboard"),
            setWidgetClipboardFromNode: vi.fn().mockName("DashboardService.setWidgetClipboardFromNode"),
            clearWidgetClipboard: vi.fn().mockName("DashboardService.clearWidgetClipboard"),
            isDashboardStatic: signal(true),
            activeDashboard: signal(0),
            dashboards: signal([{ id: 'd-0', configuration: [] }]),
            widgetClipboard: signal(null),
            widgetAction$: new Subject()
        } as unknown as DashboardService;

        const mockToastService = {
            show: vi.fn().mockName("ToastService.show")
        };
        const mockPluginConfigService = {
            getPlugin: vi.fn().mockName("PluginConfigClientService.getPlugin"),
            setPluginEnabled: vi.fn().mockName("PluginConfigClientService.setPluginEnabled")
        };
        const mockDatasetLifecycleService = {
            removeOwnedDatasets: vi.fn().mockName("WidgetDatasetOrchestratorService.removeOwnedDatasets")
        };
        const mockDialogService = {
            openFrameDialog: vi.fn().mockName("DialogService.openFrameDialog")
        };
        mockDialogService.openFrameDialog.mockReturnValue(of(null));
        const mockUiEventService = {
            addHotkeyListener: vi.fn().mockName("uiEventService.addHotkeyListener"),
            removeHotkeyListener: vi.fn().mockName("uiEventService.removeHotkeyListener"),
            isDragging: signal(false)
        };

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
        vi.spyOn(component, 'ngOnDestroy').mockImplementation(() => undefined);

        gridMock = {
            grid: {
                save: vi.fn().mockReturnValue([]),
                offAll: vi.fn(),
                destroy: vi.fn(),
                load: vi.fn(),
                batchUpdate: vi.fn(),
                addWidget: vi.fn().mockReturnValue({ gridstackNode: { subGrid: null, subGridOpts: {} } }),
                willItFit: vi.fn().mockReturnValue(true),
                isAreaEmpty: vi.fn().mockReturnValue(true),
                getGridItems: vi.fn().mockReturnValue([]),
                getRow: vi.fn().mockReturnValue(24),
                cellHeight: vi.fn(),
                setStatic: vi.fn(),
                on: vi.fn(),
                removeWidget: vi.fn(),
                getCellFromPixel: vi.fn().mockReturnValue({ x: 1, y: 1 })
            }
        };

        vi.spyOn(privateApi, '_gridstack').mockReturnValue(gridMock);
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

        (component as unknown as {
            addWidgetToGrid: (w: unknown, x: number, y: number) => void;
        }).addWidgetToGrid(widget, 1, 1);

        const addedWidget = vi.mocked(gridMock.grid.addWidget).mock.lastCall[0];
        expect(addedWidget.input.widgetProperties.autoOpenOptionsOnCreate).toBe(true);
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

        (component as unknown as {
            addWidgetToGrid: (w: unknown, x: number, y: number) => void;
        }).addWidgetToGrid(widget, 1, 1);

        const addedWidget = vi.mocked(gridMock.grid.addWidget).mock.lastCall[0];
        expect(addedWidget.input.widgetProperties.autoOpenOptionsOnCreate).toBe(true);
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

        (component as unknown as {
            duplicateWidget: (node: unknown) => void;
        }).duplicateWidget(item);

        const duplicatedWidget = vi.mocked(gridMock.grid.addWidget).mock.lastCall[0];
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

        (component as unknown as {
            pasteCopiedWidget: (x?: number, y?: number) => void;
        }).pasteCopiedWidget(1, 1);

        const pastedWidget = vi.mocked(gridMock.grid.addWidget).mock.lastCall[0];
        expect(pastedWidget.input.widgetProperties.autoOpenOptionsOnCreate).toBeUndefined();
    });

    it('should not add a widget when add-widget dialog is canceled', () => {
        vi.spyOn(component as unknown as {
            addWidgetToGrid: () => void;
        }, 'addWidgetToGrid');

        (component as unknown as {
            openAddWidgetDialog: (x: number, y: number) => void;
        }).openAddWidgetDialog(1, 1);

        expect((component as unknown as {
            addWidgetToGrid: Mock;
        }).addWidgetToGrid).not.toHaveBeenCalled();
    });

    it('should copy widget without creating a new grid item', () => {
        const actionStream = mockDashboardService.widgetAction$ as Subject<{
            id: string;
            operation: string;
        }>;
        const existingNode = { id: 'widget-copy-id' };
        gridMock.grid.getGridItems.mockReturnValue([
            { gridstackNode: existingNode }
        ]);

        component.ngAfterViewInit();
        actionStream.next({ id: 'widget-copy-id', operation: 'copy' });

        expect(mockDashboardService.setWidgetClipboardFromNode).toHaveBeenCalledWith(existingNode);
        expect(gridMock.grid.addWidget).not.toHaveBeenCalled();
    });

    it('should render empty dashboard static state with customize action and help action', () => {
        mockDashboardService.isDashboardStatic.set(true);
        gridMock.grid.getGridItems.mockReturnValue([]);

        fixture.detectChanges();

        const root = fixture.nativeElement as HTMLElement;
        const emptyState = root.querySelector('.dashboard-empty-state-container');
        const customizeButton = root.querySelector('.empty-state-button');
        const helpButton = root.querySelector('.empty-state-help-button');

        expect(emptyState).toBeTruthy();
        expect(customizeButton?.textContent).toContain('Unlock and Customize');
        expect(helpButton?.textContent).toContain('Get Help');
    });

    it('should render empty dashboard edit state long-press guidance and hide customize button', () => {
        mockDashboardService.isDashboardStatic.set(false);
        gridMock.grid.getGridItems.mockReturnValue([]);

        fixture.detectChanges();

        const root = fixture.nativeElement as HTMLElement;
        const guidance = root.textContent ?? '';
        const customizeButton = root.querySelector('.empty-state-button');

        expect(guidance).toContain('Long press/click and hold anywhere');
        expect(customizeButton).toBeFalsy();
    });

    it('should navigate dashboards on empty-state swipe gestures in static mode', () => {
        mockDashboardService.isDashboardStatic.set(true);
        gridMock.grid.getGridItems.mockReturnValue([]);

        fixture.detectChanges();

        const overlay = fixture.nativeElement.querySelector('.dashboard-empty-state-container') as HTMLElement;
        overlay.dispatchEvent(new CustomEvent('swipeup', { bubbles: true }));
        overlay.dispatchEvent(new CustomEvent('swipedown', { bubbles: true }));

        expect(mockDashboardService.navigateToPreviousDashboard).toHaveBeenCalled();
        expect(mockDashboardService.navigateToNextDashboard).toHaveBeenCalled();
    });

    it('should open add widget flow on empty-state press in edit mode', () => {
        mockDashboardService.isDashboardStatic.set(false);
        gridMock.grid.getGridItems.mockReturnValue([]);

        const openAddWidgetDialogSpy = vi.spyOn(component as unknown as {
            openAddWidgetDialog: (x: number, y: number) => void;
        }, 'openAddWidgetDialog').mockImplementation(() => undefined);

        fixture.detectChanges();

        const overlay = fixture.nativeElement.querySelector('.dashboard-empty-state-container') as HTMLElement;
        overlay.dispatchEvent(new CustomEvent('press', { detail: { x: 120, y: 240 }, bubbles: true }));

        expect(openAddWidgetDialogSpy).toHaveBeenCalledWith(1, 1);
    });

    it('should ignore empty-state press in static mode', () => {
        mockDashboardService.isDashboardStatic.set(true);
        gridMock.grid.getGridItems.mockReturnValue([]);

        const openAddWidgetDialogSpy = vi.spyOn(component as unknown as {
            openAddWidgetDialog: (x: number, y: number) => void;
        }, 'openAddWidgetDialog').mockImplementation(() => undefined);

        fixture.detectChanges();

        const overlay = fixture.nativeElement.querySelector('.dashboard-empty-state-container') as HTMLElement;
        overlay.dispatchEvent(new CustomEvent('press', { detail: { x: 12, y: 24 }, bubbles: true }));

        expect(openAddWidgetDialogSpy).not.toHaveBeenCalled();
    });
});
