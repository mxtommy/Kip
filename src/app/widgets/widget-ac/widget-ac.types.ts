import type { TState } from '../../core/interfaces/signalk-interfaces';
import type { IElectricalTopologySnapshotCore } from '../../core/contracts/electrical-topology-card.contract';
export type {
  ElectricalFamilyConfig as AcWidgetConfig,
  ElectricalGroupConfig,
  ElectricalCardModeConfig
} from '../../core/interfaces/widgets-interface';

export interface AcSnapshot extends IElectricalTopologySnapshotCore {
  line1Voltage?: number | null;
  line1VoltageState?: TState | null;
  line1Current?: number | null;
  line1CurrentState?: TState | null;
  line1Frequency?: number | null;
  line1FrequencyState?: TState | null;

  line2Voltage?: number | null;
  line2VoltageState?: TState | null;
  line2Current?: number | null;
  line2CurrentState?: TState | null;
  line2Frequency?: number | null;
  line2FrequencyState?: TState | null;

  line3Voltage?: number | null;
  line3VoltageState?: TState | null;
  line3Current?: number | null;
  line3CurrentState?: TState | null;
  line3Frequency?: number | null;
  line3FrequencyState?: TState | null;

  mode?: string | null;
  modeState?: TState | null;
}

export interface AcDisplayModel {
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
