import {
  IDeclareFeatureOptions,
  IDeclareFeatureMeta,
  IManagerOptions,
} from './types/provider';

/**
 * Manager for interacting with Kybernetix Feature Flags.
 * Handles feature declaration, loading remote states, and periodic syncing.
 */
export class KybernetixManager {
  /** Indicates whether initialization has completed */
  private inited = false;
  /** Interval handler for periodic feature refreshing */
  private interval: NodeJS.Timeout | null = null;
  /** Options passed to the manager (merged with defaults) */
  private options: Partial<IManagerOptions>;
  /**
   * Local cache of declared features and their metadata.
   * Keyed by feature name.
   */
  private declaredFeatures: Record<
    string,
    { options: IDeclareFeatureOptions; meta: IDeclareFeatureMeta }
  > = {};

  /**
   * @param opts Manager configuration (publicKey, privateKey, apiUrl, etc.)
   */
  constructor(protected readonly opts: IManagerOptions) {
    this.options = { apiUrl: 'https://api.platform.kybernetix.ru', ...opts };
    this.interval = null;
  }

  /**
   * Initializes the manager:
   * - Fetches the initial feature list from the server
   * - Starts periodic polling every 10 seconds
   */
  public async init() {
    await this.getFeatures();

    this.interval = setInterval(() => {
      this.getFeatures();
    }, 10_000);

    this.inited = true;
  }

  /**
   * Destroys the manager:
   * - Stops the periodic sync
   * - Clears all locally declared features
   */
  public destroy() {
    this.inited = false;
    if (this.interval) clearInterval(this.interval);
    this.declaredFeatures = {};
  }

  /**
   * Declares a feature locally.
   * If the feature has not been loaded or created yet, it triggers creation.
   *
   * @param featureName Name of the feature
   * @param options Declaration settings (e.g., times)
   */
  declareFeature(featureName: string, options: IDeclareFeatureOptions) {
    const feature = this.getLocalFeature(featureName);

    if (!feature) {
      this.createFeature(featureName, options);
    }
  }

  /**
   * Checks whether a feature is enabled.
   * If the feature does not exist locally, it will be created with empty options.
   *
   * @param featureName Name of the feature
   * @returns `true` if enabled, otherwise `false`
   */
  isEnabled(featureName: string) {
    const feature = this.getLocalFeature(featureName);

    if (!feature) {
      this.createFeature(featureName, { times: [] });

      return false;
    }

    return feature.meta.enabled;
  }

  /**
   * Creates a new feature on the server.
   * Requires a privateKey; otherwise the request is ignored.
   *
   * @param featureName Name of the feature
   * @param options Feature declaration options
   * @returns Created feature data or null if privateKey is missing
   */
  private async createFeature(
    featureName: string,
    options: IDeclareFeatureOptions
  ) {
    if (!this.options.privateKey) {
      return null;
    }

    const response = await fetch('/v1/sdk/feature/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        featureName,
        privateKey: this.options.privateKey,
        ...options,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create feature: ${response.status} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Fetches all features associated with the publicKey.
   * Populates the local `declaredFeatures` cache.
   *
   * Throws an error only during initial initialization;
   * later polling failures are ignored.
   */
  private async getFeatures() {
    if (!this.options.publicKey) {
      throw new Error(
        'Public key is missing. Please provide a valid publicKey in the SDK configuration.'
      );
    }

    const url = new URL('/v1/sdk/feature/', window.location.origin);
    url.searchParams.append('publicKey', this.options.publicKey);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok && !this.inited) {
      const errorText = await response.text();
      throw new Error(
        `Failed to get features: ${response.status} - ${errorText}`
      );
    }

    this.declaredFeatures = await response.json();
  }

  /**
   * Returns a locally cached feature by name.
   *
   * @param featureName Name of the feature
   * @returns The feature or undefined if it does not exist
   */
  private getLocalFeature(featureName: string) {
    return this.declaredFeatures[featureName];
  }
}
