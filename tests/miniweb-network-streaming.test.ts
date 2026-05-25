import { describe, expect, it } from 'vitest';
import { createMiniWeb } from '../src/core/create-miniweb.ts';
import { createMiniWebNetwork } from '../src/core/create-miniweb-network.ts';
import { createJsonLineStreamResponse } from '../src/core/create-stream-response.ts';

describe('miniweb network streaming', () => {
  it('streams responses across registered MiniWeb origins', async () => {
    const network = createMiniWebNetwork();
    const apiWeb = await createMiniWeb({
      origin: 'https://api.local',
      app: {
        fetch() {
          return createJsonLineStreamResponse({
            values: [
              {
                type: 'start'
              },
              {
                type: 'done'
              }
            ],
            headers: {
              'content-type': 'application/x-ndjson'
            }
          });
        }
      },
      layers: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        network: {
          kind: 'blocked'
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });
    const web = await createMiniWeb({
      origin: 'https://web.local',
      network,
      layers: {
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
    network.register('https://api.local', apiWeb);
    network.register('https://web.local', web);

    const response = await web.fetch('https://api.local/events');
    const text = await response.text();

    expect(text.trim().split('\n').map((line) => JSON.parse(line))).toEqual([
      {
        type: 'start'
      },
      {
        type: 'done'
      }
    ]);
    expect(web.trace.entries().map((entry) => entry.boundary)).toContain('miniweb-network:request');
    expect(web.trace.entries().map((entry) => entry.boundary)).toContain('miniweb-network:response');
  });
});
