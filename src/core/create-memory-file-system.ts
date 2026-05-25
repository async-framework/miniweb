import { normalizeMiniWebPath } from './path-utils.ts';
import type { MemoryFileSystem } from './types.ts';

export function createMemoryFileSystem(files: Record<string, string> = {}): MemoryFileSystem {
  const store = new Map<string, string>();

  for (const [path, value] of Object.entries(files)) {
    store.set(normalizeMiniWebPath(path), value);
  }

  return {
    async readFile(path) {
      const normalized = normalizeMiniWebPath(path);
      const value = store.get(normalized);
      if (value === undefined) {
        throw new Error(`MiniWeb file not found: ${normalized}`);
      }
      return value;
    },
    async writeFile(path, value) {
      store.set(normalizeMiniWebPath(path), value);
    },
    async deleteFile(path) {
      store.delete(normalizeMiniWebPath(path));
    },
    async exists(path) {
      return store.has(normalizeMiniWebPath(path));
    },
    async readdir(prefix = '/') {
      const normalizedPrefix = normalizeMiniWebPath(prefix);
      return [...store.keys()]
        .filter((path) => normalizedPrefix === '/' || path.startsWith(`${normalizedPrefix}/`) || path === normalizedPrefix)
        .sort();
    },
    snapshot() {
      return Object.fromEntries([...store.entries()].sort(([a], [b]) => a.localeCompare(b)));
    }
  };
}
