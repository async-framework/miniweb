# Concepts

MiniWeb is not a Node.js compatibility layer. It is a controlled web runtime built around `Request -> Response`.

## Request Flow

The modern route model is:

```txt
platform.fetch() or web.fetch()
  -> route middleware
  -> app.fetch(request, env, context)
  -> Response
```

Compatibility drivers still model frontend, service worker, network, edge, and backend boundaries for lower-level tests. The app model keeps new examples easier to reason about.

## Apps

An app is a `FetchApp`:

```ts
export interface FetchApp {
  fetch(request: Request, env: MiniWebEnv, context: MiniWebContext): Promise<Response> | Response;
}
```

Each registered app can have:

- `basePath`: a path under the MiniWeb origin, such as `/api/`.
- `baseUrl`: a full URL, such as `https://api.local/`.
- `runtime`: a named execution mode, such as `frontend` or `backend`.
- `platform`: a named platform scope for storage, cookies, caches, and relative URL resolution.

## Routes

Routes are promise middleware. They decide how a request reaches an app or cache.

```ts
routes: [
  mount('/api', toApp('backend')),
  toApp('frontend')
]
```

Use route helpers for common behavior:

- `mount(prefix, middleware)`: strip a prefix before passing to child middleware.
- `domain(hostname, middleware)`: match by hostname.
- `get`, `post`, `put`, `patch`, `del`, `all`: match by HTTP method and path.
- `middleware(check, middleware)`: run custom conditions.
- `redirect(url, status)`: return a redirect response.
- `cacheFirst`, `staleWhileRevalidate`, `networkFirst`, `cacheOnly`, `networkOnly`: model cache strategy.
- `toApp(name)`: dispatch to a registered app.
- `toOrigin(baseUrl)`: proxy to a real origin with native `fetch`.
- `toFiles(options)`: serve files from the virtual filesystem.

## Platform APIs

Each environment gets a scoped `MiniWebPlatform`:

- `fetch`
- `Request`, `Response`, `Headers`, `URL`, `URLSearchParams`, `FormData`, `Blob`, `File`
- `localStorage`, `sessionStorage`, cookies, and Cache Storage
- timers and microtasks
- `crypto.randomUUID()`, `crypto.getRandomValues()`, and `crypto.subtle.digest()`
- `TextEncoder`, `TextDecoder`, `structuredClone`, `atob`, `btoa`
- `EventTarget`, `Event`, `CustomEvent`, `MessageChannel`, `BroadcastChannel`, `postMessage`
- minimal `navigator`

## Runtimes

The default runtime is same-realm:

```ts
runtimes: {
  backend: {
    mode: 'same-realm'
  }
}
```

Iframe mode is opt-in:

```ts
runtimes: {
  backend: {
    mode: 'iframe',
    sandbox: 'allow-scripts'
  }
}
```

Iframe mode currently buffers request and response bodies for the runtime boundary. Same-process streaming is supported through MiniWeb routes and MiniWeb-to-MiniWeb network paths.
