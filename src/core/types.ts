export interface MiniWeb {
  readonly origin: string;
  readonly fs: MemoryFileSystem;
  readonly location: FakeLocation;
  readonly history: FakeHistory;
  readonly navigation: FakeNavigation;
  readonly platform: MiniWebPlatform;
  readonly environments: MiniWebEnvironmentMap;
  readonly trace: PipelineTracer;
  readonly terminal: TerminalRuntime;
  readonly edge: MiniWebEdgeRuntime;
  readonly frontend: MiniWebFrontendRuntime;
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  navigate(url: string): Promise<Response>;
  reload(): Promise<Response>;
  reset(): Promise<void>;
}

export interface MiniWebRuntime {
  readonly running: boolean;
}

export interface MemoryFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, value: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  readdir(prefix?: string): Promise<string[]>;
  snapshot(): Record<string, string>;
}

export interface FakeLocation {
  readonly href: string;
  readonly origin: string;
  readonly protocol: string;
  readonly host: string;
  readonly hostname: string;
  readonly port: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
  assign(url: string): void;
  replace(url: string): void;
  reload(): void;
  toString(): string;
  toRequest(init?: RequestInit): Request;
}

export interface FakeHistory {
  readonly length: number;
  readonly state: unknown;
  scrollRestoration: 'auto' | 'manual';
  pushState(state: unknown, unused: string, url?: string): void;
  replaceState(state: unknown, unused: string, url?: string): void;
  back(): void;
  forward(): void;
  go(delta?: number): void;
  entries(): FakeHistoryEntry[];
  current(): FakeHistoryEntry;
  subscribe(listener: FakeHistoryListener): () => void;
}

export interface FakeHistoryEntry {
  id: string;
  key: string;
  index: number;
  url: string;
  state: unknown;
}

export type FakeHistoryListener = (entry: FakeHistoryEntry) => void;

export interface FakeNavigation {
  readonly currentEntry: FakeNavigationHistoryEntry;
  entries(): FakeNavigationHistoryEntry[];
  navigate(url: string, options?: FakeNavigationOptions): FakeNavigationResult;
  reload(options?: FakeNavigationReloadOptions): FakeNavigationResult;
  traverseTo(key: string, options?: FakeNavigationOptions): FakeNavigationResult;
  addEventListener(type: 'navigate', listener: (event: FakeNavigateEvent) => void): void;
  addEventListener(
    type: Exclude<FakeNavigationEventType, 'navigate'>,
    listener: (event: FakeNavigationSimpleEvent) => void
  ): void;
  removeEventListener(type: 'navigate', listener: (event: FakeNavigateEvent) => void): void;
  removeEventListener(
    type: Exclude<FakeNavigationEventType, 'navigate'>,
    listener: (event: FakeNavigationSimpleEvent) => void
  ): void;
}

export interface FakeNavigationOptions {
  state?: unknown;
  userInitiated?: boolean;
}

export interface FakeNavigationReloadOptions {
  state?: unknown;
}

export interface FakeNavigationResult {
  committed: Promise<FakeNavigationHistoryEntry>;
  finished: Promise<FakeNavigationHistoryEntry>;
}

export interface FakeNavigationHistoryEntry {
  readonly id: string;
  readonly key: string;
  readonly index: number;
  readonly url: string;
  readonly sameDocument: boolean;
  getState(): unknown;
}

export type FakeNavigationEventType =
  | 'navigate'
  | 'currententrychange'
  | 'navigatesuccess'
  | 'navigateerror';

export type FakeNavigationListener = (
  event: FakeNavigateEvent | FakeNavigationSimpleEvent
) => void;

export interface FakeNavigationSimpleEvent {
  readonly type: Exclude<FakeNavigationEventType, 'navigate'>;
  readonly error?: unknown;
}

export interface FakeNavigateEvent {
  readonly type: 'navigate';
  readonly destination: {
    url: string;
    sameDocument: boolean;
  };
  readonly canIntercept: boolean;
  readonly userInitiated: boolean;
  intercept(options: { handler: () => Promise<void> | void }): void;
}

export interface FetchApp {
  fetch(
    request: Request,
    env: MiniWebEnv,
    context: MiniWebContext
  ): Promise<Response> | Response;
}

export interface MiniWebEnv {
  NODE_ENV?: string;
  [key: string]: string | undefined;
}

