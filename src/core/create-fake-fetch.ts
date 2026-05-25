import type { MiniWeb } from './types.ts';

export function createFakeFetch(web: MiniWeb): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => web.fetch(input, init)) as typeof fetch;
}
