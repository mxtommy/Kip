export type ElectricalCardDisplayMode = 'full' | 'compact';

export interface IElectricalCardModeConfig {
  displayMode?: ElectricalCardDisplayMode;
  metrics: string[];
}

export interface IElectricalTopologySnapshotCore {
  id: string;
  source?: string | null;
  deviceKey?: string;
  name?: string | null;
  location?: string | null;
  associatedBus?: string | null;
  voltage?: number | null;
  current?: number | null;
  power?: number | null;
}
