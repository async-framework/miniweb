import { isAbsolute, resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import type { MiniWebAppDefinition } from '../core/types.ts';

const platformId = '@async/miniweb/platform';
const virtualPlatformId = `\0${platformId}`;

export type MiniWebViteTarget = 'auto' | 'miniweb' | 'native';
export type MiniWebViteCommand = 'serve' | 'build';

export interface MiniWebVitePluginOptions {
  target?: MiniWebViteTarget;
  app?: MiniWebAppDefinition | string;
  environment?: string;
}

export function miniweb(options: MiniWebVitePluginOptions = {}): Plugin {
  let config: ResolvedConfig | undefined;

  return {
    name: 'miniweb-platform',
    enforce: 'pre',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    resolveId(id) {
      if (id === platformId) {
        return virtualPlatformId;
      }
      return null;
    },
    load(id) {
      if (id !== virtualPlatformId) {
        return null;
      }

      const command = config?.command ?? 'build';
      const target = resolveMiniWebViteTarget(options, command);
      if (target === 'native') {
        return createNativePlatformModuleCode();
      }

      return createMiniWebPlatformModuleCode({
        ...options,
        app: normalizeAppSpecifier(options.app, config?.root)
      });
    }
  };
}

export function resolveMiniWebViteTarget(
  options: MiniWebVitePluginOptions,
  command: MiniWebViteCommand
): Exclude<MiniWebViteTarget, 'auto'> {
  if (options.target === 'miniweb' || options.target === 'native') {
    return options.target;
  }
  return command === 'serve' ? 'miniweb' : 'native';
}

export function createNativePlatformModuleCode(): string {
  return String.raw`
const noop = () => undefined;
const getDocument = () => typeof document === 'undefined' ? undefined : document;
const getCookieText = () => getDocument()?.cookie ?? '';
const parseCookieText = (value) => Object.fromEntries(
  value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf('=');
      return separator === -1
        ? [part, '']
        : [part.slice(0, separator), part.slice(separator + 1)];
    })
);

export const fetch = globalThis.fetch.bind(globalThis);
export const Request = globalThis.Request;
export const Response = globalThis.Response;
export const Headers = globalThis.Headers;
export const URL = globalThis.URL;
export const URLSearchParams = globalThis.URLSearchParams;
export const FormData = globalThis.FormData;
export const Blob = globalThis.Blob;
export const File = globalThis.File;
export const AbortController = globalThis.AbortController;
export const AbortSignal = globalThis.AbortSignal;
export const localStorage = globalThis.localStorage;
export const sessionStorage = globalThis.sessionStorage;
export const caches = globalThis.caches;
export const timers = {
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  setInterval: globalThis.setInterval.bind(globalThis),
  clearInterval: globalThis.clearInterval.bind(globalThis),
  queueMicrotask: globalThis.queueMicrotask.bind(globalThis),
  clearAll() {}
};
export const setTimeout = timers.setTimeout;
export const clearTimeout = timers.clearTimeout;
export const setInterval = timers.setInterval;
export const clearInterval = timers.clearInterval;
export const crypto = globalThis.crypto;
export const TextEncoder = globalThis.TextEncoder;
export const TextDecoder = globalThis.TextDecoder;
export const structuredClone = globalThis.structuredClone.bind(globalThis);
export const atob = globalThis.atob.bind(globalThis);
export const btoa = globalThis.btoa.bind(globalThis);
export const queueMicrotask = globalThis.queueMicrotask.bind(globalThis);
export const EventTarget = globalThis.EventTarget;
export const Event = globalThis.Event;
export const CustomEvent = globalThis.CustomEvent;
export const MessageChannel = globalThis.MessageChannel;
export const BroadcastChannel = globalThis.BroadcastChannel;
export const postMessage = typeof globalThis.postMessage === 'function'
  ? globalThis.postMessage.bind(globalThis)
  : noop;
export const addEventListener = typeof globalThis.addEventListener === 'function'
  ? globalThis.addEventListener.bind(globalThis)
  : noop;
export const removeEventListener = typeof globalThis.removeEventListener === 'function'
  ? globalThis.removeEventListener.bind(globalThis)
  : noop;
export const navigator = globalThis.navigator;
export const location = globalThis.location;
export const cookies = {
  getCookieHeader() {
    return getCookieText();
  },
  setCookie(_url, value) {
    const document = getDocument();
    if (!document) {
      return;
    }
    for (const cookie of Array.isArray(value) ? value : [value]) {
      document.cookie = cookie;
    }
  },
  deleteCookie(_url, name) {
    const document = getDocument();
    if (document) {
      document.cookie = name + '=; Max-Age=0; Path=/';
    }
  },
  clear() {
    const document = getDocument();
    if (!document) {
      return;
    }
    for (const name of Object.keys(parseCookieText(document.cookie))) {
      document.cookie = name + '=; Max-Age=0; Path=/';
    }
  },
  snapshot() {
    return parseCookieText(getCookieText());
  }
};
export const ready = Promise.resolve();
export const createFetch = () => fetch;
export const getMiniWebPlatform = () => ({
  fetch,
  createFetch,
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
  localStorage,
  sessionStorage,
  caches,
  timers,
  crypto,
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
  postMessage,
  addEventListener,
  removeEventListener,
  navigator,
  location,
  cookies
});
export const setMiniWebPlatform = () => undefined;
export const clearMiniWebPlatform = () => undefined;
`;
}

export function createMiniWebPlatformModuleCode(options: Pick<
  MiniWebVitePluginOptions,
  'app' | 'environment'
> = {}): string {
  const environment = options.environment ?? 'frontend';
  const appImport = typeof options.app === 'string'
    ? [
        "import { createMiniWeb as __miniwebCreateMiniWeb } from '@async/miniweb';",
        `import * as __miniwebAppModule from ${JSON.stringify(options.app)};`,
        'const __miniwebAppDefinition = __miniwebAppModule.default ?? __miniwebAppModule.miniweb ?? __miniwebAppModule.app ?? Object.values(__miniwebAppModule)[0];'
      ].join('\n')
    : '';
  const readyCode = typeof options.app === 'string'
    ? 'export const ready = __miniwebCreateMiniWeb(__miniwebAppDefinition).then((web) => setMiniWebPlatform(web));'
    : 'export const ready = Promise.resolve();';

  return `${appImport}
const defaultEnvironment = ${JSON.stringify(environment)};
const platformStateKey = Symbol.for('@async/miniweb/platform-state');
const getState = () => {
  const root = globalThis;
  root[platformStateKey] ??= {
    platforms: Object.create(null),
    currentEnvironment: defaultEnvironment
  };
  return root[platformStateKey];
};
const isPlatform = (value) => value && typeof value.fetch === 'function' && value.Request && value.Response;
const selectPlatform = (value, environment = defaultEnvironment) => {
  if (isPlatform(value)) {
    return value;
  }
  const platform = value?.environments?.[environment]?.platform
    ?? (environment === 'frontend' ? value?.platform : undefined)
    ?? value?.platform;
  if (isPlatform(platform)) {
    return platform;
  }
  throw new Error(\`MiniWeb platform import could not find environment "\${environment}". Pass a MiniWeb instance or MiniWebPlatform to setMiniWebPlatform().\`);
};
export const setMiniWebPlatform = (value, environment = defaultEnvironment) => {
  const state = getState();
  const platform = selectPlatform(value, environment);
  state.platforms[environment] = platform;
  state.currentEnvironment = environment;
  return platform;
};
export const clearMiniWebPlatform = (environment = defaultEnvironment) => {
  const state = getState();
  delete state.platforms[environment];
  if (state.currentEnvironment === environment) {
    state.currentEnvironment = defaultEnvironment;
  }
};
export const getMiniWebPlatform = (environment = defaultEnvironment) => {
  const state = getState();
  const platform = state.platforms[environment] ?? state.platforms[state.currentEnvironment];
  if (!platform) {
    throw new Error(\`MiniWeb platform import is not bound for environment "\${environment}". Call setMiniWebPlatform(web, environment) or configure miniweb({ app }).\`);
  }
  return platform;
};
const bind = (value, receiver) => typeof value === 'function' ? value.bind(receiver) : value;
const platformObject = (name) => new Proxy({}, {
  get(_target, property) {
    const target = getMiniWebPlatform()[name];
    return bind(Reflect.get(target, property, target), target);
  },
  set(_target, property, value) {
    const target = getMiniWebPlatform()[name];
    return Reflect.set(target, property, value, target);
  },
  has(_target, property) {
    return property in getMiniWebPlatform()[name];
  },
  ownKeys() {
    return Reflect.ownKeys(getMiniWebPlatform()[name]);
  },
  getOwnPropertyDescriptor(_target, property) {
    return Object.getOwnPropertyDescriptor(getMiniWebPlatform()[name], property) ?? {
      configurable: true,
      enumerable: true
    };
  }
});
const platformConstructor = (name) => new Proxy(function MiniWebPlatformConstructor() {}, {
  construct(_target, argumentsList) {
    return Reflect.construct(getMiniWebPlatform()[name], argumentsList);
  },
  apply(_target, thisArgument, argumentsList) {
    return Reflect.apply(getMiniWebPlatform()[name], thisArgument, argumentsList);
  },
  get(_target, property) {
    const target = getMiniWebPlatform()[name];
    return bind(Reflect.get(target, property, target), target);
  }
});
export const fetch = (input, init) => getMiniWebPlatform().fetch(input, init);
export const createFetch = () => getMiniWebPlatform().createFetch();
export const Request = platformConstructor('Request');
export const Response = platformConstructor('Response');
export const Headers = platformConstructor('Headers');
export const URL = platformConstructor('URL');
export const URLSearchParams = platformConstructor('URLSearchParams');
export const FormData = platformConstructor('FormData');
export const Blob = platformConstructor('Blob');
export const File = platformConstructor('File');
export const AbortController = platformConstructor('AbortController');
export const AbortSignal = platformConstructor('AbortSignal');
export const localStorage = platformObject('localStorage');
export const sessionStorage = platformObject('sessionStorage');
export const cookies = platformObject('cookies');
export const caches = platformObject('caches');
export const timers = platformObject('timers');
export const setTimeout = (...arguments_) => getMiniWebPlatform().timers.setTimeout(...arguments_);
export const clearTimeout = (...arguments_) => getMiniWebPlatform().timers.clearTimeout(...arguments_);
export const setInterval = (...arguments_) => getMiniWebPlatform().timers.setInterval(...arguments_);
export const clearInterval = (...arguments_) => getMiniWebPlatform().timers.clearInterval(...arguments_);
export const crypto = platformObject('crypto');
export const TextEncoder = platformConstructor('TextEncoder');
export const TextDecoder = platformConstructor('TextDecoder');
export const structuredClone = (value, options) => getMiniWebPlatform().structuredClone(value, options);
export const atob = (value) => getMiniWebPlatform().atob(value);
export const btoa = (value) => getMiniWebPlatform().btoa(value);
export const queueMicrotask = (callback) => getMiniWebPlatform().queueMicrotask(callback);
export const EventTarget = platformConstructor('EventTarget');
export const Event = platformConstructor('Event');
export const CustomEvent = platformConstructor('CustomEvent');
export const MessageChannel = platformConstructor('MessageChannel');
export const BroadcastChannel = platformConstructor('BroadcastChannel');
export const postMessage = (message, targetOrigin) => getMiniWebPlatform().postMessage(message, targetOrigin);
export const addEventListener = (type, listener) => getMiniWebPlatform().addEventListener(type, listener);
export const removeEventListener = (type, listener) => getMiniWebPlatform().removeEventListener(type, listener);
export const navigator = platformObject('navigator');
export const location = platformObject('location');
${readyCode}
`;
}

function normalizeAppSpecifier(
  app: MiniWebVitePluginOptions['app'],
  root = process.cwd()
): MiniWebVitePluginOptions['app'] {
  if (typeof app !== 'string') {
    return app;
  }
  if (app.startsWith('.') || isAbsolute(app)) {
    const absolutePath = isAbsolute(app) ? app : resolve(root, app);
    return `/@fs/${absolutePath}`;
  }
  return app;
}
