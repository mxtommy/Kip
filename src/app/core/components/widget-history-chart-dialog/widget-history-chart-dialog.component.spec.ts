import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { of } from 'rxjs';
import { WidgetHistoryChartDialogComponent } from './widget-history-chart-dialog.component';
import { AppService } from '../../services/app-service';
import { HistoryApiClientService } from '../../services/history-api-client.service';
import { HistoryToChartMapperService } from '../../services/history-to-chart-mapper.service';
import { UnitsService } from '../../services/units.service';
import { IWidget } from '../../interfaces/widgets-interface';
import { IKipSeriesDefinition } from '../../services/kip-series-api-client.service';

describe('WidgetHistoryChartDialogComponent', () => {
    let fixture: ComponentFixture<WidgetHistoryChartDialogComponent>;
    let component: WidgetHistoryChartDialogComponent;
    let historyApiClientMock: {
        getPaths: Mock;
        getValues: Mock;
    };
    let historyMapperMock: {
        mapValuesToChartDatapoints: Mock;
    };

    const theme = {
        green: '#11aa44',
        orange: '#dd7700',
        pink: '#cc4488',
        purple: '#7755cc',
        yellow: '#d0aa00',
        grey: '#7a7a7a',
        blue: '#2266dd',
        contrast: '#ffffff',
        contrastDim: '#c0c0c0',
        contrastDimmer: '#5a5a5a'
    };

    const seriesDefinitions: IKipSeriesDefinition[] = [
        {
            seriesId: 'widget-bms-1:bms:battery-1:capacity.stateOfCharge:default',
            datasetUuid: 'widget-bms-1:bms:battery-1:capacity.stateOfCharge:default',
            ownerWidgetUuid: 'widget-bms-1',
            ownerWidgetSelector: 'widget-bms',
            path: 'self.electrical.batteries.battery-1.capacity.stateOfCharge',
            enabled: true
        },
        {
            seriesId: 'widget-bms-1:bms:battery-1:current:default',
            datasetUuid: 'widget-bms-1:bms:battery-1:current:default',
            ownerWidgetUuid: 'widget-bms-1',
            ownerWidgetSelector: 'widget-bms',
            path: 'self.electrical.batteries.battery-1.current',
            enabled: true
        }
    ];

    const widget: IWidget = {
        uuid: 'widget-bms-1',
        type: 'widget-bms',
        config: {
            displayName: 'Battery History',
            color: 'blue'
        }
    } as IWidget;

    beforeEach(async () => {
        historyApiClientMock = {
            getPaths: vi.fn().mockResolvedValue([]),
            getValues: vi.fn().mockImplementation(({ paths }: {
                paths: string;
            }) => Promise.resolve({
                data: [{}],
                requestedPath: paths
            }))
        };

        historyMapperMock = {
            mapValuesToChartDatapoints: vi.fn().mockImplementation((response: {
                requestedPath?: string;
            }) => {
                if (response.requestedPath?.includes('stateOfCharge')) {
                    return [{ timestamp: 1000, data: { value: 0.62 } }];
                }

                return [{ timestamp: 1000, data: { value: 14.5 } }];
            })
        };

        await TestBed.configureTestingModule({
            imports: [WidgetHistoryChartDialogComponent],
            providers: [
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {
                        title: 'Battery History',
                        widget,
                        seriesDefinitions
                    }
                },
                {
                    provide: AppService,
                    useValue: {
                        cssThemeColorRoles$: of(theme)
                    }
                },
                { provide: HistoryApiClientService, useValue: historyApiClientMock },
                { provide: HistoryToChartMapperService, useValue: historyMapperMock },
                {
                    provide: UnitsService,
                    useValue: {
                        convertToUnit: (_unit: string, value: number) => value
                    }
                }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(WidgetHistoryChartDialogComponent);
        component = fixture.componentInstance;
    });

    it('uses axis-metric colors for BMS series and keeps first-entity lines solid', async () => {
        const socDataset = await (component as unknown as {
            buildDatasetForSeries: (series: IKipSeriesDefinition, index: number) => Promise<{
                data: {
                    x: number;
                    y: number;
                }[];
                borderColor: string;
                yAxisID: string;
                borderDash?: number[];
            } | null>;
        }).buildDatasetForSeries(seriesDefinitions[0], 0);
        const currentDataset = await (component as unknown as {
            buildDatasetForSeries: (series: IKipSeriesDefinition, index: number) => Promise<{
                data: {
                    x: number;
                    y: number;
                }[];
                borderColor: string;
                yAxisID: string;
                borderDash?: number[];
            } | null>;
        }).buildDatasetForSeries(seriesDefinitions[1], 1);

        expect(socDataset).not.toBeNull();
        expect(currentDataset).not.toBeNull();
        expect(socDataset?.data[0].y).toBe(62);
        expect(socDataset?.yAxisID).toBe('ySoc');
        expect(currentDataset?.yAxisID).toBe('yCurrent');
        expect(socDataset?.borderDash).toBeUndefined();
        expect(currentDataset?.borderDash).toBeUndefined();
        expect(socDataset?.borderColor).toBe(theme.blue);
        expect(currentDataset?.borderColor).toBe(theme.green);
    });

    it('uses series-order dash with metric-order colors across multiple BMS entities', async () => {
        const bmsSeries: IKipSeriesDefinition[] = [
            {
                seriesId: 'widget-bms-1:bms:battery-1:capacity.stateOfCharge:default',
                datasetUuid: 'widget-bms-1:bms:battery-1:capacity.stateOfCharge:default',
                ownerWidgetUuid: 'widget-bms-1',
                ownerWidgetSelector: 'widget-bms',
                path: 'self.electrical.batteries.battery-1.capacity.stateOfCharge',
                enabled: true
            },
            {
                seriesId: 'widget-bms-1:bms:battery-1:current:default',
                datasetUuid: 'widget-bms-1:bms:battery-1:current:default',
                ownerWidgetUuid: 'widget-bms-1',
                ownerWidgetSelector: 'widget-bms',
                path: 'self.electrical.batteries.battery-1.current',
                enabled: true
            },
            {
                seriesId: 'widget-bms-1:bms:battery-2:capacity.stateOfCharge:default',
                datasetUuid: 'widget-bms-1:bms:battery-2:capacity.stateOfCharge:default',
                ownerWidgetUuid: 'widget-bms-1',
                ownerWidgetSelector: 'widget-bms',
                path: 'self.electrical.batteries.battery-2.capacity.stateOfCharge',
                enabled: true
            },
            {
                seriesId: 'widget-bms-1:bms:battery-2:current:default',
                datasetUuid: 'widget-bms-1:bms:battery-2:current:default',
                ownerWidgetUuid: 'widget-bms-1',
                ownerWidgetSelector: 'widget-bms',
                path: 'self.electrical.batteries.battery-2.current',
                enabled: true
            }
        ];

        (component as unknown as {
            data: {
                title: string;
                widget: IWidget;
                seriesDefinitions: IKipSeriesDefinition[];
            };
        }).data = {
            title: 'Battery History',
            widget,
            seriesDefinitions: bmsSeries
        };

        const soc1 = await (component as unknown as {
            buildDatasetForSeries: (series: IKipSeriesDefinition, index: number) => Promise<{
                borderColor: string;
                borderDash?: number[];
            } | null>;
        }).buildDatasetForSeries(bmsSeries[0], 0);

        const current1 = await (component as unknown as {
            buildDatasetForSeries: (series: IKipSeriesDefinition, index: number) => Promise<{
                borderColor: string;
                borderDash?: number[];
            } | null>;
        }).buildDatasetForSeries(bmsSeries[1], 1);

        const soc2 = await (component as unknown as {
            buildDatasetForSeries: (series: IKipSeriesDefinition, index: number) => Promise<{
                borderColor: string;
                borderDash?: number[];
            } | null>;
        }).buildDatasetForSeries(bmsSeries[2], 2);

        const current2 = await (component as unknown as {
            buildDatasetForSeries: (series: IKipSeriesDefinition, index: number) => Promise<{
                borderColor: string;
                borderDash?: number[];
            } | null>;
        }).buildDatasetForSeries(bmsSeries[3], 3);

        expect(soc1?.borderColor).toBe(theme.blue);
        expect(soc2?.borderColor).toBe(theme.blue);
        expect(current1?.borderColor).toBe(theme.green);
        expect(current2?.borderColor).toBe(theme.green);

        expect(soc1?.borderDash).toBeUndefined();
        expect(current1?.borderDash).toBeUndefined();
        expect(soc2?.borderDash).toEqual([6, 4]);
        expect(current2?.borderDash).toEqual([6, 4]);
    });

    it('builds dual y-axes for BMS charts and colors axis titles by metric', () => {
        (component as unknown as {
            pendingDatasets: {
                yAxisID?: string;
            }[];
        }).pendingDatasets = [{ yAxisID: 'ySoc' }];

        const scales = (component as unknown as {
            buildYScales: (unitLabel: string) => Record<string, unknown>;
        }).buildYScales('');

        expect(scales['ySoc']).toBeDefined();
        expect(scales['yCurrent']).toBeDefined();
        expect(scales['y']).toBeUndefined();
        expect((scales['ySoc'] as {
            title?: {
                color?: string;
            };
        }).title?.color).toBe(theme.blue);
        expect((scales['yCurrent'] as {
            title?: {
                color?: string;
            };
        }).title?.color).toBe(theme.green);
    });

    it('classifies solar panelPower/current on dual axes, converts power W to kW, and keeps first-entity lines solid', async () => {
        historyApiClientMock.getValues.mockImplementation(({ paths }: {
            paths: string;
        }) => Promise.resolve({
            data: [{}],
            requestedPath: paths
        }));

        historyMapperMock.mapValuesToChartDatapoints.mockImplementation((response: {
            requestedPath?: string;
        }) => {
            if (response.requestedPath?.includes('panelPower')) {
                return [{ timestamp: 1000, data: { value: 8200 } }];
            }

            return [{ timestamp: 1000, data: { value: 12.5 } }];
        });

        const panelPowerSeries: IKipSeriesDefinition = {
            seriesId: 'widget-solar-1:solar:charger-1:panelPower:default',
            datasetUuid: 'widget-solar-1:solar:charger-1:panelPower:default',
            ownerWidgetUuid: 'widget-solar-1',
            ownerWidgetSelector: 'widget-solar-charger',
            path: 'self.electrical.solar.charger-1.panelPower',
            enabled: true
        };
        const currentSeries: IKipSeriesDefinition = {
            seriesId: 'widget-solar-1:solar:charger-1:current:default',
            datasetUuid: 'widget-solar-1:solar:charger-1:current:default',
            ownerWidgetUuid: 'widget-solar-1',
            ownerWidgetSelector: 'widget-solar-charger',
            path: 'self.electrical.solar.charger-1.current',
            enabled: true
        };

        const panelPowerDataset = await (component as unknown as {
            buildDatasetForSeries: (series: IKipSeriesDefinition, index: number) => Promise<{
                data: {
                    x: number;
                    y: number;
                }[];
                borderColor: string;
                yAxisID: string;
                borderDash?: number[];
            } | null>;
        }).buildDatasetForSeries(panelPowerSeries, 0);

        const currentDataset = await (component as unknown as {
            buildDatasetForSeries: (series: IKipSeriesDefinition, index: number) => Promise<{
                data: {
                    x: number;
                    y: number;
                }[];
                borderColor: string;
                yAxisID: string;
                borderDash?: number[];
            } | null>;
        }).buildDatasetForSeries(currentSeries, 1);

        expect(panelPowerDataset).not.toBeNull();
        expect(currentDataset).not.toBeNull();
        expect(panelPowerDataset?.data[0].y).toBe(8.2);
        expect(panelPowerDataset?.yAxisID).toBe('yPower');
        expect(currentDataset?.yAxisID).toBe('yCurrent');
        expect(panelPowerDataset?.borderDash).toBeUndefined();
        expect(currentDataset?.borderDash).toBeUndefined();
        expect(panelPowerDataset?.borderColor).toBe(theme.blue);
        expect(currentDataset?.borderColor).toBe(theme.green);
    });

    it('builds dual y-axes for solar charts and colors axis titles by metric', () => {
        (component as unknown as {
            data: {
                widget: IWidget;
            };
            pendingDatasets: {
                yAxisID?: string;
            }[];
        }).data = {
            widget: {
                uuid: 'widget-solar-1',
                type: 'widget-solar-charger',
                config: {
                    displayName: 'Solar Charger'
                }
            } as IWidget
        };

        (component as unknown as {
            pendingDatasets: {
                yAxisID?: string;
            }[];
        }).pendingDatasets = [{ yAxisID: 'yPower' }, { yAxisID: 'yCurrent' }];

        const scales = (component as unknown as {
            buildYScales: (unitLabel: string) => Record<string, unknown>;
        }).buildYScales('');

        expect(scales['yPower']).toBeDefined();
        expect(scales['yCurrent']).toBeDefined();
        expect(scales['y']).toBeUndefined();
        expect((scales['yPower'] as {
            title?: {
                color?: string;
            };
        }).title?.color).toBe(theme.blue);
        expect((scales['yCurrent'] as {
            title?: {
                color?: string;
            };
        }).title?.color).toBe(theme.green);
    });

    it('expands solar wildcard template paths into concrete history requests', async () => {
        (component as unknown as {
            data: {
                title: string;
                widget: IWidget;
                seriesDefinitions: IKipSeriesDefinition[];
            };
        }).data = {
            title: 'Solar History',
            widget: {
                uuid: 'widget-solar-1',
                type: 'widget-solar-charger',
                config: {
                    displayName: 'Solar Charger'
                }
            } as IWidget,
            seriesDefinitions: [
                {
                    seriesId: 'widget-solar-1:solar-template',
                    datasetUuid: 'widget-solar-1:solar-template',
                    ownerWidgetUuid: 'widget-solar-1',
                    ownerWidgetSelector: 'widget-solar-charger',
                    path: 'self.electrical.solar.*',
                    expansionMode: 'solar-tree',
                    allowedBatteryIds: null,
                    allowedSolarIds: null,
                    enabled: true
                }
            ]
        };

        historyApiClientMock.getPaths.mockResolvedValue([
            'electrical.solar.charger-1.current',
            'electrical.solar.charger-1.panelPower',
            'electrical.solar.charger-1.voltage'
        ]);

        await component.loadHistoryDatasets();

        const calls = historyApiClientMock.getValues.mock.calls.map((c: [{ paths: string }]) => c[0].paths);
        const panelPowerIdx = calls.findIndex((p: string) => p.includes('panelPower'));
        const currentIdx = calls.findIndex((p: string) => p.includes('.current'));

        expect(panelPowerIdx).toBeGreaterThanOrEqual(0);
        expect(currentIdx).toBeGreaterThanOrEqual(0);
        // panelPower is primary metric (index 0) so its request must precede current
        expect(panelPowerIdx).toBeLessThan(currentIdx);

        expect(historyApiClientMock.getValues).toHaveBeenCalledWith(expect.objectContaining({
            paths: 'electrical.solar.charger-1.current:avg'
        }));
        expect(historyApiClientMock.getValues).toHaveBeenCalledWith(expect.objectContaining({
            paths: 'electrical.solar.charger-1.panelPower:avg'
        }));
        expect(historyApiClientMock.getValues).not.toHaveBeenCalledWith(expect.objectContaining({
            paths: 'electrical.solar.*:avg'
        }));
    });
});
