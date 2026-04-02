import type { TState } from '../../core/interfaces/signalk-interfaces';
import type { IElectricalTopologySnapshotCore } from '../../core/contracts/electrical-topology-card.contract';
export type {
  ElectricalFamilyConfig as AlternatorWidgetConfig,
  ElectricalGroupConfig,
  ElectricalCardModeConfig
} from '../../core/interfaces/widgets-interface';

export interface AlternatorSnapshot extends IElectricalTopologySnapshotCore {
  voltageState?: TState | null;
  currentState?: TState | null;
  rawPower?: number | null;
  powerState?: TState | null;
  temperature?: number | null;
  temperatureState?: TState | null;
  chargingMode?: string | null;
  chargingModeState?: TState | null;
  revolutions?: number | null;
  revolutionsState?: TState | null;
  fieldDrive?: number | null;
  fieldDriveState?: TState | null;
  regulatorTemperature?: number | null;
  regulatorTemperatureState?: TState | null;
  setpointVoltage?: number | null;
  setpointVoltageState?: TState | null;
  setpointCurrent?: number | null;
  setpointCurrentState?: TState | null;
}

export interface AlternatorDisplayModel {
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
