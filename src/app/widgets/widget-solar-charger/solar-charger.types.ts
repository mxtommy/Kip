import type { TState } from '../../core/interfaces/signalk-interfaces';
export type { SolarOptionConfig, SolarWidgetConfig } from '../../core/interfaces/widgets-interface';

export interface SolarChargerSnapshot {
  id: string;
  name?: string | null;
  location?: string | null;
  associatedBus?: string | null;
  voltage?: number | null;
  voltageState?: TState | null;
  current?: number | null;
  currentState?: TState | null;
  power?: number | null;
  rawBatteryPower?: number | null;
  temperature?: number | null;
  temperatureState?: TState | null;
  chargingAlgorithm?: string | null;
  chargerRole?: string | null;
  chargingMode?: string | null;
  setpointVoltage?: number | null;
  setpointCurrent?: number | null;
  controllerMode?: string | null;
  panelVoltage?: number | null;
  panelVoltageState?: TState | null;
  panelCurrent?: number | null;
  panelCurrentState?: TState | null;
  panelPower?: number | null;
  panelPowerState?: TState | null;
  rawPanelPower?: number | null;
  yieldToday?: number | null;
  yieldYesterday?: number | null;
  panelTemperature?: number | null;
  panelTemperatureState?: TState | null;
  load?: string | number | boolean | null;
  loadCurrent?: number | null;
  loadCurrentState?: TState | null;
}

export interface SolarChargerDisplayModel {
  id: string;
  titleText: string;
  panelPowerText: string;
  panelPowerUnitText: string;
  panelPowerColor: string;
  panelPowerGlowEnabled: boolean;
  chargerCurrentTextColor: string;
  chargerMetaTextColor: string;
  panelValuesTextColor: string;
  panelValuesGlowEnabled: boolean;
  gaugeProgress: number;
  gaugeSectionText: string;
  yieldText: string;
  chargerMode: string;
  chargerSectionCurrent: string;
  chargerSectionMetadata: string;
  relaySectionVisible: boolean;
  relaySectionText: string;
  relayValuesTextColor: string;
}
