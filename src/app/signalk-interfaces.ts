
export interface updateMessage {
  source: {
    label: string;
    type: string;
    pgn?: string;
    src?: string;
    talker?: string;
  };
  timestamp: string;
  values: {
    path: string;
    value: any;
  }[]
}

export interface deltaMessage {
  updates?: updateMessage[];
  requestId?: string;
  state?: string;
  statusCode?: number;
  context: string;
  self?: string;
  accessRequest?: {
    permission?: string;
    token?: string
  }
}