export interface MiniWebContext {
  fs: MemoryFileSystem;
  location: FakeLocation;
  history: FakeHistory;
  navigation: FakeNavigation;
  readonly environment: MiniWebEnvironmentRuntime;
  readonly environments: MiniWebEnvironmentMap;
  readonly platform: MiniWebPlatform;
  trace: PipelineTracer;
  edgeCache: EdgeCache;
  waitUntil(promise: Promise<unknown>): void;
}

export type MiniWebAppName = string;
export type MiniWebPlatformName = string;
export type MiniWebRuntimeName = string;

export interface MiniWebAppDefinition {
  origin: string;
  apps: Record<MiniWebAppName, MiniWebRegisteredAppConfig>;
  platforms?: Record<MiniWebPlatformName, MiniWebPlatformDefinition>;
  runtimes?: Record<MiniWebRuntimeName, MiniWebRuntimeDefinition>;
  routes: MiniWebMiddleware[];
  files?: Record<string, string>;
  env?: Record<string, string>;
  platform?: MiniWebPlatformConfig;
  delay?: DelayConfig;
  proxyHooks?: MiniWebProxyHooks;
  ui?: {
    syncRealUrl?: boolean;
    realUrlBasePath?: string;
  };
}

export interface MiniWebRegisteredAppConfig {
  app: FetchApp;
  platform?: MiniWebPlatformName;
  runtime?: MiniWebRuntimeName;
  basePath?: string;
  baseUrl?: string;
  files?: Record<string, string>;
}

export interface MiniWebPlatformDefinition {
  basePath?: string;
  baseUrl?: string;
}

export type MiniWebRuntimeDefinition = MiniWebEnvironmentExecutionConfig;

export interface MiniWebCreateOptions {
  runtimes?: Record<MiniWebRuntimeName, MiniWebRuntimeDefinition>;
}

export type MiniWebNext = (request?: Request) => Promise<Response> | Response;

export type MiniWebMiddleware = (
  request: Request,
  context: MiniWebRouteContext,
  next: MiniWebNext
) => Promise<Response> | Response;

export interface MiniWebRouteState {
  params: Record<string, string>;
  vhost?: string;
  mountPath?: string;
  cacheHit?: boolean;
  target?: string;
}

export interface MiniWebRouteContext extends MiniWebContext {
  route: MiniWebRouteState;
  fetchApp(name: MiniWebAppName, request: Request): Promise<Response>;
}

export type MiniWebBuiltinEnvironmentName =
  | 'frontend'
  | 'serviceWorker'
  | 'edge'
  | 'backend'
  | 'test';

export type MiniWebEnvironmentName = MiniWebBuiltinEnvironmentName | (string & {});

export type MiniWebConfiguredEnvironmentName = Exclude<MiniWebBuiltinEnvironmentName, 'test'>;

export type MiniWebEnvironmentExecutionConfig =
  | {
      mode: 'same-realm';
      location?: string;
    }
  | {
      mode: 'iframe';
      location?: string;
      sandbox?: string;
    };

export type MiniWebEnvironmentConfig = MiniWebEnvironmentExecutionConfig;

export interface MiniWebEnvironmentRuntime {
  readonly name: MiniWebEnvironmentName;
  readonly execution: MiniWebEnvironmentExecutionConfig;
  readonly location: FakeLocation;
  readonly platform: MiniWebPlatform;
  reset(): void;
  dispose(): void;
}

export type MiniWebEnvironmentMap = Record<
  MiniWebConfiguredEnvironmentName,
  MiniWebEnvironmentRuntime
>;

