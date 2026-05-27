import { describe, expect, it, vi } from 'vitest';
import { createMiniWeb } from '../src/core/create-miniweb.ts';

describe('MiniWeb platform runtime APIs', () => {
  it('tracks timers, runs microtasks, and clears pending timers on reset', async () => {
    vi.useFakeTimers();
    try {
      const web = await createMiniWeb({
        origin: 'https://web.local',
        pipeline: {
          frontend: {
            kind: 'headless'
          },
          serviceWorker: {
            kind: 'bypass'
          },
          backend: {
            kind: 'mock',
            routes: {}
          }
        }
      });
      let timerRuns = 0;
      let intervalRuns = 0;
      let microtaskRuns = 0;

      web.platform.timers.setTimeout(() => {
        timerRuns += 1;
      }, 10);
      const interval = web.platform.timers.setInterval(() => {
        intervalRuns += 1;
      }, 5);
      web.platform.timers.queueMicrotask(() => {
        microtaskRuns += 1;
      });

      await vi.runAllTicks();
      vi.advanceTimersByTime(6);
      web.platform.timers.clearInterval(interval);
      await web.reset();
      vi.advanceTimersByTime(20);

      expect(microtaskRuns).toBe(1);
      expect(intervalRuns).toBe(1);
      expect(timerRuns).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('supports deterministic crypto, native digest, encoding, base64, and structuredClone helpers', async () => {
    const first = await createMiniWeb({
      origin: 'https://web.local',
      platform: {
        cryptoSeed: 123
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'mock',
          routes: {}
        }
      }
    });
    const second = await createMiniWeb({
      origin: 'https://web.local',
      platform: {
        cryptoSeed: 123
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'mock',
          routes: {}
        }
      }
    });
    const firstBytes = new Uint8Array(4);
    const secondBytes = new Uint8Array(4);

    first.platform.crypto.getRandomValues(firstBytes);
    second.platform.crypto.getRandomValues(secondBytes);

    expect(firstBytes).toEqual(secondBytes);
    expect(first.platform.crypto.randomUUID()).toBe(second.platform.crypto.randomUUID());

    const encoded = new first.platform.TextEncoder().encode('MiniWeb');
    const digest = await first.platform.crypto.subtle.digest('SHA-256', encoded);
    expect(digest.byteLength).toBe(32);
    expect(new first.platform.TextDecoder().decode(encoded)).toBe('MiniWeb');
    expect(first.platform.atob(first.platform.btoa('MiniWeb'))).toBe('MiniWeb');
    expect(first.platform.structuredClone({
      nested: {
        value: 1
      }
    })).toEqual({
      nested: {
        value: 1
      }
    });
  });

  it('exposes navigator metadata and event constructors from the scoped platform', async () => {
    const web = await createMiniWeb({
      origin: 'https://web.local',
      platform: {
        navigator: {
          userAgent: 'MiniWeb Test',
          onLine: false,
          language: 'fr-FR'
        }
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'mock',
          routes: {}
        }
      }
    });

    expect(web.platform.navigator).toEqual({
      userAgent: 'MiniWeb Test',
      onLine: false,
      language: 'fr-FR'
    });
    const eventTarget = new web.platform.EventTarget();
    const event = new web.platform.CustomEvent('miniweb', {
      detail: {
        ok: true
      }
    });
    let detail: unknown;
    eventTarget.addEventListener('miniweb', (received) => {
      detail = (received as CustomEvent).detail;
    });
    eventTarget.dispatchEvent(event);

    expect(detail).toEqual({
      ok: true
    });
  });

  it('supports scoped postMessage and BroadcastChannel messaging', async () => {
    const web = await createMiniWeb({
      origin: 'https://web.local',
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'mock',
          routes: {}
        }
      }
    });
    const messages: unknown[] = [];
    web.platform.addEventListener('message', (event) => {
      messages.push((event as MessageEvent).data);
    });

    web.platform.postMessage({
      ok: true
    }, 'https://web.local');
    web.platform.postMessage('blocked', 'https://other.local');

    expect(messages).toEqual([
      {
        ok: true
      }
    ]);

    const first = new web.platform.BroadcastChannel('updates');
    const second = new web.platform.BroadcastChannel('updates');
    const broadcastMessages: unknown[] = [];
    second.onmessage = (event) => {
      broadcastMessages.push(event.data);
    };
    first.postMessage({
      value: 1
    });
    first.close();
    second.close();

    expect(broadcastMessages).toEqual([
      {
        value: 1
      }
    ]);
  });
});
