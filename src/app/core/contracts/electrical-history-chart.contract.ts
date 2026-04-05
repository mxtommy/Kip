import type { TElectricalExpansionMode } from './kip-series-contract';

export type TDualAxisWidgetType = 'widget-bms' | 'widget-solar-charger' | 'widget-charger' | 'widget-inverter' | 'widget-alternator' | 'widget-ac';
export type TDualAxisMetric = 'soc' | 'current' | 'panelPower' | 'voltage' | 'frequency';
export type TDualAxisAxisId = 'ySoc' | 'yCurrent' | 'yPower' | 'yVoltage' | 'yFrequency';
export type TChartAxisPosition = 'left' | 'right';

export interface IDualAxisSeriesDescriptor {
  widgetType: TDualAxisWidgetType;
  entityId: string;
  metric: TDualAxisMetric;
  axisId: TDualAxisAxisId;
}

export interface IDualAxisPathRule {
  axisId: TDualAxisAxisId;
  metric: TDualAxisMetric;
  regex: RegExp;
}

export interface IDualAxisMetricConfig {
  metric: TDualAxisMetric;
  axisId: TDualAxisAxisId;
  pathSuffixes: readonly string[];
  transform: (value: number) => number;
}

export interface IDualAxisAxisConfig {
  axisId: TDualAxisAxisId;
  position: TChartAxisPosition;
  title: string;
  tickSuffix: string;
  min?: number;
  max?: number;
  drawOnChartArea?: boolean;
}

export interface IDualAxisWidgetChartMeta {
  expansionMode: TElectricalExpansionMode;
  metricOrder: TDualAxisMetric[];
  pathRules: IDualAxisPathRule[];
  metrics: Partial<Record<TDualAxisMetric, IDualAxisMetricConfig>>;
  axes: Partial<Record<TDualAxisAxisId, IDualAxisAxisConfig>>;
}

