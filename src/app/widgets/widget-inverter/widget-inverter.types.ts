import type { TState } from '../../core/interfaces/signalk-interfaces';
import type { IElectricalTopologySnapshotCore } from '../../core/contracts/electrical-topology-card.contract';
export type {
  ElectricalFamilyConfig as InverterWidgetConfig,
  ElectricalGroupConfig,
  ElectricalCardModeConfig
} from '../../core/interfaces/widgets-interface';

export interface InverterSnapshot extends IElectricalTopologySnapshotCore {
  // DC input side
  dcVoltage?: number | null;
  dcVoltageState?: TState | null;
  dcCurrent?: number | null;
  dcCurrentState?: TState | null;
  // AC output side
  acVoltage?: number | null;
  acVoltageState?: TState | null;
  acCurrent?: number | null;
  acCurrentState?: TState | null;
  acFrequency?: number | null;
  acFrequencyState?: TState | null;
  // Derived
  dcPower?: number | null;
  dcPowerState?: TState | null;
  // State
  inverterMode?: string | null;
  inverterModeState?: TState | null;
  temperature?: number | null;
  temperatureState?: TState | null;
}

export interface InverterDisplayModel {
  id: string;
  titleText: string;
  modeText: string;
  busText: string;
  metricsLineOne: string;
  metricsLineTwo: string;
  stateBarColor: string;
  titleTextColor: string;
  metaTextColor: string;
  primaryMetricsTextColor: string;
  secondaryMetricsTextColor: string;
}