export interface MiniWebPlatform {
  readonly name: MiniWebEnvironmentName;
  readonly origin: string;
  readonly location: FakeLocation;
  readonly localStorage: MiniWebStorageArea;
  readonly sessionStorage: MiniWebStorageArea;
  readonly cookies: MiniWebCookieJar;
  readonly caches: MiniWebCacheStorage;
  readonly timers: MiniWebTimers;
  readonly crypto: MiniWebCrypto;
  readonly navigator: MiniWebNavigator;
  readonly TextEncoder: typeof TextEncoder;
  readonly TextDecoder: typeof TextDecoder;
  readonly structuredClone: typeof structuredClone;
  readonly atob: typeof atob;
  readonly btoa: typeof btoa;
  readonly queueMicrotask: typeof queueMicrotask;
  readonly EventTarget: typeof EventTarget;
  readonly Event: typeof Event;
  readonly CustomEvent: typeof CustomEvent;
  readonly MessageChannel: typeof MessageChannel;
  readonly BroadcastChannel: typeof BroadcastChannel;
  readonly Request: typeof Request;
  readonly Response: typeof Response;
  readonly Headers: typeof Headers;
  readonly URL: typeof URL;
  readonly URLSearchParams: typeof URLSearchParams;
  readonly FormData: typeof FormData;
  readonly Blob: typeof Blob;
  readonly File: typeof File;
  readonly AbortController: typeof AbortController;
  readonly AbortSignal: typeof AbortSignal;
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  createFetch(): typeof fetch;
  postMessage(message: unknown, targetOrigin?: string): void;
  addEventListener(type: 'message', listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: 'message', listener: EventListenerOrEventListenerObject): void;
  reset(): void;
  dispose(): void;
}

export interface MiniWebTimers {
  setTimeout(handler: TimerHandler, timeout?: number, ...arguments_: unknown[]): number;
  clearTimeout(id: number): void;
  setInterval(handler: TimerHandler, timeout?: number, ...arguments_: unknown[]): number;
  clearInterval(id: number): void;
  queueMicrotask(callback: VoidFunction): void;
  clearAll(): void;
}

export interface MiniWebCrypto {
  readonly subtle: SubtleCrypto;
  randomUUID(): string;
  getRandomValues<T extends ArrayBufferView | null>(array: T): T;
}

export interface MiniWebNavigator {
  readonly userAgent: string;
  readonly onLine: boolean;
  readonly language: string;
}

export interface MiniWebPlatformConfig {
  deterministicCrypto?: boolean;
  cryptoSeed?: number;
  navigator?: Partial<MiniWebNavigator>;
}

export interface MiniWebStorageArea {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  snapshot(): Record<string, string>;
}

export interface MiniWebCookieJar {
  getCookieHeader(url: string | URL): string;
  setCookie(url: string | URL, value: string | string[]): void;
  deleteCookie(url: string | URL, name: string): void;
  clear(): void;
  snapshot(): Record<string, string>;
}

export interface MiniWebCacheStorage {
  open(name: string): Promise<MiniWebCache>;
  has(name: string): Promise<boolean>;
  delete(name: string): Promise<boolean>;
  keys(): Promise<string[]>;
  match(request: string | URL | Request, options?: MiniWebCacheQueryOptions): Promise<Response | undefined>;
  clear(): Promise<void>;
}

export interface MiniWebCache {
  match(request: string | URL | Request, options?: MiniWebCacheQueryOptions): Promise<Response | undefined>;
  put(request: string | URL | Request, response: Response): Promise<void>;
  delete(request: string | URL | Request, options?: MiniWebCacheQueryOptions): Promise<boolean>;
  keys(): Promise<Request[]>;
}

export interface MiniWebCacheQueryOptions {
  ignoreSearch?: boolean;
  ignoreMethod?: boolean;
}