export const ELECTRICAL_DUAL_AXIS_WIDGET_META: Readonly<Record<TDualAxisWidgetType, IDualAxisWidgetChartMeta>> = {
  'widget-bms': {
    expansionMode: 'bms-battery-tree',
    metricOrder: ['soc', 'current'],
    metrics: {
      soc: {
        metric: 'soc',
        axisId: 'ySoc',
        pathSuffixes: ['.capacity.stateOfCharge', '.stateOfCharge'],
        transform: value => value * 100
      },
      current: {
        metric: 'current',
        axisId: 'yCurrent',
        pathSuffixes: ['.current'],
        transform: value => value
      }
    },
    axes: {
      ySoc: {
        axisId: 'ySoc',
        position: 'left',
        title: 'SoC (%)',
        tickSuffix: '%',
        min: 0,
        max: 100
      },
      yCurrent: {
        axisId: 'yCurrent',
        position: 'right',
        title: 'Current (A)',
        tickSuffix: 'A',
        drawOnChartArea: false
      }
    },
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
    expansionMode: 'solar-tree',
    metricOrder: ['panelPower', 'current'],
    metrics: {
      panelPower: {
        metric: 'panelPower',
        axisId: 'yPower',
        pathSuffixes: ['.panelPower'],
        transform: value => value / 1000
      },
      current: {
        metric: 'current',
        axisId: 'yCurrent',
        pathSuffixes: ['.current'],
        transform: value => value
      }
    },
    axes: {
      yPower: {
        axisId: 'yPower',
        position: 'left',
        title: 'Power (kW)',
        tickSuffix: 'kW'
      },
      yCurrent: {
        axisId: 'yCurrent',
        position: 'right',
        title: 'Current (A)',
        tickSuffix: 'A',
        drawOnChartArea: false
      }
    },
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
  },
  'widget-charger': {
    expansionMode: 'charger-tree',
    metricOrder: ['voltage', 'current'],
    metrics: {
      voltage: {
        metric: 'voltage',
        axisId: 'yVoltage',
        pathSuffixes: ['.voltage'],
        transform: value => value
      },
      current: {
        metric: 'current',
        axisId: 'yCurrent',
        pathSuffixes: ['.current'],
        transform: value => value
      }
    },
    axes: {
      yVoltage: {
        axisId: 'yVoltage',
        position: 'left',
        title: 'Voltage (V)',
        tickSuffix: 'V'
      },
      yCurrent: {
        axisId: 'yCurrent',
        position: 'right',
        title: 'Current (A)',
        tickSuffix: 'A',
        drawOnChartArea: false
      }
    },
    pathRules: [
      {
        metric: 'voltage',
        axisId: 'yVoltage',
        regex: /^electrical\.chargers\.([^.]+)\.voltage$/i
      },
      {
        metric: 'current',
        axisId: 'yCurrent',
        regex: /^electrical\.chargers\.([^.]+)\.current$/i
      }
    ]
  },
  'widget-inverter': {
    expansionMode: 'inverter-tree',
    metricOrder: ['voltage', 'current'],
    metrics: {
      voltage: {
        metric: 'voltage',
        axisId: 'yVoltage',
        pathSuffixes: ['.voltage'],
        transform: value => value
      },
      current: {
        metric: 'current',
        axisId: 'yCurrent',
        pathSuffixes: ['.current'],
        transform: value => value
      }
    },
    axes: {
      yVoltage: {
        axisId: 'yVoltage',
        position: 'left',
        title: 'Voltage (V)',
        tickSuffix: 'V'
      },
      yCurrent: {
        axisId: 'yCurrent',
        position: 'right',
        title: 'Current (A)',
        tickSuffix: 'A',
        drawOnChartArea: false
      }
    },
    pathRules: [
      {
        metric: 'voltage',
        axisId: 'yVoltage',
        regex: /^electrical\.inverters\.([^.]+)\.voltage$/i
      },
      {
        metric: 'current',
        axisId: 'yCurrent',
        regex: /^electrical\.inverters\.([^.]+)\.current$/i
      }
    ]
  },
  'widget-alternator': {
    expansionMode: 'alternator-tree',
    metricOrder: ['voltage', 'current'],
    metrics: {
      voltage: {
        metric: 'voltage',
        axisId: 'yVoltage',
        pathSuffixes: ['.voltage'],
        transform: value => value
      },
      current: {
        metric: 'current',
        axisId: 'yCurrent',
        pathSuffixes: ['.current'],
        transform: value => value
      }
    },
    axes: {
      yVoltage: {
        axisId: 'yVoltage',
        position: 'left',
        title: 'Voltage (V)',
        tickSuffix: 'V'
      },
      yCurrent: {
        axisId: 'yCurrent',
        position: 'right',
        title: 'Current (A)',
        tickSuffix: 'A',
        drawOnChartArea: false
      }
    },
    pathRules: [
      {
        metric: 'voltage',
        axisId: 'yVoltage',
        regex: /^electrical\.alternators\.([^.]+)\.voltage$/i
      },
      {
        metric: 'current',
        axisId: 'yCurrent',
        regex: /^electrical\.alternators\.([^.]+)\.current$/i
      }
    ]
  },
  'widget-ac': {
    expansionMode: 'ac-tree',
    metricOrder: ['voltage', 'current', 'frequency'],
    metrics: {
      voltage: {
        metric: 'voltage',
        axisId: 'yVoltage',
        pathSuffixes: ['.line1.voltage', '.line2.voltage', '.line3.voltage'],
        transform: value => value
      },
      current: {
        metric: 'current',
        axisId: 'yCurrent',
        pathSuffixes: ['.line1.current', '.line2.current', '.line3.current'],
        transform: value => value
      },
      frequency: {
        metric: 'frequency',
        axisId: 'yFrequency',
        pathSuffixes: ['.line1.frequency', '.line2.frequency', '.line3.frequency'],
        transform: value => value
      }
    },
    axes: {
      yVoltage: {
        axisId: 'yVoltage',
        position: 'left',
        title: 'Voltage (V)',
        tickSuffix: 'V'
      },
      yCurrent: {
        axisId: 'yCurrent',
        position: 'right',
        title: 'Current (A)',
        tickSuffix: 'A',
        drawOnChartArea: false
      },
      yFrequency: {
        axisId: 'yFrequency',
        position: 'left',
        title: 'Frequency (Hz)',
        tickSuffix: 'Hz',
        drawOnChartArea: false
      }
    },
    pathRules: [
      {
        metric: 'voltage',
        axisId: 'yVoltage',
        regex: /^electrical\.ac\.([^.]+)\.line[123]\.voltage$/i
      },
      {
        metric: 'current',
        axisId: 'yCurrent',
        regex: /^electrical\.ac\.([^.]+)\.line[123]\.current$/i
      },
      {
        metric: 'frequency',
        axisId: 'yFrequency',
        regex: /^electrical\.ac\.([^.]+)\.line[123]\.frequency$/i
      }
    ]
  }
};

