import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { HistoryToChartMapperService } from './history-to-chart-mapper.service';
import { IHistoryValuesResponse } from './history-api-client.service';

describe('HistoryToChartMapperService', () => {
  let service: HistoryToChartMapperService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HistoryToChartMapperService]
    });

    service = TestBed.inject(HistoryToChartMapperService);
  });

  it('maps average method alias to datapoint value extraction', () => {
    const response: IHistoryValuesResponse = {
      context: 'vessels.self',
      range: {
        from: '2026-02-16T00:00:00.000Z',
        to: '2026-02-16T00:02:00.000Z'
      },
      values: [
        { path: 'environment.wind.angleApparent', method: 'average' }
      ],
      data: [
        ['2026-02-16T00:00:00.000Z', 0.5],
        ['2026-02-16T00:01:00.000Z', 0.6]
      ]
    };

    const datapoints = service.mapValuesToChartDatapoints(response, {
      unit: 'number',
      domain: 'scalar'
    });

    expect(datapoints.length).toBe(2);
    expect(datapoints[0].data.value).toBe(0.5);
    expect(datapoints[1].data.value).toBe(0.6);
  });

  it('computes circular summary stats on final datapoint for rad direction domain', () => {
    const response: IHistoryValuesResponse = {
      context: 'vessels.self',
      range: {
        from: '2026-02-16T00:00:00.000Z',
        to: '2026-02-16T00:03:00.000Z'
      },
      values: [
        { path: 'environment.wind.angleTrueWater', method: 'avg' }
      ],
      data: [
        ['2026-02-16T00:00:00.000Z', 6.19591884457987],
        ['2026-02-16T00:01:00.000Z', 0.08726646259971647],
        ['2026-02-16T00:02:00.000Z', 0.05235987755982989]
      ]
    };

    const datapoints = service.mapValuesToChartDatapoints(response, {
      unit: 'rad',
      domain: 'direction'
    });

    expect(datapoints.length).toBe(3);
    expect(datapoints[0].data.lastAverage).toBeNull();
    expect(datapoints[1].data.lastAverage).toBeNull();

    const final = datapoints[2].data;
    expect(final.lastAverage).toBeCloseTo(0.0174959160, 6);
    expect(final.lastMinimum).toBeCloseTo(6.1959188446, 6);
    expect(final.lastMaximum).toBeCloseTo(0.0872664626, 6);
  });
});
