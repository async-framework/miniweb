# Getting Started

MiniWeb turns browser-safe `FetchApp` objects into a local web runtime. Requests enter a route graph and return standard `Response` objects.

## Install

```sh
npm install @async/miniweb
```

Inside this repo, use the local scripts:

```sh
npm install
npm run dev
```

## Create A Small App

```ts
import { createMiniWeb, createMiniWebApp, mount, toApp } from '@async/miniweb';

const frontend = {
  fetch() {
    return new Response('<h1>Home</h1>', {
      headers: {
        'content-type': 'text/html; charset=utf-8'
      }
    });
  }
};

const backend = {
  fetch(request) {
    return Response.json({
      pathname: new URL(request.url).pathname
    });
  }
};

const miniweb = createMiniWebApp({
  origin: 'https://miniweb.local',
  apps: {
    frontend: {
      app: frontend,
      basePath: '/'
    },
    backend: {
      app: backend,
      basePath: '/api/'
    }
  },
  routes: [
    mount('/api', toApp('backend')),
    toApp('frontend')
  ]
});

const web = await createMiniWeb(miniweb);
const response = await web.fetch('/api/hello');
console.log(await response.json());
```

## Use Platform Fetch

`platform.fetch()` resolves relative URLs from the current app or environment location and enters the MiniWeb route graph.

```ts
const backend = {
  async fetch(_request, _env, context) {
    const inner = await context.platform.fetch('inner');
    return Response.json({
      inner: await inner.json()
    });
  }
};
```

This is the static-hosted demo path: frontend code and browser-safe backend code can live in one bundle while still communicating through `fetch`.

## Run Tests

```sh
npm run typecheck
npm test
npm run build
```
