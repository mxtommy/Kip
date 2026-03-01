import { Injectable } from '@angular/core';
import { IHistoryValuesResponse } from './history-api-client.service';

/**
 * Defines how angular/radian values are interpreted while mapping historical data.
 */
export type THistoryChartAngleDomain = 'scalar' | 'direction' | 'signed';

/**
 * Normalized historical datapoint shape used by chart-oriented consumers.
 */
export interface IHistoryChartDatapoint {
  timestamp: number;
  data: {
    value: number | null;
    sma?: number | null;
    ema?: number | null;
    doubleEma?: number | null;
    lastAverage?: number | null;
    lastMinimum?: number | null;
    lastMaximum?: number | null;
  };
}

/**
 * Shared adapter that converts Signal K History API responses into a normalized
 * chart-friendly datapoint layout.
 */
@Injectable({
  providedIn: 'root'
})
export class HistoryToChartMapperService {
  /**
   * Maps a History API response payload into normalized chart datapoints.
   *
   * - Detects aggregate columns (`avg`/`average`, `sma`, `min`, `max`) from
   *   `response.values`.
   * - Emits one datapoint per response row.
   * - Computes dataset-wide summary stats from mapped datapoint values and
   *   stores them on the final datapoint (`lastAverage`, `lastMinimum`, `lastMaximum`).
   *
   * @param {IHistoryValuesResponse} response Raw History API response.
   * @param {{ unit: string; domain: THistoryChartAngleDomain }} options Mapping options.
   * @param {string} options.unit Base unit (e.g., `number`, `rad`) used to choose scalar vs circular math.
   * @param {THistoryChartAngleDomain} options.domain Angular domain interpretation for `rad` values.
   * @returns {IHistoryChartDatapoint[]} Normalized datapoints ready for chart/data prefill pipelines.
   *
   * @example
   * const datapoints = adapter.mapValuesToChartDatapoints(response, {
   *   unit: 'number',
   *   domain: 'scalar'
   * });
   */
  public mapValuesToChartDatapoints(
    response: IHistoryValuesResponse,
    options: { unit: string; domain: THistoryChartAngleDomain }
  ): IHistoryChartDatapoint[] {
    const rows = response?.data;
    if (!rows || rows.length === 0) {
      return [];
    }

    let smaIndex = -1;
    let avgIndex = -1;
    if (response.values && Array.isArray(response.values)) {
      for (let i = 0; i < response.values.length; i++) {
        const rawMethod = response.values[i]?.method;
        const method = typeof rawMethod === 'string' ? rawMethod.toLowerCase() : rawMethod;
        if (!method) continue;
        const index = i + 1; // +1 because index 0 is timestamp
        if (method === 'sma') smaIndex = index;
        else if (method === 'avg' || method === 'average') avgIndex = index;
      }

      if (avgIndex < 0 && response.values.length === 1) {
        avgIndex = 1;
      }
    } else if (rows[0]?.length > 1) {
      avgIndex = 1;
    }

    const shouldNormalizeAngle = options.unit === 'rad';
    const normalizeAngle = shouldNormalizeAngle
      ? (options.domain === 'signed'
        ? this.normalizeToSigned.bind(this)
        : this.normalizeToDirection.bind(this))
      : null;

    const datapoints: IHistoryChartDatapoint[] = [];

    let scalarSum = 0;
    let scalarMin = Number.POSITIVE_INFINITY;
    let scalarMax = Number.NEGATIVE_INFINITY;
    let scalarCount = 0;

    let angleSumSin = 0;
    let angleSumCos = 0;
    const angleValues: number[] = [];

    for (const row of rows) {
      if (!Array.isArray(row) || row.length === 0) continue;

      const timestamp = Date.parse(row[0] as string);

      let smaValue = smaIndex >= 0 ? (row[smaIndex] as number | null) : null;
      let avgValue = avgIndex >= 0 ? (row[avgIndex] as number | null) : null;

      if (shouldNormalizeAngle) {
        smaValue = Number.isFinite(smaValue) ? normalizeAngle!(smaValue as number) : null;
        avgValue = Number.isFinite(avgValue) ? normalizeAngle!(avgValue as number) : null;
      } else {
        smaValue = Number.isFinite(smaValue) ? (smaValue as number) : null;
        avgValue = Number.isFinite(avgValue) ? (avgValue as number) : null;
      }

      if (Number.isFinite(avgValue)) {
        const value = avgValue as number;
        if (shouldNormalizeAngle) {
          angleValues.push(value);
          angleSumSin += Math.sin(value);
          angleSumCos += Math.cos(value);
        } else {
          scalarCount++;
          scalarSum += value;
          if (value < scalarMin) scalarMin = value;
          if (value > scalarMax) scalarMax = value;
        }
      }

      datapoints.push({
        timestamp,
        data: {
          value: avgValue,
          sma: smaValue,
          ema: null,
          doubleEma: null,
          lastAverage: null,
          lastMinimum: null,
          lastMaximum: null
        }
      });
    }

    if (datapoints.length > 0) {
      let datasetAverage: number | null = null;
      let datasetMinimum: number | null = null;
      let datasetMaximum: number | null = null;

      if (shouldNormalizeAngle && angleValues.length > 0) {
        datasetAverage = Math.atan2(angleSumSin / angleValues.length, angleSumCos / angleValues.length);
        const { min, max } = this.circularMinMaxRad(angleValues);

        if (options.domain === 'signed') {
          datasetAverage = this.normalizeToSigned(datasetAverage);
          datasetMinimum = this.normalizeToSigned(min);
          datasetMaximum = this.normalizeToSigned(max);
        } else {
          datasetAverage = this.normalizeToDirection(datasetAverage);
          datasetMinimum = this.normalizeToDirection(min);
          datasetMaximum = this.normalizeToDirection(max);
        }
      } else if (!shouldNormalizeAngle && scalarCount > 0) {
        datasetAverage = scalarSum / scalarCount;
        datasetMinimum = scalarMin;
        datasetMaximum = scalarMax;
      }

      if (datasetAverage !== null && datasetMinimum !== null && datasetMaximum !== null) {
        const finalDatapoint = datapoints[datapoints.length - 1];
        finalDatapoint.data.lastAverage = datasetAverage;
        finalDatapoint.data.lastMinimum = datasetMinimum;
        finalDatapoint.data.lastMaximum = datasetMaximum;
      }
    }

    return datapoints;
  }

  private circularMinMaxRad(anglesRad: number[]): { min: number; max: number } {
    if (anglesRad.length === 0) {
      return { min: 0, max: 0 };
    }

    const degAngles = anglesRad
      .map(angle => ((angle * 180 / Math.PI) + 360) % 360)
      .sort((left, right) => left - right);

    let maxGap = 0;
    let minIdx = 0;
    for (let i = 0; i < degAngles.length; i++) {
      const next = (i + 1) % degAngles.length;
      const gap = (degAngles[next] - degAngles[i] + 360) % 360;
      if (gap > maxGap) {
        maxGap = gap;
        minIdx = next;
      }
    }

    return {
      min: degAngles[minIdx] * Math.PI / 180,
      max: degAngles[(minIdx - 1 + degAngles.length) % degAngles.length] * Math.PI / 180
    };
  }

  private mod(value: number, modulo: number): number {
    return ((value % modulo) + modulo) % modulo;
  }

  private normalizeToDirection(rad: number): number {
    const twoPi = 2 * Math.PI;
    return this.mod(rad, twoPi);
  }

  private normalizeToSigned(rad: number): number {
    const twoPi = 2 * Math.PI;
    return this.mod(rad + Math.PI, twoPi) - Math.PI;
  }
}
