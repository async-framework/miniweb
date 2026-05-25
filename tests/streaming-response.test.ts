import { describe, expect, it } from 'vitest';
import { createMiniWeb } from '../src/core/create-miniweb.ts';
import { createJsonLineStreamResponse } from '../src/core/create-stream-response.ts';

describe('streaming responses', () => {
  it('streams JSON lines in order and traces stream lifecycle', async () => {
    const web = await createMiniWeb({
      origin: 'http://localhost:3000',
      app: {
        fetch() {
          return createJsonLineStreamResponse({
            values: [
              {
                type: 'start'
              },
              {
                type: 'progress',
                value: 50
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
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    const response = await web.fetch('/events');
    const lines = (await response.text()).trim().split('\n').map((line) => JSON.parse(line));

    expect(lines).toEqual([
      {
        type: 'start'
      },
      {
        type: 'progress',
        value: 50
      },
      {
        type: 'done'
      }
    ]);
    const boundaries = web.trace.entries().map((entry) => entry.boundary);
    expect(boundaries).toContain('stream:start');
    expect(boundaries).toContain('stream:chunk');
    expect(boundaries).toContain('stream:end');
  });
});
