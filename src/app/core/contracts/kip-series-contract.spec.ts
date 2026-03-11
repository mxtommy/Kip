import {
  IKipConcreteSeriesDefinition,
  IKipSeriesDefinition,
  IKipTemplateSeriesDefinition,
  isKipConcreteSeriesDefinition,
  isKipSeriesEnabled,
  isKipTemplateSeriesDefinition,
} from './kip-series-contract';

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

  it('identifies concrete series definitions', () => {
    const value: IKipSeriesDefinition = concreteSeries;

    expect(isKipConcreteSeriesDefinition(value)).toBeTrue();
    expect(isKipTemplateSeriesDefinition(value)).toBeFalse();
  });

  it('identifies template series definitions', () => {
    const value: IKipSeriesDefinition = templateSeries;

    expect(isKipTemplateSeriesDefinition(value)).toBeTrue();
    expect(isKipConcreteSeriesDefinition(value)).toBeFalse();
  });

  it('treats enabled false as disabled', () => {
    expect(isKipSeriesEnabled(concreteSeries)).toBeTrue();
    expect(isKipSeriesEnabled({ ...concreteSeries, enabled: false })).toBeFalse();
  });

  it('preserves template-only battery filters', () => {
    const value: IKipSeriesDefinition = templateSeries;

    if (!isKipTemplateSeriesDefinition(value)) {
      fail('Expected template series definition');
      return;
    }

    expect(value.allowedBatteryIds).toEqual(['house', 'start']);
  });

  it('keeps concrete series free of template expansion state', () => {
    const value: IKipSeriesDefinition = concreteSeries;

    if (!isKipConcreteSeriesDefinition(value)) {
      fail('Expected concrete series definition');
      return;
    }

    expect(value.expansionMode ?? null).toBeNull();
    expect(value.allowedBatteryIds ?? null).toBeNull();
  });
});
