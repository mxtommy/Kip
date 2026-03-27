import type { TState } from '../../core/interfaces/signalk-interfaces';
export type { SolarChargerOptionConfig, SolarChargerWidgetConfig } from '../../core/interfaces/widgets-interface';

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
  rawPanelPower?: number | null;
  panelTemperature?: number | null;
  load?: string | number | boolean | null;
  loadCurrent?: number | null;
}

export interface SolarChargerDisplayModel {
  id: string;
  titleText: string;
  busText: string;
  panelPowerText: string;
  panelPowerUnitText: string;
  panelPowerColor: string;
  gaugeProgress: number;
  gaugeValuePath: string;
  gaugeValueColor: string;
  gaugeSectionText: string;
  panelSectionColor: string;
  batterySectionText: string;
  batterySectionColor: string;
  relaySectionText: string;
  charger: string;
  chargerMetadata: string;
}
