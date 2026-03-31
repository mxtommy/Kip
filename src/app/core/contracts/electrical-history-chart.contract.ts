export type TDualAxisWidgetType = 'widget-bms' | 'widget-solar-charger';
export type TDualAxisMetric = 'soc' | 'current' | 'panelPower';
export type TDualAxisAxisId = 'ySoc' | 'yCurrent' | 'yPower';

export interface IDualAxisSeriesDescriptor {
  widgetType: TDualAxisWidgetType;
  entityId: string;
  metric: TDualAxisMetric;
  axisId: TDualAxisAxisId;
}

interface IDualAxisPathRule {
  axisId: TDualAxisAxisId;
  metric: TDualAxisMetric;
  regex: RegExp;
}

interface IDualAxisWidgetChartMeta {
  metricOrder: TDualAxisMetric[];
  pathRules: IDualAxisPathRule[];
}

export const ELECTRICAL_DUAL_AXIS_WIDGET_META: Readonly<Record<TDualAxisWidgetType, IDualAxisWidgetChartMeta>> = {
  'widget-bms': {
    metricOrder: ['soc', 'current'],
    pathRules: [
      {
        metric: 'soc',
        axisId: 'ySoc',
        regex: /^electrical\.batteries\.([^.]+)\.(?:capacity\.)?stateOfCharge$/i
      },
      {
        metric: 'current',
        axisId: 'yCurrent',
        regex: /^electrical\.batteries\.([^.]+)\.current$/i
      }
    ]
  },
  'widget-solar-charger': {
    metricOrder: ['panelPower', 'current'],
    pathRules: [
      {
        metric: 'current',
        axisId: 'yCurrent',
        regex: /^electrical\.solar\.([^.]+)\.current$/i
      },
      {
        metric: 'panelPower',
        axisId: 'yPower',
        regex: /^electrical\.solar\.([^.]+)\.panelPower$/i
      }
    ]
  }
};

export function describeElectricalDualAxisSeries(normalizedPath: string): IDualAxisSeriesDescriptor | null {
  for (const [widgetType, chartMeta] of Object.entries(ELECTRICAL_DUAL_AXIS_WIDGET_META) as [TDualAxisWidgetType, IDualAxisWidgetChartMeta][]) {
    for (const pathRule of chartMeta.pathRules) {
      const match = pathRule.regex.exec(normalizedPath);
      if (!match) {
        continue;
      }

      return {
        widgetType,
        entityId: match[1],
        metric: pathRule.metric,
        axisId: pathRule.axisId
      };
    }
  }

  return null;
}
