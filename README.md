# MiniWeb

MiniWeb is a tiny web-stack simulator for static-hosted demos and fast Node-side integration tests.

It models:

- browser/frontend
- fake location/history/navigation
- client service worker
- network
- CDN/edge worker
- backend/origin
- virtual filesystem
- fake terminal
- fake delay
- streaming responses

Package: `@async/miniweb`

## Basic Usage

```ts
import { createMiniWeb } from '@async/miniweb';
import { helloApp } from './src/examples/hello-app/manifest.ts';

const web = await createMiniWeb({
  origin: 'http://localhost:3000',
  files: helloApp.files,
  app: helloApp.app,
  layers: {
    frontend: {
      kind: 'headless'
    },
    serviceWorker: {
      kind: 'fake'
    },
    network: {
      kind: 'blocked'
    },
    edge: {
      kind: 'bypass'
    },
    backend: {
      kind: 'fetch-app'
    }
  }
});

const response = await web.fetch('/about');
const html = await response.text();
```

## Node-Side E2E

```ts
import { createNodeMiniWeb } from '@async/miniweb/node';
import { helloApp } from './src/examples/hello-app/manifest.ts';

const web = await createNodeMiniWeb({
  origin: 'http://localhost:3000',
  files: helloApp.files,
  app: helloApp.app,
  layers: {
    frontend: {
      kind: 'node-dom'
    },
    serviceWorker: {
      kind: 'fake'
    },
    network: {
      kind: 'blocked'
    },
    edge: {
      kind: 'bypass'
    },
    backend: {
      kind: 'fetch-app'
    }
  }
});

await web.frontend.navigate('/');
await web.frontend.click('a[href="/about"]');
```

## Fake Edge Cache

```ts
import { createMiniWeb } from '@async/miniweb';

const web = await createMiniWeb({
  origin: 'http://localhost:3000',
  app,
  layers: {
    frontend: {
      kind: 'headless'
    },
    serviceWorker: {
      kind: 'bypass'
    },
    edge: {
      kind: 'fake',
      cache: {
        enabled: true,
        defaultTtl: 60,
        respectCacheControl: true
      }
    },
    backend: {
      kind: 'fetch-app'
    }
  }
});

await web.fetch('/assets/app.js');
await web.edge.cache.purgeAll();
```

## Streaming Response

```ts
import { createJsonLineStreamResponse } from '@async/miniweb';

export const app = {
  fetch() {
    return createJsonLineStreamResponse({
      values: [
        { type: 'start' },
        { type: 'done' }
      ],
      headers: {
        'content-type': 'application/x-ndjson'
      }
    });
  }
};
```

## MiniWeb Network

```ts
import { createMiniWeb, createMiniWebNetwork } from '@async/miniweb';

const network = createMiniWebNetwork();
const api = await createMiniWeb(apiConfig);
const web = await createMiniWeb({
  ...webConfig,
  network,
  layers: {
    ...webConfig.layers,
    network: {
      kind: 'miniweb-network'
    }
  }
});

network.register('https://api.local', api);
network.register('https://web.local', web);
const response = await web.fetch('https://api.local/events');
```

## Browser Shell Demo

```ts
import { createBrowserMiniWeb } from '@async/miniweb/browser';
import { helloApp } from './src/examples/hello-app/manifest.ts';

const frame = document.querySelector<HTMLIFrameElement>('#preview');
if (!frame) {
  throw new Error('Missing preview iframe');
}

const web = await createBrowserMiniWeb({
  origin: 'http://localhost:3000',
  files: helloApp.files,
  app: helloApp.app,
  layers: {
    frontend: {
      kind: 'browser-frame',
      frame
    },
    serviceWorker: {
      kind: 'fake'
    },
    network: {
      kind: 'blocked'
    },
    edge: {
      kind: 'fake',
      cache: {
        enabled: true,
        defaultTtl: 60,
        respectCacheControl: true
      }
    },
    backend: {
      kind: 'fetch-app'
    }
  }
});

await web.terminal.run('npm install');
await web.terminal.run('npm run dev');
await web.navigate('/');
```

Run the local shell:

```bash
npm run dev
```

## Non-Goals

MiniWeb is not a full Node.js VM.
MiniWeb does not run arbitrary npm packages.
MiniWeb does not provide real secrets, real auth, real TCP sockets, `child_process`, or native modules.
