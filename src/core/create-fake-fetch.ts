import type { MiniWeb } from './types.ts';

export function createFakeFetch(web: MiniWeb): typeof fetch {
  return web.platform.createFetch();
}
