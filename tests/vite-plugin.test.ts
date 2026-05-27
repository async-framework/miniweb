import { describe, expect, it, vi } from 'vitest';
import {
  createMiniWebPlatformModuleCode,
  createNativePlatformModuleCode,
  miniweb,
  resolveMiniWebViteTarget
} from '../src/vite/index.ts';
import * as nativePlatform from '../src/platform/index.ts';

describe('MiniWeb Vite compile-away plugin', () => {
  it('uses MiniWeb platform imports during dev and native globals during production builds', () => {
    expect(resolveMiniWebViteTarget({
      target: 'auto'
    }, 'serve')).toBe('miniweb');
    expect(resolveMiniWebViteTarget({
      target: 'auto'
    }, 'build')).toBe('native');
    expect(resolveMiniWebViteTarget({
      target: 'miniweb'
    }, 'build')).toBe('miniweb');
    expect(resolveMiniWebViteTarget({
      target: 'native'
    }, 'serve')).toBe('native');
  });

  it('emits a native platform module that binds global functions safely', () => {
    const code = createNativePlatformModuleCode();

    expect(code).toContain('globalThis.fetch.bind(globalThis)');
    expect(code).toContain('export const Request = globalThis.Request');
    expect(code).toContain('export const caches = globalThis.caches');
    expect(code).toContain('export const localStorage = globalThis.localStorage');
  });

  it('emits a MiniWeb platform module that routes fetch through the bound platform', async () => {
    const module = await importModule(createMiniWebPlatformModuleCode({
      environment: 'frontend'
    }));
    const fetch = vi.fn(async () => new Response('from miniweb'));

    module.setMiniWebPlatform({
      fetch,
      Request,
      Response,
      Headers,
      URL,
      URLSearchParams,
      FormData,
      Blob,
      File,
      AbortController,
      AbortSignal,
      localStorage: createStorageStub(),
      sessionStorage: createStorageStub(),
      cookies: {},
      caches: {},
      timers: {
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        queueMicrotask
      },
      crypto: globalThis.crypto,
      navigator: {
        userAgent: 'test',
        onLine: true,
        language: 'en-US'
      },
      TextEncoder,
      TextDecoder,
      structuredClone,
      atob,
      btoa,
      queueMicrotask,
      EventTarget,
      Event,
      CustomEvent,
      MessageChannel,
      BroadcastChannel,
      postMessage() {
        return;
      },
      addEventListener() {
        return;
      },
      removeEventListener() {
        return;
      }
    });

    const response = await module.fetch('/api/data');

    expect(await response.text()).toBe('from miniweb');
    expect(fetch).toHaveBeenCalledWith('/api/data', undefined);
  });

  it('emits MiniWeb app auto-binding code for string app definitions', () => {
    const code = createMiniWebPlatformModuleCode({
      app: '/src/examples/simple-fullstack/miniweb.ts'
    });

    expect(code).toContain("import { createMiniWeb as __miniwebCreateMiniWeb } from '@async/miniweb'");
    expect(code).toContain('import * as __miniwebAppModule from "/src/examples/simple-fullstack/miniweb.ts"');
    expect(code).toContain('__miniwebAppModule.default ?? __miniwebAppModule.miniweb ?? __miniwebAppModule.app');
    expect(code).toContain('__miniwebCreateMiniWeb(__miniwebAppDefinition)');
  });

  it('resolves @async/miniweb/platform to a virtual module for selected targets', async () => {
    const plugin = miniweb({
      target: 'miniweb',
      environment: 'backend'
    }) as any;

    plugin.configResolved?.({
      command: 'serve'
    } as never);
    const resolved = await plugin.resolveId?.('@async/miniweb/platform', undefined, {} as never);
    const code = await plugin.load?.(resolved as string, {} as never);

    expect(resolved).toBe('\0@async/miniweb/platform');
    expect(String(code)).toContain('const defaultEnvironment = "backend"');
    expect(String(code)).toContain('getMiniWebPlatform().fetch');
  });

  it('provides a native fallback facade when the Vite plugin is not active', async () => {
    expect(nativePlatform.Request).toBe(Request);
    expect(nativePlatform.Response).toBe(Response);
    expect(await (await nativePlatform.fetch('data:text/plain,miniweb')).text()).toBe('miniweb');
  });
});

async function importModule(code: string): Promise<Record<string, any>> {
  const encoded = Buffer.from(code).toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

function createStorageStub(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}
