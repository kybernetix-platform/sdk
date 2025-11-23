# Kybernetix SDK

A lightweight client-side SDK for working with **Kybernetix Platform**.  
It allows you to:

- Declare features programmatically  
- Auto-create features on the server  
- Check whether a feature is enabled  
- Periodically sync feature states  
- Manage feature definitions (options + metadata)

The SDK includes full TypeScript types and a Jest test suite.

---

## 🚀 Installation

```sh
npm install @kybernetix/manager
# or
yarn add @kybernetix/manager
```

---

## 📦 Usage

### Initialize the manager

```ts
import { KybernetixManager } from '@kybernetix/sdk';

const manager = new KybernetixManager({
  publicKey: 'YOUR_PUBLIC_KEY',
  privateKey: 'YOUR_PRIVATE_KEY', // optional for read-only mode
});

await manager.init();
```

### Declare a feature

```ts
manager.declareFeature('newFeature', {
  times: [
    {
      start: new Date(),
    },
  ],
});
```

If the feature does not exist on the server and you provided a `privateKey`,  
the SDK will automatically create it.

### Check if a feature is enabled

```ts
if (manager.isEnabled('newFeature')) {
  console.log('Feature is enabled!');
}
```

If the feature has not been declared yet, a placeholder is created automatically  
and `false` is returned.

---

## ⏳ Automatic Syncing

After calling `init()`, the manager:

- Loads all features using your `publicKey`
- Starts a **10-second interval** that refreshes feature states
- Keeps local cache in `declaredFeatures`

To stop syncing:

```ts
manager.destroy();
```

This clears the interval and resets the cache.

---

## 🧩 TypeScript Types

```ts
export interface IManagerOptions {
  apiUrl?: string;
  publicKey: string;
  privateKey?: string;
}

export interface IDeclareFeatureTime {
  start: Date;
  end?: Date;
}

export interface IDeclareFeatureOptions {
  times: IDeclareFeatureTime[];
}

export interface IDeclareFeatureMeta {
  enabled: boolean;
}

export type ComposedDeclareFeatureOptions = IDeclareFeatureOptions & IDeclareFeatureMeta;
```

---

## 🧪 Running Tests

This SDK comes with full Jest test coverage, including:

- Mocked `fetch` requests
- Interval polling behavior
- Feature creation
- Error handling
- Local cache logic

---

## 📘 Example: Full Integration

```ts
import { KybernetixManager } from '@kybernetix/sdk';

async function main() {
  const manager = new KybernetixManager({
    publicKey: 'pk_live_123',
    privateKey: 'sk_live_123',
  });

  await manager.init();

  manager.declareFeature('demoFeature', {
    times: [
      { start: new Date() },
    ],
  });

  if (manager.isEnabled('demoFeature')) {
    console.log('Demo feature is active!');
  }
}

main();
```

---

## 📄 License

MIT License.
