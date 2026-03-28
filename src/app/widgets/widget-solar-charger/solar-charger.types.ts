import type { TState } from '../../core/interfaces/signalk-interfaces';
export type { SolarOptionConfig, SolarWidgetConfig } from '../../core/interfaces/widgets-interface';

export interface SolarChargerSnapshot {
  id: string;
  name?: string | null;
  location?: string | null;
  associatedBus?: string | null;
  voltage?: number | null;
  current?: number | null;
  currentState?: TState | null;
  power?: number | null;
  rawBatteryPower?: number | null;
  temperature?: number | null;
  chargingAlgorithm?: string | null;
  chargerRole?: string | null;
  chargingMode?: string | null;
  setpointVoltage?: number | null;
  setpointCurrent?: number | null;
  controllerMode?: string | null;
  panelVoltage?: number | null;
  panelCurrent?: number | null;
  panelCurrentState?: TState | null;
  panelPower?: number | null;
  panelPowerState?: TState | null;
  rawPanelPower?: number | null;
  panelTemperature?: number | null;
  load?: string | number | boolean | null;
  loadCurrent?: number | null;
}

export interface SolarChargerDisplayModel {
  id: string;
  titleText: string;
  panelPowerText: string;
  panelPowerUnitText: string;
  panelPowerColor: string;
  chargerCurrentTextColor: string;
  gaugeProgress: number;
  gaugeSectionText: string;
  chargerMode: string;
  chargerSectionCurrent: string;
  chargerSectionMetadata: string;
  relaySectionVisible: boolean;
  relaySectionText: string;
}
