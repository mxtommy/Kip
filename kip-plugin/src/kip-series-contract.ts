export type THistoryMethod = 'min' | 'max' | 'avg' | 'sma' | 'ema';

export type TElectricalFamilyKey = 'batteries' | 'solar' | 'chargers' | 'inverters' | 'alternators' | 'ac';
export type TElectricalExpansionMode = 'bms-battery-tree' | 'solar-tree' | 'charger-tree' | 'inverter-tree' | 'alternator-tree' | 'ac-tree';

export interface IElectricalTrackedDeviceRef {
  id: string;
  source: string;
}

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
  familyKey?: null;
  allowedIds?: null;
  trackedDevices?: null;
}

export interface IElectricalTemplateSeriesDefinition extends IKipSeriesDefinitionBase {
  ownerWidgetSelector:
  | 'widget-bms'
  | 'widget-solar-charger'
  | 'widget-charger'
  | 'widget-inverter'
  | 'widget-alternator'
  | 'widget-ac';
  expansionMode: TElectricalExpansionMode;
  familyKey?: TElectricalFamilyKey | null;
  allowedIds?: readonly string[] | null;
  trackedDevices?: readonly IElectricalTrackedDeviceRef[] | null;
}

export type IKipTemplateSeriesDefinition = IElectricalTemplateSeriesDefinition;

/** @deprecated Use IElectricalTemplateSeriesDefinition */
export type IBmsTemplateSeriesDefinition = IElectricalTemplateSeriesDefinition;
/** @deprecated Use IElectricalTemplateSeriesDefinition */
export type ISolarTemplateSeriesDefinition = IElectricalTemplateSeriesDefinition;

export type IKipSeriesDefinition = IKipConcreteSeriesDefinition | IKipTemplateSeriesDefinition;

export function isKipTemplateSeriesDefinition(series: IKipSeriesDefinition): series is IKipTemplateSeriesDefinition {
  return series.expansionMode === 'bms-battery-tree'
    || series.expansionMode === 'solar-tree'
    || series.expansionMode === 'charger-tree'
    || series.expansionMode === 'inverter-tree'
    || series.expansionMode === 'alternator-tree'
    || series.expansionMode === 'ac-tree';
}

export function isKipElectricalTemplateSeriesDefinition(series: IKipSeriesDefinition): series is IElectricalTemplateSeriesDefinition {
  return isKipTemplateSeriesDefinition(series);
}

export function isKipBmsTemplateSeriesDefinition(series: IKipSeriesDefinition): series is IBmsTemplateSeriesDefinition {
  return series.expansionMode === 'bms-battery-tree' && (series.familyKey == null || series.familyKey === 'batteries');
}

export function isKipSolarTemplateSeriesDefinition(series: IKipSeriesDefinition): series is ISolarTemplateSeriesDefinition {
  return series.expansionMode === 'solar-tree' && (series.familyKey == null || series.familyKey === 'solar');
}

export function isKipConcreteSeriesDefinition(series: IKipSeriesDefinition): series is IKipConcreteSeriesDefinition {
  return series.expansionMode == null;
}

export function isKipSeriesEnabled(series: Pick<IKipSeriesDefinitionBase, 'enabled'>): boolean {
  return series.enabled;
}
