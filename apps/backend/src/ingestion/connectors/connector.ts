export type ConnectorConfig = Record<string, string>;

export type RawDocument = {
  filename: string;
  content: string;
  sourceType: string;
  sourceUri?: string;
};

export interface Connector {
  readonly type: string;
  fetch(name: string, config: ConnectorConfig): Promise<RawDocument[]>;
}
