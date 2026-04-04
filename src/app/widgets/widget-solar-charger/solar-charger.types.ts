import type { TState } from '../../core/interfaces/signalk-interfaces';
import type { IElectricalTopologySnapshotCore } from '../../core/contracts/electrical-topology-card.contract';
import type { ElectricalFamilyConfig, SolarOptionConfig as SolarOptionConfigBase } from '../../core/interfaces/widgets-interface';
export type {
  SolarOptionConfig,
  ElectricalTrackedDevice,
  ElectricalGroupConfig,
  ElectricalCardModeConfig
} from '../../core/interfaces/widgets-interface';

export type SolarWidgetConfig = ElectricalFamilyConfig<SolarOptionConfigBase>;

export interface SolarChargerSnapshot extends IElectricalTopologySnapshotCore {
  voltageState?: TState | null;
  currentState?: TState | null;
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
  source?: string | null;
  deviceKey?: string;
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
  yieldTodayText: string;
  yieldYesterdayText: string;
  chargerMode: string;
  chargerSectionCurrent: string;
  chargerSectionMetadata: string;
  relaySectionVisible: boolean;
  relaySectionText: string;
  relayValuesTextColor: string;
}
