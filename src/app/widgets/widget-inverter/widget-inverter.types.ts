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
  // AC input side
  acInVoltage?: number | null;
  acInVoltageState?: TState | null;
  acInCurrent?: number | null;
  acInCurrentState?: TState | null;
  acInFrequency?: number | null;
  acInFrequencyState?: TState | null;
  acInPower?: number | null;
  acInPowerState?: TState | null;
  acIn1Available?: boolean | null;
  acIn1AvailableState?: TState | null;
  acIn1CurrentLimit?: number | null;
  acIn1CurrentLimitState?: TState | null;
  acInCurrentLimit?: number | null;
  acInCurrentLimitState?: TState | null;
  ignoreAcIn1?: boolean | null;
  ignoreAcIn1State?: TState | null;
  // AC output side
  acVoltage?: number | null;
  acVoltageState?: TState | null;
  acCurrent?: number | null;
  acCurrentState?: TState | null;
  acFrequency?: number | null;
  acFrequencyState?: TState | null;
  acOutVoltage?: number | null;
  acOutVoltageState?: TState | null;
  acOutCurrent?: number | null;
  acOutCurrentState?: TState | null;
  acOutFrequency?: number | null;
  acOutFrequencyState?: TState | null;
  acOutPower?: number | null;
  acOutPowerState?: TState | null;
  // Derived
  dcPower?: number | null;
  dcPowerState?: TState | null;
  // State
  inverterMode?: string | null;
  inverterModeState?: TState | null;
  inverterModeNumber?: number | null;
  inverterModeNumberState?: TState | null;
  temperature?: number | null;
  temperatureState?: TState | null;
  preferRenewableEnergy?: boolean | null;
  preferRenewableEnergyState?: TState | null;
  preferRenewableEnergyActive?: boolean | null;
  preferRenewableEnergyActiveState?: TState | null;
}

export interface InverterDisplayModel {
  id: string;
  source?: string | null;
  deviceKey?: string;
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
