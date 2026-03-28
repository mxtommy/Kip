import { describe, expect, it } from 'vitest';
import { IKipConcreteSeriesDefinition, IKipSeriesDefinition, IKipTemplateSeriesDefinition, isKipConcreteSeriesDefinition, isKipSeriesEnabled, isKipTemplateSeriesDefinition, } from './kip-series-contract';

describe('kip-series-contract guards', () => {
    const concreteSeries: IKipConcreteSeriesDefinition = {
        seriesId: 'widget-1:datachart',
        datasetUuid: 'widget-1',
        ownerWidgetUuid: 'widget-1',
        ownerWidgetSelector: 'widget-data-chart',
        path: 'navigation.speedThroughWater',
        expansionMode: null,
        allowedBatteryIds: null,
        context: 'vessels.self',
        source: 'default',
        timeScale: 'minute',
        period: 10,
        retentionDurationMs: null,
        sampleTime: 1000,
        enabled: true,
    };

    const templateSeries: IKipTemplateSeriesDefinition = {
        seriesId: 'widget-2:bms-template',
        datasetUuid: 'widget-2:bms-template',
        ownerWidgetUuid: 'widget-2',
        ownerWidgetSelector: 'widget-bms',
        path: 'self.electrical.batteries.*',
        expansionMode: 'bms-battery-tree',
        allowedBatteryIds: ['house', 'start'],
        context: 'vessels.self',
        source: 'default',
        timeScale: 'hour',
        period: 24,
        retentionDurationMs: 86400000,
        sampleTime: null,
        enabled: true,
    };

    const solarTemplateSeries: IKipTemplateSeriesDefinition = {
        seriesId: 'widget-3:solar-template',
        datasetUuid: 'widget-3:solar-template',
        ownerWidgetUuid: 'widget-3',
        ownerWidgetSelector: 'widget-solar-charger',
        path: 'self.electrical.solar.*',
        expansionMode: 'solar-tree',
        allowedSolarIds: ['port', 'starboard'],
        context: 'vessels.self',
        source: 'default',
        timeScale: 'hour',
        period: 24,
        retentionDurationMs: 86400000,
        sampleTime: null,
        enabled: true,
    };

    it('identifies concrete series definitions', () => {
        const value: IKipSeriesDefinition = concreteSeries;

        expect(isKipConcreteSeriesDefinition(value)).toBe(true);
        expect(isKipTemplateSeriesDefinition(value)).toBe(false);
    });

    it('identifies template series definitions', () => {
        const value: IKipSeriesDefinition = templateSeries;

        expect(isKipTemplateSeriesDefinition(value)).toBe(true);
        expect(isKipConcreteSeriesDefinition(value)).toBe(false);
    });

    it('treats enabled false as disabled', () => {
        expect(isKipSeriesEnabled(concreteSeries)).toBe(true);
        expect(isKipSeriesEnabled({ ...concreteSeries, enabled: false })).toBe(false);
    });

    it('preserves template-only battery filters', () => {
        const value: IKipSeriesDefinition = templateSeries;

        if (!isKipTemplateSeriesDefinition(value)) {
            throw new Error('Expected template series definition');
            return;
        }

        expect(value.allowedBatteryIds).toEqual(['house', 'start']);
    });

    it('preserves template-only charger filters for solar templates', () => {
        const value: IKipSeriesDefinition = solarTemplateSeries;

        if (!isKipTemplateSeriesDefinition(value)) {
            throw new Error('Expected template series definition');
            return;
        }

        expect(value.allowedSolarIds).toEqual(['port', 'starboard']);
    });

    it('keeps concrete series free of template expansion state', () => {
        const value: IKipSeriesDefinition = concreteSeries;

        if (!isKipConcreteSeriesDefinition(value)) {
            throw new Error('Expected concrete series definition');
            return;
        }

        expect(value.expansionMode ?? null).toBeNull();
        expect(value.allowedBatteryIds ?? null).toBeNull();
        expect(value.allowedSolarIds ?? null).toBeNull();
    });
});
