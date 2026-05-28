# MiniWeb

MiniWeb is a tiny local web runtime for static-hosted demos and fast Node-side integration tests.

Package: `@async/miniweb`

MiniWeb lets browser-safe frontend code and browser-safe `app.fetch()` server code talk to each other through a real `Request -> Response` route graph. It is built for GitHub Pages-style demos, fake browsers, fake service workers, edge-style middleware, cache behavior, streaming responses, and tests that should not need a real browser or a real server.

## Quick Start

```ts
import { createMiniWeb, createMiniWebApp, mount, toApp } from '@async/miniweb';

const app = createMiniWebApp({
  origin: 'https://miniweb.local',
  apps: {
    frontend: {
      app: {
        fetch() {
          return new Response('<h1>Home</h1>', {
            headers: {
              'content-type': 'text/html; charset=utf-8'
            }
          });
        }
      },
      basePath: '/'
    },
    backend: {
      app: {
        fetch(request) {
          return Response.json({
            pathname: new URL(request.url).pathname
          });
        }
      },
      basePath: '/api/'
    }
  },
  routes: [
    mount('/api', toApp('backend')),
    toApp('frontend')
  ]
});

const web = await createMiniWeb(app);
const response = await web.fetch('/api/about');
const data = await response.json();
```

## Run The Examples

```sh
npm install
npm run dev
```

Open `http://localhost:5173/`. The root page is an example directory with ten setups that exercise the route graph, scoped platform APIs, cache stores, runtime modes, and streaming behavior.

## What It Models

- frontend/browser behavior
- fake location, history, and navigation
- scoped platform APIs such as `fetch`, storage, cookies, caches, timers, crypto, encoding, and messaging
- service-worker-style and edge-style cache boundaries
- route middleware and mounted apps
- same-realm and iframe runtime modes
- backend/origin `app.fetch(request)`
- virtual filesystem and fake terminal
- fake delay and streaming responses

## Core Shape

MiniWeb has three public concepts:

- `apps`: browser-safe `FetchApp` objects that receive `Request`, `env`, and `context`.
- `routes`: promise-based middleware that decides how requests connect to apps, cache stores, rewrites, redirects, or origins.
- `platform`: scoped Web APIs for each app/runtime. `platform.fetch()` resolves relative URLs from that app's location and re-enters the route graph.

Iframe isolation is opt-in. The default runtime is same-realm because that keeps static-hosted demos simple and fast.

## Vite Compile-Away

Apps can import Web APIs from MiniWeb during development and compile those imports back to native globals for production builds:

```ts
import { fetch, localStorage, Request, Response } from '@async/miniweb/platform';
```

```ts
import { miniweb } from '@async/miniweb/vite';

export default {
  plugins: [
    miniweb()
  ]
};
```

By default, `vite dev` resolves platform imports to MiniWeb scoped APIs, and `vite build` resolves them to native `globalThis` APIs. Use `miniweb({ target: 'miniweb' })` for static MiniWeb demos that should keep the route graph after build, or `miniweb({ target: 'native' })` to bypass MiniWeb in both dev and build.

## Example Setups

| Example | Shows |
| --- | --- |
| `hello-app` | the original manifest app as a MiniWeb setup |
| `streaming-app` | visibly delayed long streamed HTML, text, and NDJSON responses |
| `simple-fullstack` | frontend and backend apps with runtime overrides |
| `service-worker-cache` | platform cache storage as a service-worker-style cache |
| `cdn-edge-cache` | shared edge cache with tags and trace entries |
| `edge-middleware` | redirect, rewrite, and HTML transform middleware |
| `multi-app-network` | host-based routing across multiple registered apps |
| `platform-fetch-chain` | backend code calling another backend route through `platform.fetch()` |
| `request-body-lab` | request body preservation through the route graph |
| `stateful-session-cache` | scoped cookies plus named Cache Storage |

The streaming example accepts delay query params for manual testing:
`/?demo=%2Fexamples%2Fstreaming-app%2F&delay=700&firstDelay=1200`.

## Docs

- [Getting Started](docs/getting-started.md)
- [Concepts](docs/concepts.md)
- [Examples](docs/examples.md)
- [Routes And Cache](docs/routes-and-cache.md)
- [Platform And Runtimes](docs/platform-and-runtimes.md)
- [Vite Compile-Away](docs/vite-compile-away.md)
- [Releasing](docs/releasing.md)
- [Browser Shell](docs/browser-shell.md)

## File Map

- `src/core/`: MiniWeb runtime, route middleware, platform APIs, tracing, delay, cache, streams, and virtual filesystem.
- `src/browser/`: browser shell, preview frame rendering, and frame RPC helpers.
- `src/node/`: Node-side helpers and happy-dom frontend driver.
- `src/examples/`: reusable example setups.
- `tests/`: unit, integration, browser-shell, platform, route, stream, and example coverage.
- `docs/`: task-oriented docs for the public model.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

## Non-Goals

MiniWeb is not a full Node.js VM.

MiniWeb does not run arbitrary npm packages.

MiniWeb does not provide real secrets, real auth, real TCP sockets, `child_process`, or native modules.
