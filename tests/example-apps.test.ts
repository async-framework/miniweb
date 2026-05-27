import { describe, expect, it } from 'vitest';
import { createMiniWeb } from '../src/core/create-miniweb.ts';
import { cdnEdgeCacheMiniWeb } from '../src/examples/cdn-edge-cache/miniweb.ts';
import { edgeMiddlewareMiniWeb } from '../src/examples/edge-middleware/miniweb.ts';
import { helloAppMiniWeb } from '../src/examples/hello-app/miniweb.ts';
import { multiAppNetworkMiniWeb } from '../src/examples/multi-app-network/miniweb.ts';
import { platformFetchChainMiniWeb } from '../src/examples/platform-fetch-chain/miniweb.ts';
import { requestBodyLabMiniWeb } from '../src/examples/request-body-lab/miniweb.ts';
import { serviceWorkerCacheMiniWeb } from '../src/examples/service-worker-cache/miniweb.ts';
import { simpleFullstackMiniWeb } from '../src/examples/simple-fullstack/miniweb.ts';
import { statefulSessionCacheMiniWeb } from '../src/examples/stateful-session-cache/miniweb.ts';
import { streamingAppMiniWeb } from '../src/examples/streaming-app/miniweb.ts';

describe('MiniWeb example apps', () => {
  it('runs hello-app as a reusable MiniWeb setup', async () => {
    const web = await createMiniWeb(helloAppMiniWeb);

    const home = await web.fetch('/?delay=1&firstDelay=1');
    await expect(home.text()).resolves.toContain('<h1>Home</h1>');

    const api = await web.fetch('/api/time');
    await expect(api.json()).resolves.toMatchObject({
      source: 'fake-node'
    });
  });

  it('runs streaming-app as a reusable MiniWeb setup', async () => {
    const web = await createMiniWeb(streamingAppMiniWeb);

    const home = await web.fetch('/');
    await expect(home.text()).resolves.toContain('<h1>Streaming Home</h1>');

    const events = await web.fetch('/events?delay=1&firstDelay=1');
    await expect(events.text()).resolves.toContain('"type":"done"');
  });

  it('runs simple-fullstack in same-realm, backend iframe, and two-iframe presets', async () => {
    const sameRealm = await createMiniWeb(simpleFullstackMiniWeb);
    const sameRealmRuntime = await sameRealm.fetch('/api/runtime');
    await expect(sameRealmRuntime.json()).resolves.toEqual({
      mode: 'same-realm',
      location: 'https://miniweb.local/api/',
      sandbox: null
    });

    const backendIframe = await createMiniWeb(simpleFullstackMiniWeb, {
      runtimes: {
        backend: {
          mode: 'iframe',
          sandbox: 'allow-scripts'
        }
      }
    });
    const backendIframeRuntime = await backendIframe.fetch('/api/runtime');
    await expect(backendIframeRuntime.json()).resolves.toEqual({
      mode: 'iframe',
      location: 'https://miniweb.local/api/',
      sandbox: 'allow-scripts'
    });

    const twoIframes = await createMiniWeb(simpleFullstackMiniWeb, {
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
    expect(twoIframes.platform.location.href).toBe('https://miniweb.local/');
    const twoIframeRuntime = await twoIframes.fetch('/api/runtime');
    await expect(twoIframeRuntime.json()).resolves.toEqual({
      mode: 'iframe',
      location: 'https://miniweb.local/api/',
      sandbox: 'allow-scripts'
    });
  });

  it('serves service-worker-cache through a platform cache store', async () => {
    const web = await createMiniWeb(serviceWorkerCacheMiniWeb);

    const first = await web.fetch('/api/message');
    await expect(first.json()).resolves.toEqual({
      source: 'service-worker-cache-backend',
      originHits: 1
    });

    const second = await web.fetch('/api/message');
    await expect(second.json()).resolves.toEqual({
      source: 'service-worker-cache-backend',
      originHits: 1
    });

    await expect(web.platform.caches.keys()).resolves.toEqual(['service-worker']);
  });

  it('serves cdn-edge-cache through the edge cache store', async () => {
    const web = await createMiniWeb(cdnEdgeCacheMiniWeb);

    const first = await web.fetch('/api/page');
    await expect(first.json()).resolves.toEqual({
      source: 'cdn-edge-cache-backend',
      originHits: 1
    });

    const second = await web.fetch('/api/page');
    await expect(second.json()).resolves.toEqual({
      source: 'cdn-edge-cache-backend',
      originHits: 1
    });

    const cacheEntries = await web.edge.cache.keys();
    expect(cacheEntries).toHaveLength(1);
    expect(cacheEntries[0]?.tags).toEqual(['api']);
    expect(web.trace.entries().map((entry) => entry.boundary)).toEqual(expect.arrayContaining([
      'edge:cache-miss',
      'edge:cache-put',
      'edge:cache-hit'
    ]));
  });

  it('runs edge middleware redirects, rewrites, and HTML transforms', async () => {
    const web = await createMiniWeb(edgeMiddlewareMiniWeb);

    const redirect = await web.fetch('/old');
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('location')).toBe('/new');

    const docs = await web.fetch('/docs');
    await expect(docs.text()).resolves.toContain('<meta name="edge" content="middleware"></head>');
  });

  it('routes a multi-app network by host through one route graph', async () => {
    const web = await createMiniWeb(multiAppNetworkMiniWeb);

    const home = await web.fetch('/');
    await expect(home.text()).resolves.toContain('<h1>Multi App Network</h1>');

    const api = await web.fetch('https://api.local/events');
    await expect(api.json()).resolves.toEqual({
      source: 'api-app',
      host: 'api.local',
      events: ['start', 'done']
    });
  });

  it('runs platform-fetch-chain through a backend app that fetches itself', async () => {
    const web = await createMiniWeb(platformFetchChainMiniWeb);

    const response = await web.fetch('/api/outer');

    await expect(response.json()).resolves.toEqual({
      source: 'outer',
      inner: {
        source: 'inner',
        path: '/inner'
      }
    });
  });

  it('runs request-body-lab while preserving request bodies', async () => {
    const web = await createMiniWeb(requestBodyLabMiniWeb);

    const response = await web.fetch('/api/echo', {
      method: 'POST',
      body: 'hello'
    });

    await expect(response.json()).resolves.toEqual({
      method: 'POST',
      body: 'hello'
    });
  });

  it('runs stateful-session-cache with scoped cookies and named caches', async () => {
    const web = await createMiniWeb(statefulSessionCacheMiniWeb);

    await expect((await web.fetch('/api/session')).json()).resolves.toEqual({
      cookie: 'seen=true'
    });
    await expect((await web.fetch('/api/cache')).json()).resolves.toEqual({
      cacheHit: false,
      value: 1
    });
    await expect((await web.fetch('/api/cache')).json()).resolves.toEqual({
      cacheHit: true,
      value: 1
    });
  });
});