export type MiniWebPlatformFetchHandler = (
  environment: MiniWebEnvironmentRuntime,
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export interface MiniWebTraceEntry {
  id: string;
  boundary:
    | 'frontend:request'
    | 'frontend:response'
    | 'service-worker:request'
    | 'service-worker:response'
    | 'network:request'
    | 'network:response'
    | 'edge:request'
    | 'edge:cache-hit'
    | 'edge:cache-miss'
    | 'edge:cache-put'
    | 'edge:response'
    | 'backend:request'
    | 'backend:response'
    | 'miniweb-network:request'
    | 'miniweb-network:response'
    | 'stream:start'
    | 'stream:chunk'
    | 'stream:end'
    | 'delay:start'
    | 'delay:end'
    | 'error';
  method: string;
  url: string;
  status?: number;
  timestamp: number;
  detail?: unknown;
}

export type PipelineTraceListener = (entry: MiniWebTraceEntry) => void;

export interface PipelineTracer {
  entries(): MiniWebTraceEntry[];
  clear(): void;
  subscribe(listener: PipelineTraceListener): () => void;
}

export interface PipelineTraceController extends PipelineTracer {
  record(entry: Omit<MiniWebTraceEntry, 'id' | 'timestamp'> & {
    id?: string;
    timestamp?: number;
  }): MiniWebTraceEntry;
}

export type BrowserFrameStreamingMode =
  | 'buffer'
  | 'document-write'
  | 'message-chunks';

export type FrontendLayerConfig =
  | {
      kind: 'browser-frame';
      frame: HTMLIFrameElement;
      streaming?: BrowserFrameStreamingMode;
    }
  | {
      kind: 'node-dom';
    }
  | {
      kind: 'headless';
    };

export type ServiceWorkerLayerConfig =
  | {
      kind: 'fake';
      routes?: MiniWebServiceWorkerRoute[];
    }
  | {
      kind: 'bypass';
    }
  | {
      kind: 'real-browser';
      scriptUrl: string;
    };

export interface MiniWebServiceWorkerRoute {
  pattern: string | RegExp | MiniWebServiceWorkerRouteMatcher;
  handler: MiniWebServiceWorkerRouteHandler;
}

export type MiniWebServiceWorkerRouteMatcher = (url: URL, request: Request) => boolean;

export type MiniWebServiceWorkerRouteHandler = (
  request: Request,
  context: MiniWebContext,
  next: () => Promise<Response> | Response
) => Promise<Response> | Response;

export type NetworkLayerConfig =
  | {
      kind: 'blocked';
    }
  | {
      kind: 'miniweb-network';
      allowExternalFetch?: boolean;
    }
  | {
      kind: 'real-fetch';
    };

export type EdgeLayerConfig =
  | {
      kind: 'fake';
      worker?: EdgeWorker;
      cache?: EdgeCacheConfig;
      region?: string;
    }
  | {
      kind: 'bypass';
    }
  | {
      kind: 'http-proxy';
      targetOrigin: string;
    }
  | {
      kind: 'mock';
      routes: Record<string, MockRouteHandler>;
    };

export type BackendLayerConfig =
  | {
      kind: 'fetch-app';
    }
  | {
      kind: 'http-proxy';
      targetOrigin: string;
    }
  | {
      kind: 'mock';
      routes: Record<string, MockRouteHandler>;
    };

export interface MiniWebLayerConfig {
  frontend: FrontendLayerConfig;
  serviceWorker: ServiceWorkerLayerConfig;
  network?: NetworkLayerConfig;
  edge?: EdgeLayerConfig;
  backend: BackendLayerConfig;
}

export interface MiniWebConfig {
  origin: string;
  files?: Record<string, string>;
  app?: FetchApp;
  network?: MiniWebNetwork;
  environments?: Partial<Record<MiniWebConfiguredEnvironmentName, MiniWebEnvironmentConfig>>;
  platform?: MiniWebPlatformConfig;
  pipeline: MiniWebLayerConfig;
  env?: Record<string, string>;
  edgeEnv?: Record<string, string>;
  delay?: DelayConfig;
  proxyHooks?: MiniWebProxyHooks;
  ui?: {
    syncRealUrl?: boolean;
    realUrlBasePath?: string;
  };
}

export type MiniWebFrontendKind = 'browser-frame' | 'node-dom' | 'headless';

export interface MiniWebFrontendRuntime {
  readonly kind: MiniWebFrontendKind;
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  navigate(url: string): Promise<Response>;
  reload(): Promise<Response>;
}

export interface MiniWebEdgeRuntime {
  readonly cache: EdgeCache;
  readonly region: string;
}

export interface MiniWebFrontendDriver {
  readonly kind: string;
}

export interface MiniWebServiceWorkerDriver {
  dispatchFetch(
    request: Request,
    context: MiniWebContext,
    next: () => Promise<Response> | Response
  ): Promise<Response>;
}

export interface MiniWebNetworkDriver {
  fetch(request: Request, next: () => Promise<Response>): Promise<Response>;
}

export interface MiniWebEdgeDriver {
  fetch(request: Request, next: (request?: Request) => Promise<Response>): Promise<Response>;
}

export interface MiniWebBackendDriver {
  fetch(request: Request): Promise<Response>;
}

export type MockRouteHandler = (
  request: Request,
  context: MiniWebContext
) => Promise<Response> | Response;

export interface MiniWebNetwork {
  register(origin: string, web: MiniWeb): void;
  unregister(origin: string): void;
  fetch(request: Request): Promise<Response>;
  origins(): string[];
}

export interface EdgeWorker {
  fetch(
    request: Request,
    env: EdgeWorkerEnv,
    context: EdgeWorkerContext
  ): Promise<Response> | Response;
}

export interface EdgeWorkerEnv {
  NODE_ENV?: string;
  EDGE_ENV?: string;
  CDN_REGION?: string;
  [key: string]: string | undefined;
}

export interface EdgeWorkerContext {
  fs: MemoryFileSystem;
  edgeCache: EdgeCache;
  trace: PipelineTracer;
  region: string;
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
  next(request?: Request): Promise<Response>;
}

export interface EdgeCache {
  match(request: Request, options?: EdgeCacheMatchOptions): Promise<Response | undefined>;
  put(request: Request, response: Response, options?: EdgeCachePutOptions): Promise<void>;
  delete(request: Request): Promise<boolean>;
  purgeByTag(tag: string): Promise<number>;
  purgeByPath(pathname: string): Promise<number>;
  purgeAll(): Promise<void>;
  keys(): Promise<EdgeCacheEntryInfo[]>;
}

export interface EdgeCacheConfig {
  enabled?: boolean;
  defaultTtl?: number;
  respectCacheControl?: boolean;
}

export interface EdgeCacheMatchOptions {
  ignoreMethod?: boolean;
  ignoreSearch?: boolean;
}

export interface EdgeCachePutOptions {
  ttl?: number;
  tags?: string[];
  vary?: string[];
}

export interface EdgeCacheEntryInfo {
  key: string;
  url: string;
  method: string;
  status: number;
  createdAt: number;
  expiresAt?: number;
  tags: string[];
}

export interface TerminalRuntime {
  run(command: string): Promise<TerminalResult>;
  register(command: string, handler: TerminalCommandHandler): void;
  output(): string;
  clear(): void;
  subscribe(listener: TerminalOutputListener): () => void;
}

export interface TerminalResult {
  command: string;
  exitCode: number;
  output: string;
}

export type TerminalCommandHandler = (
  command: string,
  args: string[]
) => Promise<TerminalResult | string | void> | TerminalResult | string | void;

export type TerminalOutputListener = (output: string) => void;

export interface DelayConfig {
  enabled?: boolean;
  defaultDelayMs?: number;
  jitterMs?: number;
  seed?: number;
  requestDelayMs?: number;
  responseDelayMs?: number;
  streamChunkDelayMs?: number;
  streamFirstChunkDelayMs?: number;
  boundaries?: Partial<Record<DelayBoundary, BoundaryDelayConfig>>;
  routes?: DelayRouteConfig[];
}

export type DelayBoundary =
  | 'frontend'
  | 'service-worker'
  | 'network'
  | 'edge'
  | 'backend'
  | 'miniweb-network';

export interface BoundaryDelayConfig {
  enabled?: boolean;
  requestDelayMs?: number;
  responseDelayMs?: number;
  streamFirstChunkDelayMs?: number;
  streamChunkDelayMs?: number;
  jitterMs?: number;
}

export interface DelayRouteConfig {
  pattern: string | RegExp;
  delay: BoundaryDelayConfig;
}

export interface DelayController {
  delayBoundaryRequest(boundary: DelayBoundary, request: Request): Promise<void>;
  delayBoundaryResponse(boundary: DelayBoundary, request: Request, response: Response): Promise<void>;
  delayStream<T extends Uint8Array | string>(
    boundary: DelayBoundary,
    request: Request,
    stream: ReadableStream<T>
  ): ReadableStream<T>;
  wait(ms: number): Promise<void>;
}

export interface MiniWebProxyHooks {
  onFrontendRequest?: ProxyHook;
  onFrontendResponse?: ProxyHook;
  onServiceWorkerRequest?: ProxyHook;
  onServiceWorkerResponse?: ProxyHook;
  onNetworkRequest?: ProxyHook;
  onNetworkResponse?: ProxyHook;
  onEdgeRequest?: ProxyHook;
  onEdgeResponse?: ProxyHook;
  onBackendRequest?: ProxyHook;
  onBackendResponse?: ProxyHook;
}

export type ProxyHook = (event: ProxyHookEvent) => Promise<void> | void;

export interface ProxyHookEvent {
  boundary: MiniWebTraceEntry['boundary'];
  request?: Request;
  response?: Response;
  context: MiniWebContext;
}
