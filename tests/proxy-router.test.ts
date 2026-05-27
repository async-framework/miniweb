import { describe, expect, it } from 'vitest';
import {
  composeMiniWeb,
  finalMiniWebHandler,
  get,
  mount,
  toApp
} from '../src/core/create-miniweb-router.ts';
import type { MiniWebRouteContext } from '../src/core/types.ts';

describe('MiniWeb proxy router', () => {
  it('composes middleware in order and short-circuits responses', async () => {
    const order: string[] = [];
    const router = composeMiniWeb([
      async (_request, _context, next) => {
        order.push('before-a');
        const response = await next();
        order.push('after-a');
        return response;
      },
      () => {
        order.push('handler');
        return new Response('ok');
      },
      () => {
        order.push('unreachable');
        return new Response('nope');
      }
    ]);

    const response = await router(
      new Request('https://miniweb.local/'),
      createRouteContext(),
      finalMiniWebHandler
    );

    await expect(response.text()).resolves.toBe('ok');
    expect(order).toEqual(['before-a', 'handler', 'after-a']);
  });

  it('matches GET routes with params and treats HEAD as GET', async () => {
    const router = composeMiniWeb([
      get('/users/:id', (_request, context) => {
        return Response.json(context.route.params);
      })
    ]);

    const getResponse = await router(
      new Request('https://miniweb.local/users/42'),
      createRouteContext(),
      finalMiniWebHandler
    );
    await expect(getResponse.json()).resolves.toEqual({
      id: '42'
    });

    const headResponse = await router(
      new Request('https://miniweb.local/users/99', {
        method: 'HEAD'
      }),
      createRouteContext(),
      finalMiniWebHandler
    );
    expect(headResponse.status).toBe(200);
  });

  it('mounts a route prefix, strips it for the child request, and dispatches to a registered app', async () => {
    const context = createRouteContext(async (name, request) => {
      return Response.json({
        name,
        path: new URL(request.url).pathname
      });
    });
    const router = composeMiniWeb([
      mount('/api', toApp('backend'))
    ]);

    const response = await router(
      new Request('https://miniweb.local/api/users'),
      context,
      finalMiniWebHandler
    );

    await expect(response.json()).resolves.toEqual({
      name: 'backend',
      path: '/users'
    });
    expect(context.route.mountPath).toBeUndefined();
  });

  it('returns a deterministic final 404 response', async () => {
    const response = await composeMiniWeb([])(
      new Request('https://miniweb.local/missing'),
      createRouteContext(),
      finalMiniWebHandler
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe('Cannot GET /missing');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

function createRouteContext(
  fetchApp: MiniWebRouteContext['fetchApp'] = async () => new Response('app missing', {
    status: 500
  })
): MiniWebRouteContext {
  return {
    route: {
      params: {}
    },
    fetchApp
  } as MiniWebRouteContext;
}
