import { describe, expect, it } from 'vitest';
import { createMiniWeb } from '../src/core/create-miniweb.ts';
import { simpleFullstackMiniWeb } from '../src/examples/simple-fullstack/miniweb.ts';

describe('simple fullstack MiniWeb app', () => {
  it('routes fallback requests to frontend and /api requests to backend in same-realm mode', async () => {
    const web = await createMiniWeb(simpleFullstackMiniWeb);

    const home = await web.fetch('/');
    expect(home.headers.get('content-type')).toContain('text/html');
    await expect(home.text()).resolves.toContain('<h1>Simple Fullstack</h1>');

    const api = await web.fetch('/api/message');
    await expect(api.json()).resolves.toEqual({
      source: 'backend',
      path: '/message'
    });

    const boundaries = web.trace.entries().map((entry) => entry.boundary);
    expect(boundaries).toContain('frontend:request');
    expect(boundaries).toContain('backend:request');
    expect(boundaries).toContain('frontend:response');
  });

  it('keeps registered app platform state separate and routes backend platform.fetch through the route graph', async () => {
    const web = await createMiniWeb(simpleFullstackMiniWeb);
    web.platform.localStorage.setItem('owner', 'frontend');

    const state = await web.fetch('/api/platform-state');
    await expect(state.json()).resolves.toEqual({
      owner: 'backend',
      location: 'https://miniweb.local/api/'
    });
    expect(web.platform.localStorage.getItem('owner')).toBe('frontend');

    const stateAgain = await web.fetch('/api/platform-again');
    await expect(stateAgain.json()).resolves.toEqual({
      owner: 'backend'
    });

    const outer = await web.fetch('/api/outer');
    await expect(outer.json()).resolves.toEqual({
      source: 'outer',
      inner: {
        source: 'inner',
        path: '/inner'
      }
    });
  });

  it('applies runtime overrides without changing the route graph', async () => {
    const web = await createMiniWeb(simpleFullstackMiniWeb, {
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

    expect(web.platform.location.href).toBe('https://miniweb.local/');

    const response = await web.fetch('/api/runtime');
    await expect(response.json()).resolves.toEqual({
      mode: 'iframe',
      location: 'https://miniweb.local/api/',
      sandbox: 'allow-scripts'
    });
  });
});
