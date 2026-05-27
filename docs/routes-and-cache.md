# Routes And Cache

MiniWeb routes are promise middleware. They are the main way to connect frontend apps, backend apps, cache behavior, rewrites, redirects, files, and real origins.

## Basic Routing

```ts
import { createMiniWebApp, mount, toApp } from '@async/miniweb';

export const app = createMiniWebApp({
  origin: 'https://miniweb.local',
  apps: {
    frontend: {
      app: frontendApp,
      basePath: '/'
    },
    backend: {
      app: backendApp,
      basePath: '/api/'
    }
  },
  routes: [
    mount('/api', toApp('backend')),
    toApp('frontend')
  ]
});
```

`mount('/api', toApp('backend'))` strips `/api` before the backend sees the request. A request to `/api/users` reaches the backend as `/users`.

## Host Routing

```ts
import { domain, toApp } from '@async/miniweb';

routes: [
  domain('api.local', toApp('api')),
  toApp('frontend')
]
```

Use `baseUrl` when an app should resolve relative URLs from a specific host:

```ts
api: {
  app: apiApp,
  baseUrl: 'https://api.local/'
}
```

## Cache Stores

`cacheFirst()` can write to different stores:

```ts
cacheFirst({
  store: 'service-worker'
});
```

```ts
cacheFirst({
  store: 'edge',
  ttl: 60,
  tags: ['api']
});
```

```ts
cacheFirst({
  store: 'named:session'
});
```

Store meanings:

- `service-worker`: a platform Cache Storage cache named `service-worker`.
- `edge`: the shared MiniWeb edge cache exposed at `web.edge.cache`.
- `named:<name>`: a platform Cache Storage cache with a custom name.

## Rewrites And Transforms

```ts
import { middleware, toApp } from '@async/miniweb';

routes: [
  middleware((_request, url) => url.pathname === '/docs', (request, _context, next) => {
    const rewriteUrl = new URL(request.url);
    rewriteUrl.pathname = '/docs/index';
    return next(new Request(rewriteUrl, request));
  }),
  middleware(() => true, async (_request, _context, next) => {
    const response = await next();
    const html = await response.text();
    return new Response(html.replace('</head>', '<meta name="edge" content="fake"></head>'), {
      status: response.status,
      headers: response.headers
    });
  }),
  toApp('backend')
]
```

Only inspect or consume bodies when the route explicitly transforms, caches, renders, or debugs the body.
