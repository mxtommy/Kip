export type ElectricalCardDisplayMode = 'full' | 'card';

export interface IElectricalCardModeConfig {
  enabled: boolean;
  displayMode?: ElectricalCardDisplayMode;
  metrics: string[];
}

export interface IElectricalTopologySnapshotCore {
  id: string;
  name?: string | null;
  location?: string | null;
  associatedBus?: string | null;
  voltage?: number | null;
  current?: number | null;
  power?: number | null;
}
