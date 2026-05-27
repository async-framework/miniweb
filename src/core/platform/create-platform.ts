import { createFakeLocation } from '../create-fake-location.ts';
import { createMiniWebCacheStorage } from './create-cache-storage.ts';
import { createMiniWebCookieJar } from './create-cookie-jar.ts';
import { createMiniWebMessaging, type MiniWebMessagingRuntime } from './create-messaging.ts';
import {
  createMiniWebCrypto,
  createMiniWebNavigator,
  createMiniWebTimers,
  getMiniWebCustomEventConstructor
} from './create-runtime-apis.ts';
import { createMiniWebStorageArea } from './create-storage.ts';
import type {
  FakeLocation,
  MiniWebCacheStorage,
  MiniWebCookieJar,
  MiniWebConfiguredEnvironmentName,
  MiniWebEnvironmentConfig,
  MiniWebEnvironmentExecutionConfig,
  MiniWebEnvironmentMap,
  MiniWebEnvironmentName,
  MiniWebEnvironmentRuntime,
  MiniWebPlatform,
  MiniWebPlatformConfig,
  MiniWebPlatformFetchHandler
} from '../types.ts';

const environmentNames: MiniWebConfiguredEnvironmentName[] = [
  'frontend',
  'serviceWorker',
  'edge',
  'backend'
];

export function createMiniWebEnvironmentRuntimes(options: {
  origin: string;
  frontendLocation: FakeLocation;
  config?: Partial<Record<MiniWebConfiguredEnvironmentName, MiniWebEnvironmentConfig>>;
  platform?: MiniWebPlatformConfig;
  fetch: MiniWebPlatformFetchHandler;
}): MiniWebEnvironmentMap {
  const origin = new URL(options.origin).origin;
  const cookies = createMiniWebCookieJar();
  const messaging = createMiniWebMessaging(origin);
  const entries = environmentNames.map((name) => {
    const execution = normalizeExecutionConfig(options.config?.[name]);
    const location = name === 'frontend' && !execution.location
      ? options.frontendLocation
      : createFakeLocation(execution.location ?? `${origin}/`);
    const runtime = createMiniWebEnvironmentRuntime({
      name,
      origin,
      execution,
      location,
      cookies,
      messaging,
      platform: options.platform,
      fetch: options.fetch
    });
    return [name, runtime] as const;
  });

  return Object.fromEntries(entries) as MiniWebEnvironmentMap;
}

export function createMiniWebEnvironmentRuntime(options: {
  name: MiniWebEnvironmentName;
  origin: string;
  execution?: MiniWebEnvironmentExecutionConfig;
  location?: FakeLocation;
  cookies?: MiniWebCookieJar;
  messaging?: MiniWebMessagingRuntime;
  platform?: MiniWebPlatformConfig;
  fetch: MiniWebPlatformFetchHandler;
}): MiniWebEnvironmentRuntime {
  const origin = new URL(options.origin).origin;
  const execution = normalizeExecutionConfig(options.execution);
  const location = options.location ?? createFakeLocation(execution.location ?? `${origin}/`);
  const localStorage = createMiniWebStorageArea();
  const sessionStorage = createMiniWebStorageArea();
  const cookies = options.cookies ?? createMiniWebCookieJar();
  const caches = createMiniWebCacheStorage();
  const messaging = options.messaging ?? createMiniWebMessaging(origin);
  let runtime: MiniWebEnvironmentRuntime;
  const platform = createMiniWebPlatform({
    name: options.name,
    origin,
    location,
    localStorage,
    sessionStorage,
    cookies,
    caches,
    messaging,
    config: options.platform,
    fetch(input, init) {
      return options.fetch(runtime, input, init);
    }
  });

  runtime = {
    name: options.name,
    execution,
    location,
    platform,
    reset() {
      location.replace(execution.location ?? `${origin}/`);
      platform.reset();
    },
    dispose() {
      platform.dispose();
    }
  };
  return runtime;
}

export function createMiniWebPlatform(options: {
  name: MiniWebEnvironmentName;
  origin: string;
  location: FakeLocation;
  localStorage?: ReturnType<typeof createMiniWebStorageArea>;
  sessionStorage?: ReturnType<typeof createMiniWebStorageArea>;
  cookies?: MiniWebCookieJar;
  caches?: MiniWebCacheStorage;
  messaging?: MiniWebMessagingRuntime;
  config?: MiniWebPlatformConfig;
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}): MiniWebPlatform {
  const localStorage = options.localStorage ?? createMiniWebStorageArea();
  const sessionStorage = options.sessionStorage ?? createMiniWebStorageArea();
  const cookies = options.cookies ?? createMiniWebCookieJar();
  const caches = options.caches ?? createMiniWebCacheStorage();
  const timers = createMiniWebTimers();
  const crypto = createMiniWebCrypto(options.config);
  const navigator = createMiniWebNavigator(options.config);
  const messaging = options.messaging ?? createMiniWebMessaging(new URL(options.origin).origin);
  const CustomEventConstructor = getMiniWebCustomEventConstructor();
  const platform: MiniWebPlatform = {
    name: options.name,
    origin: new URL(options.origin).origin,
    location: options.location,
    localStorage,
    sessionStorage,
    cookies,
    caches,
    timers,
    crypto,
    navigator,
    TextEncoder,
    TextDecoder,
    structuredClone,
    atob,
    btoa,
    queueMicrotask,
    EventTarget,
    Event,
    CustomEvent: CustomEventConstructor,
    MessageChannel,
    BroadcastChannel: messaging.BroadcastChannel,
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
    fetch(input, init) {
      return options.fetch(input, init);
    },
    createFetch() {
      return ((input: string | URL | Request, init?: RequestInit) => {
        return platform.fetch(input, init);
      }) as typeof fetch;
    },
    postMessage(message, targetOrigin) {
      messaging.postMessage(message, targetOrigin);
    },
    addEventListener(type, listener) {
      messaging.addEventListener(type, listener);
    },
    removeEventListener(type, listener) {
      messaging.removeEventListener(type, listener);
    },
    reset() {
      localStorage.clear();
      sessionStorage.clear();
      cookies.clear();
      void caches.clear();
      timers.clearAll();
      messaging.reset();
    },
    dispose() {
      timers.clearAll();
      messaging.reset();
    }
  };

  return platform;
}

function normalizeExecutionConfig(
  config?: MiniWebEnvironmentConfig
): MiniWebEnvironmentExecutionConfig {
  if (!config) {
    return {
      mode: 'same-realm'
    };
  }
  if (config.mode === 'iframe') {
    return {
      mode: 'iframe',
      location: config.location,
      sandbox: config.sandbox
    };
  }
  return {
    mode: 'same-realm',
    location: config.location
  };
}
