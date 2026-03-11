import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { WidgetHost2Component } from './widget-host2.component';
import { DialogService } from '../../services/dialog.service';
import { DashboardService } from '../../services/dashboard.service';
import { WidgetService } from '../../services/widget.service';
import { AppService } from '../../services/app-service';
import { DashboardHistorySeriesSyncService } from '../../services/dashboard-history-series-sync.service';
import { uiEventService } from '../../services/uiEvent.service';
import { SettingsService } from '../../services/settings.service';
import { UnitsService } from '../../services/units.service';
import { KipSeriesApiClientService } from '../../services/kip-series-api-client.service';
import { IWidget } from '../../interfaces/widgets-interface';

class DashboardServiceStub {
	public readonly isDashboardStatic = signal<boolean>(true);
	public readonly layoutEditCanceled = signal<number>(0);
	public readonly dashboards = signal([]);
	public readonly activeDashboard = signal(0);
	public deleteWidget = jasmine.createSpy('deleteWidget');
	public duplicateWidget = jasmine.createSpy('duplicateWidget');
	public copyWidget = jasmine.createSpy('copyWidget');
	public cutWidget = jasmine.createSpy('cutWidget');
}

describe('WidgetHost2Component', () => {
	let fixture: ComponentFixture<WidgetHost2Component>;
	let component: WidgetHost2Component;
	let dashboard: DashboardServiceStub;
	let dialogServiceMock: { openWidgetOptions: jasmine.Spy; openWidgetHistoryDialog: jasmine.Spy };
	let historySyncMock: { resolveSeriesForWidget: jasmine.Spy };
	let kipSeriesMock: { getSeriesDefinitions: jasmine.Spy };
	let bottomSheetMock: { open: jasmine.Spy };
	let testWidget: IWidget;

	beforeEach(async () => {
		dashboard = new DashboardServiceStub();
		dialogServiceMock = {
			openWidgetOptions: jasmine.createSpy('openWidgetOptions').and.returnValue({ afterClosed: () => of(null) }),
			openWidgetHistoryDialog: jasmine.createSpy('openWidgetHistoryDialog').and.returnValue({ afterClosed: () => of(null) })
		};
		historySyncMock = {
			resolveSeriesForWidget: jasmine.createSpy('resolveSeriesForWidget').and.returnValue([
				{
					seriesId: 'widget-1:auto:navigation-speedthroughwater:default',
					datasetUuid: 'widget-1:navigation-speedthroughwater:default',
					ownerWidgetUuid: 'widget-1',
					ownerWidgetSelector: 'widget-numeric',
					path: 'navigation.speedThroughWater',
					source: 'default',
					timeScale: 'minute',
					period: 10,
					sampleTime: 1000,
					enabled: true
				}
			])
		};
		kipSeriesMock = {
			getSeriesDefinitions: jasmine.createSpy('getSeriesDefinitions').and.resolveTo([])
		};

		await TestBed.configureTestingModule({
			imports: [WidgetHost2Component],
			providers: [
				{ provide: DashboardService, useValue: dashboard },
				{ provide: DialogService, useValue: dialogServiceMock },
				{
					provide: SettingsService,
					useValue: {
						getWidgetHistoryDisabled: () => false
					}
				},
				{
					provide: UnitsService,
					useValue: {
						convertToUnit: (_unit: string, value: number) => value
					}
				},
				{
					provide: MatBottomSheet,
					useValue: (bottomSheetMock = {
						open: jasmine.createSpy('open').and.returnValue({ afterDismissed: () => of(null) })
					})
				},
				{
					provide: WidgetService,
					useValue: {
						getComponentType: jasmine.createSpy('getComponentType').and.returnValue(undefined)
					}
				},
				{
					provide: AppService,
					useValue: {
						cssThemeColorRoles$: of({})
					}
				},
				{
					provide: uiEventService,
					useValue: {
						isDragging: signal(false)
					}
				},
				{ provide: DashboardHistorySeriesSyncService, useValue: historySyncMock },
				{ provide: KipSeriesApiClientService, useValue: kipSeriesMock }
			]
		}).compileComponents();

		fixture = TestBed.createComponent(WidgetHost2Component);
		component = fixture.componentInstance;
		testWidget = {
			uuid: 'widget-1',
			type: 'widget-numeric',
			config: {
				displayName: 'STW',
				timeScale: 'minute',
				period: 10,
				paths: {
					numericPath: {
						description: 'Speed Through Water',
						path: 'navigation.speedThroughWater',
						source: 'default',
						pathType: 'number',
						isPathConfigurable: true,
						sampleTime: 1000
					}
				}
			}
		} as unknown as IWidget;
		(component as unknown as { widgetProperties: IWidget }).widgetProperties = testWidget;
	});

	it('opens history dialog from context menu when dashboard is locked', async () => {
		dashboard.isDashboardStatic.set(true);
		const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

		component.openWidgetHistoryDialog(event);
		await Promise.resolve();

		expect(historySyncMock.resolveSeriesForWidget).toHaveBeenCalledWith(testWidget);
		expect(dialogServiceMock.openWidgetHistoryDialog).toHaveBeenCalledTimes(1);
		expect(dialogServiceMock.openWidgetHistoryDialog).toHaveBeenCalledWith(
			jasmine.objectContaining({
				title: 'STW',
				widget: testWidget
			})
		);
	});

	it('does not open history dialog from context menu when dashboard is unlocked', async () => {
		dashboard.isDashboardStatic.set(false);
		const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

		component.openWidgetHistoryDialog(event);
		await Promise.resolve();

		expect(historySyncMock.resolveSeriesForWidget).not.toHaveBeenCalled();
		expect(dialogServiceMock.openWidgetHistoryDialog).not.toHaveBeenCalled();
	});

	it('ignores options dialog open request when dashboard is locked', () => {
		dashboard.isDashboardStatic.set(true);

		component.openWidgetOptions(new Event('dblclick'));

		expect(dialogServiceMock.openWidgetOptions).not.toHaveBeenCalled();
	});

	it('opens history dialog from explicit two-finger tap when dashboard is locked', async () => {
		dashboard.isDashboardStatic.set(true);

		component.onHistoryTwoFingerTap(new PointerEvent('pointerup', {
			pointerId: 10,
			pointerType: 'touch',
			clientX: 20,
			clientY: 20,
			isPrimary: true
		}));
		await Promise.resolve();

		expect(historySyncMock.resolveSeriesForWidget).toHaveBeenCalledWith(testWidget);
		expect(dialogServiceMock.openWidgetHistoryDialog).toHaveBeenCalledTimes(1);
	});

	it('does not open history dialog when widget has no numeric paths', async () => {
		dashboard.isDashboardStatic.set(true);
		testWidget.config.paths = {
			textPath: {
				description: 'State',
				path: 'navigation.state',
				source: null,
				pathType: 'string',
				isPathConfigurable: true,
				sampleTime: 1000
			}
		};

		component.openWidgetHistoryDialog(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		await Promise.resolve();

		expect(dialogServiceMock.openWidgetHistoryDialog).not.toHaveBeenCalled();
	});

	it('does not open history dialog when supportAutomaticHistoricalSeries is false', async () => {
		dashboard.isDashboardStatic.set(true);
		testWidget.config.supportAutomaticHistoricalSeries = false;

		component.openWidgetHistoryDialog(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		await Promise.resolve();

		expect(dialogServiceMock.openWidgetHistoryDialog).not.toHaveBeenCalled();
	});

	it('does not open history dialog when resolved series is inactive', async () => {
		dashboard.isDashboardStatic.set(true);
		historySyncMock.resolveSeriesForWidget.and.returnValue([
			{
				seriesId: 'widget-1:auto:navigation-speedthroughwater:default',
				datasetUuid: 'widget-1:navigation-speedthroughwater:default',
				ownerWidgetUuid: 'widget-1',
				ownerWidgetSelector: 'widget-numeric',
				path: 'navigation.speedThroughWater',
				source: 'default',
				sampleTime: 1000,
				enabled: false
			}
		]);

		component.openWidgetHistoryDialog(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		await Promise.resolve();

		expect(dialogServiceMock.openWidgetHistoryDialog).not.toHaveBeenCalled();
	});

	it('opens history dialog for widget-bms using effective plugin-expanded series', async () => {
		dashboard.isDashboardStatic.set(true);
		testWidget.type = 'widget-bms';
		testWidget.config = {
			displayName: 'BMS',
		};

		historySyncMock.resolveSeriesForWidget.and.returnValue([
			{
				seriesId: 'widget-1:bms-template',
				datasetUuid: 'widget-1:bms-template',
				ownerWidgetUuid: 'widget-1',
				ownerWidgetSelector: 'widget-bms',
				path: 'self.electrical.batteries.*',
				expansionMode: 'bms-battery-tree',
				enabled: true
			}
		]);

		kipSeriesMock.getSeriesDefinitions.and.resolveTo([
			{
				seriesId: 'widget-1:bms:bank-1:stateOfCharge:default',
				datasetUuid: 'widget-1:bms:bank-1:stateOfCharge:default',
				ownerWidgetUuid: 'widget-1',
				ownerWidgetSelector: 'widget-bms',
				path: 'electrical.batteries.bank-1.stateOfCharge',
				enabled: true
			}
		]);

		component.openWidgetHistoryDialog(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		await Promise.resolve();
		await Promise.resolve();

		expect(dialogServiceMock.openWidgetHistoryDialog).toHaveBeenCalledTimes(1);
	});

	it('suppresses bottom sheet opening while dragging', () => {
		dashboard.isDashboardStatic.set(false);
		const uiEvents = TestBed.inject(uiEventService);
		uiEvents.isDragging.set(true);

		component.openBottomSheet(new Event('press'));

		expect(bottomSheetMock.open).not.toHaveBeenCalled();
	});
});