const ELECTRICAL_EXPANSION_MODE_TO_WIDGET: Readonly<Record<TElectricalExpansionMode, TDualAxisWidgetType>> = {
  'bms-battery-tree': 'widget-bms',
  'solar-tree': 'widget-solar-charger',
  'charger-tree': 'widget-charger',
  'inverter-tree': 'widget-inverter',
  'alternator-tree': 'widget-alternator',
  'ac-tree': 'widget-ac'
};

export function isDualAxisWidgetType(value: string | null | undefined): value is TDualAxisWidgetType {
  return !!value && value in ELECTRICAL_DUAL_AXIS_WIDGET_META;
}

export function getElectricalWidgetChartMeta(widgetType: TDualAxisWidgetType): IDualAxisWidgetChartMeta {
  return ELECTRICAL_DUAL_AXIS_WIDGET_META[widgetType];
}

export function getTemplateMetricSuffixesForExpansionMode(expansionMode: TElectricalExpansionMode): string[] {
  const widgetType = ELECTRICAL_EXPANSION_MODE_TO_WIDGET[expansionMode];
  const widgetMeta = ELECTRICAL_DUAL_AXIS_WIDGET_META[widgetType];
  const orderedSuffixes: string[] = [];

  widgetMeta.metricOrder.forEach(metric => {
    const metricMeta = widgetMeta.metrics[metric];
    if (!metricMeta) {
      return;
    }

    metricMeta.pathSuffixes.forEach(suffix => {
      if (!orderedSuffixes.includes(suffix)) {
        orderedSuffixes.push(suffix);
      }
    });
  });

  return orderedSuffixes;
}

export function transformDualAxisMetricValue(descriptor: IDualAxisSeriesDescriptor, value: number): number {
  const metricMeta = ELECTRICAL_DUAL_AXIS_WIDGET_META[descriptor.widgetType].metrics[descriptor.metric];
  if (!metricMeta) {
    return value;
  }

  return metricMeta.transform(value);
}

export function getAxisConfigsForWidget(widgetType: TDualAxisWidgetType): IDualAxisAxisConfig[] {
  const widgetMeta = ELECTRICAL_DUAL_AXIS_WIDGET_META[widgetType];
  const axisOrder: TDualAxisAxisId[] = [];

  widgetMeta.metricOrder.forEach(metric => {
    const axisId = widgetMeta.metrics[metric]?.axisId;
    if (!axisId || axisOrder.includes(axisId)) {
      return;
    }

    axisOrder.push(axisId);
  });

  return axisOrder
    .map(axisId => widgetMeta.axes[axisId])
    .filter((axis): axis is IDualAxisAxisConfig => !!axis);
}

export function resolveDualAxisWidgetTypeFromDatasets(
  widgetTypeRaw: string | null | undefined,
  axisIds: readonly (string | null | undefined)[]
): TDualAxisWidgetType | null {
  if (!isDualAxisWidgetType(widgetTypeRaw)) {
    return null;
  }

  const axisConfig = getAxisConfigsForWidget(widgetTypeRaw);
  const expectedAxisIds = new Set(axisConfig.map(axis => axis.axisId));
  if (expectedAxisIds.size === 0) {
    return null;
  }

  const hasKnownAxis = axisIds.some(axisId => !!axisId && expectedAxisIds.has(axisId as TDualAxisAxisId));
  return hasKnownAxis ? widgetTypeRaw : null;
}

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
