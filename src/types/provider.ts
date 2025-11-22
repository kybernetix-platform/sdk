export interface IManagerOptions {
  apiUrl?: string;
  publicKey: string;
  privateKey?: string;
}

interface IDeclareFeatureTime {
  start: Date;
  end?: Date;
}

export interface IDeclareFeatureOptions {
  times: IDeclareFeatureTime[];
}

export interface IDeclareFeatureMeta {
  enabled: boolean;
}

export type ComposedDeclareFeatureOptions = IDeclareFeatureOptions &
  IDeclareFeatureMeta;
