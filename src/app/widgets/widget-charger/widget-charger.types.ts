import type { TState } from '../../core/interfaces/signalk-interfaces';
import type { IElectricalTopologySnapshotCore } from '../../core/contracts/electrical-topology-card.contract';
export type {
  ElectricalFamilyConfig as ChargerWidgetConfig,
  ElectricalGroupConfig,
  ElectricalCardModeConfig
} from '../../core/interfaces/widgets-interface';

export interface ChargerSnapshot extends IElectricalTopologySnapshotCore {
  state?: string | null;
  stateState?: TState | null;
  offReason?: string | null;
  offReasonState?: TState | null;
  error?: string | null;
  errorState?: TState | null;
  mode?: string | null;
  modeState?: TState | null;
  modeNumber?: number | null;
  modeNumberState?: TState | null;
  chargingModeNumber?: number | null;
  chargingModeNumberState?: TState | null;
  inputVoltage?: number | null;
  inputVoltageState?: TState | null;
  outputVoltage?: number | null;
  outputVoltageState?: TState | null;
  voltageState?: TState | null;
  currentState?: TState | null;
  rawPower?: number | null;
  powerState?: TState | null;
  temperature?: number | null;
  temperatureState?: TState | null;
  chargingMode?: string | null;
  chargingModeState?: TState | null;
  ledsAbsorption?: boolean | null;
  ledsAbsorptionState?: TState | null;
  ledsBulk?: boolean | null;
  ledsBulkState?: TState | null;
  ledsFloat?: boolean | null;
  ledsFloatState?: TState | null;
  ledsInverter?: boolean | null;
  ledsInverterState?: TState | null;
  ledsLowBattery?: boolean | null;
  ledsLowBatteryState?: TState | null;
  ledsMains?: boolean | null;
  ledsMainsState?: TState | null;
  ledsOverload?: boolean | null;
  ledsOverloadState?: TState | null;
  ledsTemperature?: boolean | null;
  ledsTemperatureState?: TState | null;
}

export interface ChargerDisplayModel {
  id: string;
  source?: string | null;
  deviceKey?: string;
  titleText: string;
  modeText: string;
  metricsLineOne: string;
  metricsLineTwo: string;
  stateBarColor: string;
  titleTextColor: string;
  metaTextColor: string;
  primaryMetricsTextColor: string;
  secondaryMetricsTextColor: string;
}
