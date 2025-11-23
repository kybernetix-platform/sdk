import { KybernetixManager } from '../provider';
import {
  IManagerOptions,
  IDeclareFeatureOptions,
  IDeclareFeatureMeta,
  ComposedDeclareFeatureOptions,
} from '../types/provider';

describe('KybernetixManager', () => {
  let fetchMock: jest.Mock;

  beforeAll(() => {
    // Mock global fetch
    fetchMock = jest.fn();
    global.fetch = fetchMock;

    // Mock window.location.origin (используется в getFeatures)
    (global as any).window = {
      location: {
        origin: 'https://test.origin',
      },
    };
  });

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.mockReset();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const createManager = (opts: Partial<IManagerOptions> = {}) => {
    const base: IManagerOptions = {
      publicKey: 'test-public-key',
      apiUrl: 'https://api.platform.kybernetix.ru',
      privateKey: 'test-private-key',
    };
    return new KybernetixManager({ ...base, ...opts });
  };

  const createMockResponse = (data: any, ok = true, status = 200) => ({
    ok,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest
      .fn()
      .mockResolvedValue(
        typeof data === 'string' ? data : JSON.stringify(data)
      ),
  });

  // ----------------------
  // init()
  // ----------------------

  it('init() should fetch features and start interval polling', async () => {
    const mockFeatures: Record<string, ComposedDeclareFeatureOptions> = {
      featureA: {
        times: [],
        enabled: true,
      },
    };

    fetchMock.mockResolvedValueOnce(createMockResponse(mockFeatures));

    const manager = createManager();

    await manager.init();

    // первый вызов fetch — в init() через getFeatures()
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://test.origin/v1/sdk/feature/?publicKey=test-public-key',
      expect.objectContaining({
        method: 'GET',
      })
    );

    // Проверяем, что features записались
    expect((manager as any).declaredFeatures).toEqual(mockFeatures);

    // Эмулируем тики таймера и проверяем, что getFeatures дергается по интервалу
    fetchMock.mockResolvedValue(createMockResponse(mockFeatures));
    jest.advanceTimersByTime(10_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // ----------------------
  // destroy()
  // ----------------------

  it('destroy() should stop interval and clear declaredFeatures', async () => {
    const mockFeatures: Record<string, ComposedDeclareFeatureOptions> = {
      featureA: { times: [], enabled: true },
    };

    fetchMock.mockResolvedValue(createMockResponse(mockFeatures));

    const manager = createManager();
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    await manager.init();

    expect(Object.keys((manager as any).declaredFeatures)).toHaveLength(1);

    manager.destroy();

    // inited должно стать false
    expect((manager as any).inited).toBe(false);
    // локальный кэш должен очиститься
    expect((manager as any).declaredFeatures).toEqual({});
    // clearInterval должен быть вызван
    expect(clearIntervalSpy).toHaveBeenCalledWith((manager as any).interval);

    clearIntervalSpy.mockRestore();

    // После destroy таймер больше не должен триггерить fetch
    fetchMock.mockClear();
    jest.advanceTimersByTime(20_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ----------------------
  // declareFeature()
  // ----------------------

  it('declareFeature() should create feature if it does not exist', async () => {
    const manager = createManager();

    // Подменяем приватный createFeature на мок
    const createFeatureMock = jest.fn();
    (manager as any).createFeature = createFeatureMock;

    manager.declareFeature('newFeature', { times: [] });

    expect(createFeatureMock).toHaveBeenCalledTimes(1);
    expect(createFeatureMock).toHaveBeenCalledWith('newFeature', { times: [] });
  });

  it('declareFeature() should not create feature if it already exists', () => {
    const manager = createManager();

    const existingFeature: {
      options: IDeclareFeatureOptions;
      meta: IDeclareFeatureMeta;
    } = {
      options: { times: [] },
      meta: { enabled: true },
    };

    (manager as any).declaredFeatures['existingFeature'] = existingFeature;

    const createFeatureMock = jest.fn();
    (manager as any).createFeature = createFeatureMock;

    manager.declareFeature('existingFeature', { times: [] });

    expect(createFeatureMock).not.toHaveBeenCalled();
  });

  // ----------------------
  // isEnabled()
  // ----------------------

  it('isEnabled() should return meta.enabled if feature exists', () => {
    const manager = createManager();

    (manager as any).declaredFeatures['flag'] = {
      options: { times: [] },
      meta: { enabled: true },
    };

    expect(manager.isEnabled('flag')).toBe(true);

    (manager as any).declaredFeatures['flag'].meta.enabled = false;
    expect(manager.isEnabled('flag')).toBe(false);
  });

  it('isEnabled() should create feature with empty times if it does not exist and return false', () => {
    const manager = createManager();

    const createFeatureMock = jest.fn();
    (manager as any).createFeature = createFeatureMock;

    const result = manager.isEnabled('unknownFlag');

    expect(result).toBe(false);
    expect(createFeatureMock).toHaveBeenCalledTimes(1);
    expect(createFeatureMock).toHaveBeenCalledWith('unknownFlag', {
      times: [],
    });
  });

  // ----------------------
  // createFeature()
  // ----------------------

  it('createFeature() should return null if privateKey is missing', async () => {
    const manager = createManager({ privateKey: undefined });

    const result = await (manager as any).createFeature('noPrivateKey', {
      times: [],
    });

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createFeature() should POST to /v1/sdk/feature/ and return JSON on success', async () => {
    const manager = createManager();

    const serverResponse = { success: true };
    fetchMock.mockResolvedValueOnce(createMockResponse(serverResponse));

    const result = await (manager as any).createFeature('testFeature', {
      times: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/v1/sdk/feature/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        featureName: 'testFeature',
        privateKey: 'test-private-key',
        times: [],
      }),
    });

    expect(result).toEqual(serverResponse);
  });

  it('createFeature() should throw on non-ok response', async () => {
    const manager = createManager();

    const errorBody = 'Some error';
    const mockResp = createMockResponse(errorBody, false, 500);
    fetchMock.mockResolvedValueOnce(mockResp as any);

    await expect(
      (manager as any).createFeature('brokenFeature', { times: [] })
    ).rejects.toThrow('Failed to create feature: 500 - Some error');
  });

  // ----------------------
  // getFeatures()
  // ----------------------

  it('getFeatures() should throw if publicKey is missing', async () => {
    const manager = createManager({ publicKey: undefined as any });

    await expect((manager as any).getFeatures()).rejects.toThrow(
      'Public key is missing. Please provide a valid publicKey in the SDK configuration.'
    );
  });

  it('getFeatures() should fetch and set declaredFeatures on success', async () => {
    const manager = createManager();

    const featuresFromServer: Record<string, ComposedDeclareFeatureOptions> = {
      featureX: { times: [], enabled: true },
      featureY: { times: [], enabled: false },
    };

    fetchMock.mockResolvedValueOnce(createMockResponse(featuresFromServer));

    await (manager as any).getFeatures();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://test.origin/v1/sdk/feature/?publicKey=test-public-key',
      expect.objectContaining({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    expect((manager as any).declaredFeatures).toEqual(featuresFromServer);
  });

  it('getFeatures() should throw on non-ok response when not inited yet', async () => {
    const manager = createManager();

    // inited по умолчанию false
    const mockResp = createMockResponse('Get error', false, 500);
    fetchMock.mockResolvedValueOnce(mockResp as any);

    await expect((manager as any).getFeatures()).rejects.toThrow(
      'Failed to get features: 500 - Get error'
    );
  });

  it('getFeatures() should NOT throw on non-ok response when already inited', async () => {
    const manager = createManager();

    (manager as any).inited = true;

    const mockResp = createMockResponse('Get error', false, 500);
    fetchMock.mockResolvedValueOnce(mockResp as any);

    // Ошибку не кидает
    await expect((manager as any).getFeatures()).resolves.toBeUndefined();
  });

  // ----------------------
  // getLocalFeature()
  // ----------------------

  it('getLocalFeature() should return feature from declaredFeatures', () => {
    const manager = createManager();

    const feature: {
      options: IDeclareFeatureOptions;
      meta: IDeclareFeatureMeta;
    } = {
      options: { times: [] },
      meta: { enabled: true },
    };

    (manager as any).declaredFeatures['someFeature'] = feature;

    const result = (manager as any).getLocalFeature('someFeature');
    const missing = (manager as any).getLocalFeature('missingFeature');

    expect(result).toBe(feature);
    expect(missing).toBeUndefined();
  });
});
