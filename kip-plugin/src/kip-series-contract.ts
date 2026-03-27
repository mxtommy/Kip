export type THistoryMethod = 'min' | 'max' | 'avg' | 'sma' | 'ema';

interface IKipSeriesDefinitionBase {
  seriesId: string;
  datasetUuid: string;
  ownerWidgetUuid: string;
  ownerWidgetSelector: string | null;
  path: string;
  source?: string | null;
  context?: string | null;
  timeScale?: string | null;
  period?: number | null;
  retentionDurationMs?: number | null;
  sampleTime?: number | null;
  enabled: boolean;
  methods?: readonly THistoryMethod[];
  reconcileTs?: number;
}

export interface IKipConcreteSeriesDefinition extends IKipSeriesDefinitionBase {
  expansionMode?: null;
  allowedBatteryIds?: null;
  allowedChargerIds?: null;
}

export interface IBmsTemplateSeriesDefinition extends IKipSeriesDefinitionBase {
  ownerWidgetSelector: 'widget-bms';
  expansionMode: 'bms-battery-tree';
  allowedBatteryIds?: readonly string[] | null;
  allowedChargerIds?: null;
}

export interface ISolarTemplateSeriesDefinition extends IKipSeriesDefinitionBase {
  ownerWidgetSelector: 'widget-solar-charger';
  expansionMode: 'solar-charger-tree';
  allowedBatteryIds?: null;
  allowedChargerIds?: readonly string[] | null;
}

export type IKipTemplateSeriesDefinition = IBmsTemplateSeriesDefinition | ISolarTemplateSeriesDefinition;

export type IKipSeriesDefinition = IKipConcreteSeriesDefinition | IKipTemplateSeriesDefinition;

export function isKipTemplateSeriesDefinition(series: IKipSeriesDefinition): series is IKipTemplateSeriesDefinition {
  return series.expansionMode === 'bms-battery-tree' || series.expansionMode === 'solar-charger-tree';
}

export function isKipBmsTemplateSeriesDefinition(series: IKipSeriesDefinition): series is IBmsTemplateSeriesDefinition {
  return series.expansionMode === 'bms-battery-tree';
}

export function isKipSolarTemplateSeriesDefinition(series: IKipSeriesDefinition): series is ISolarTemplateSeriesDefinition {
  return series.expansionMode === 'solar-charger-tree';
}

export function isKipConcreteSeriesDefinition(series: IKipSeriesDefinition): series is IKipConcreteSeriesDefinition {
  return series.expansionMode == null;
}

export function isKipSeriesEnabled(series: Pick<IKipSeriesDefinitionBase, 'enabled'>): boolean {
  return series.enabled;
}
