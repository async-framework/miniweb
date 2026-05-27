# Platform And Runtimes

MiniWeb owns a scoped platform surface for each app/runtime. The platform gives browser-safe code the APIs it expects without mutating the real page globals.

## Platform Fetch

`platform.fetch()` is the canonical fetch path inside MiniWeb apps.

```ts
export const backend = {
  async fetch(_request, _env, context) {
    const response = await context.platform.fetch('inner');
    return Response.json({
      inner: await response.json()
    });
  }
};
```

The URL `inner` resolves from that app's location. If the backend app has `basePath: '/api/'`, the fetch goes to `/api/inner` through the route graph.

## Scoped State

Use platform state for deterministic local demos and tests:

```ts
context.platform.localStorage.setItem('count', '1');
context.platform.cookies.setCookie(request.url, 'seen=true; Path=/');

const cache = await context.platform.caches.open('session-cache');
await cache.put(request, response.clone());
```

State is scoped to the environment/platform runtime and cleared by `web.reset()`.

## Same-Realm Runtime

Same-realm is the default:

```ts
const web = await createMiniWeb(app);
```

This is the best default for GitHub Pages-style demos because all browser-safe code can run in one static bundle.

## Iframe Runtime

Use iframe mode when you want to test isolation boundaries:

```ts
const web = await createMiniWeb(app, {
  runtimes: {
    backend: {
      mode: 'iframe',
      sandbox: 'allow-scripts'
    }
  }
});
```

You can also isolate both frontend and backend:

```ts
const web = await createMiniWeb(app, {
  runtimes: {
    frontend: {
      mode: 'iframe',
      sandbox: 'allow-scripts'
    },
    backend: {
      mode: 'iframe',
      sandbox: 'allow-scripts'
    }
  }
});
```

The browser shell exposes these presets through its runtime selector.

## Practical Rule

Start same-realm. Switch one runtime to iframe only when you need to prove isolation behavior or future runtime transport behavior.

## Vite Platform Imports

For app source that should compile away later, import platform APIs from `@async/miniweb/platform`:

```ts
import { fetch, caches, localStorage } from '@async/miniweb/platform';
```

With the Vite plugin, dev mode binds those imports to the current MiniWeb environment platform. Production builds bind them to native `globalThis` APIs unless the plugin target is explicitly set to `miniweb`.
