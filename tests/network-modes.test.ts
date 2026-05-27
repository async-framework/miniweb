import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMiniWeb } from '../src/core/create-miniweb.ts';
import { createMiniWebNetwork } from '../src/core/create-miniweb-network.ts';

describe('network modes', () => {
  let origin = '';
  let server: Server;

  beforeAll(async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, {
        'content-type': 'application/json'
      });
      response.end(JSON.stringify({
        source: 'real-fetch'
      }));
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected server address');
    }
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it('tracks registered origins and unregisters targets', async () => {
    const network = createMiniWebNetwork();
    const apiWeb = await createMiniWeb({
      origin: 'https://api.local',
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'mock',
          routes: {
            '/ok': () => new Response('ok')
          }
        }
      }
    });

    network.register('https://z.local/path', apiWeb);
    network.register('https://api.local', apiWeb);

    expect(network.origins()).toEqual([
      'https://api.local',
      'https://z.local'
    ]);

    network.unregister('https://api.local/anything');

    expect(network.origins()).toEqual(['https://z.local']);
    expect((await network.fetch(new Request('https://api.local/ok'))).status).toBe(502);
  });

  it('returns 502 for unknown MiniWeb network origins', async () => {
    const network = createMiniWebNetwork();
    const web = await createMiniWeb({
      origin: 'https://web.local',
      network,
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        network: {
          kind: 'miniweb-network'
        },
        backend: {
          kind: 'mock',
          routes: {}
        }
      }
    });

    const response = await web.fetch('https://missing.local/data');

    expect(response.status).toBe(502);
    await expect(response.text()).resolves.toContain('no MiniWeb registered');
  });

  it('uses native fetch for real-fetch cross-origin requests', async () => {
    const web = await createMiniWeb({
      origin: 'http://localhost:3000',
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        network: {
          kind: 'real-fetch'
        },
        backend: {
          kind: 'mock',
          routes: {}
        }
      }
    });

    const response = await web.fetch(`${origin}/real`);
    const data = await response.json();

    expect(data.source).toBe('real-fetch');
  });

  it('falls back to native fetch when miniweb-network allows external fetch', async () => {
    const web = await createMiniWeb({
      origin: 'http://localhost:3000',
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        network: {
          kind: 'miniweb-network',
          allowExternalFetch: true
        },
        backend: {
          kind: 'mock',
          routes: {}
        }
      }
    });

    const response = await web.fetch(`${origin}/external`);
    const data = await response.json();

    expect(data.source).toBe('real-fetch');
  });
});
