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

    it('pairs BMS SoC and current series by color, converts SoC to percent, and dashes SoC lines', async () => {
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
        expect(socDataset?.borderDash).toEqual([6, 4]);
        expect(currentDataset?.borderDash).toBeUndefined();
        expect(currentDataset?.borderColor).toBe(socDataset?.borderColor);
    });

    it('builds dual y-axes for BMS charts', () => {
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
    });

    it('darkens legend/tooltip fill colors consistently', () => {
        const darkerColor = (component as unknown as {
            darkenColor: (color: unknown, amount: number) => unknown;
        }).darkenColor('#2266dd', 0.25);

        expect(darkerColor).toBe('rgb(26, 77, 166)');
    });
});
