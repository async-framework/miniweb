import type { MiniWeb, MiniWebTraceEntry } from '../core/types.ts';

export function traceBoundaries(web: MiniWeb): MiniWebTraceEntry['boundary'][] {
  return web.trace.entries().map((entry) => entry.boundary);
}

export function hasTraceBoundary(web: MiniWeb, boundary: MiniWebTraceEntry['boundary']): boolean {
  return traceBoundaries(web).includes(boundary);
}
