import type { TState } from '../../core/interfaces/signalk-interfaces';

export type BmsBankConnectionMode = 'parallel' | 'series';

export interface BmsBankConfig {
  id: string;
  name: string;
  batteryIds: string[];
  connectionMode: BmsBankConnectionMode;
}

export interface BmsWidgetConfig {
  trackedBatteryIds: string[];
  banks: BmsBankConfig[];
}

export interface BmsBatterySnapshot {
  id: string;
  name?: string | null;
  location?: string | null;
  chemistry?: string | null;
  voltage?: number | null;
  current?: number | null;
  power?: number | null;
  temperature?: number | null;
  capacityRemaining?: number | null;
  capacityNominal?: number | null;
  capacityActual?: number | null;
  stateOfCharge?: number | null;
  timeRemaining?: number | null;
  currentState?: TState | null;
  stateOfChargeState?: TState | null;
}

export interface BmsBankSummary {
  id: string;
  name: string;
  batteryIds: string[];
  totalCurrent: number | null;
  totalPower: number | null;
  avgSoc: number | null;
  remainingCapacity: number | null;
  timeRemaining: number | null;
}

export interface BmsBatteryDisplayModel {
  id: string;
  titleText: string;
  chargeWidth: number;
  chargeBarColorCompact: string;
  chargeBarColorRegular: string;
  currentTextColorCompact: string;
  currentTextColorRegular: string;
  currentStrokeWidth: number;
  currentText: string;
  detailLineCompact: string;
  detailLineRegular: string;
  socText: string;
  actualCapacityText: string;
  remainingText: string;
  iconKey: 'power_available' | 'power_renewal';
}

export interface BmsBankDisplayModel {
  id: string;
  titleText: string;
  currentText: string;
  powerText: string;
  socText: string;
  remainingText: string;
  remainingCapacityText: string;
  gaugeValuePath: string;
  gaugeValueColor: string;
  zoneState?: TState | null;
  zoneColor?: string | null;
}
