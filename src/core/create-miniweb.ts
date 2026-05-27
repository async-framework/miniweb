import { createBackendDriver } from './create-backend-driver.ts';
import { createDelayController } from './create-delay-controller.ts';
import { createEdgeCache } from './create-edge-cache.ts';
import { createEdgeDriver } from './create-edge-driver.ts';
import { createFakeHistory } from './create-fake-history.ts';
import { createFakeLocation } from './create-fake-location.ts';
import { createFakeNavigation } from './create-fake-navigation.ts';
import { createFakeServiceWorker } from './create-fake-service-worker.ts';
import { createMemoryFileSystem } from './create-memory-file-system.ts';
import { createNetworkDriver } from './create-network-driver.ts';
import { composeMiniWeb, finalMiniWebHandler } from './create-miniweb-router.ts';
import {
  createMiniWebEnvironmentRuntime,
  createMiniWebEnvironmentRuntimes
} from './platform/create-platform.ts';
import { createPipelineTracer } from './create-pipeline-tracer.ts';
import { recordStreamLifecycle } from './create-stream-delay-transform.ts';
import { createTerminalRuntime } from './create-terminal-runtime.ts';
import type {
  BackendLayerConfig,
  DelayBoundary,
  DelayController,
  EdgeLayerConfig,
  EdgeCacheConfig,
  MiniWeb,
  MiniWebAppDefinition,
  MiniWebConfig,
  MiniWebContext,
  MiniWebCreateOptions,
  MiniWebCookieJar,
  MiniWebEnvironmentExecutionConfig,
  MiniWebEnvironmentMap,
  MiniWebEnvironmentRuntime,
  MiniWebEnv,
  MiniWebPlatformFetchHandler,
  MiniWebProxyHooks,
  MiniWebRouteContext,
  NetworkLayerConfig,
  PipelineTraceController,
  ProxyHook
} from './types.ts';

export async function createMiniWeb(
  config: MiniWebConfig | MiniWebAppDefinition,
  options: MiniWebCreateOptions = {}
): Promise<MiniWeb> {
  if (isMiniWebAppDefinition(config)) {
    return createMiniWebFromAppDefinition(config, options);
  }

  const legacyConfig = config;
  const origin = new URL(config.origin).origin;
  const trace = createPipelineTracer();
  const edgeConfig = config.pipeline.edge ?? defaultEdgeConfig();
  const context = createMiniWebContext({
    origin,
    files: config.files,
    trace,
    edgeCacheConfig: edgeConfig.kind === 'fake' ? edgeConfig.cache : undefined
  });
  let dispatchPlatformFetch: MiniWebPlatformFetchHandler = async () => {
    throw new Error('MiniWeb platform fetch is not ready');
  };
  const environments = createMiniWebEnvironmentRuntimes({
    origin,
    frontendLocation: context.location,
    config: config.environments,
    platform: config.platform,
    fetch(environment, input, init) {
      return dispatchPlatformFetch(environment, input, init);
    }
  });
  bindMiniWebContextEnvironment(context, environments.frontend, environments);
  const delay = createDelayController(config.delay, trace);
  const networkConfig = config.pipeline.network ?? defaultNetworkConfig();
  const env: MiniWebEnv = {
    NODE_ENV: 'test',
    ...config.env
  };
  const edgeEnv: MiniWebEnv = {
    ...env,
    ...config.edgeEnv
  };
  const backendDriver = createBackendDriver({
    config: config.pipeline.backend,
    app: config.app,
    env,
    context
  });
  const edgeDriver = createEdgeDriver({
    config: edgeConfig,
    context,
    env: edgeEnv,
    trace
  });
  const networkDriver = createNetworkDriver({
    origin,
    config: networkConfig,
    network: config.network
  });
  const serviceWorker = createFakeServiceWorker();
  if (config.pipeline.serviceWorker.kind === 'fake') {
    for (const route of config.pipeline.serviceWorker.routes ?? []) {
      serviceWorker.route(route.pattern, route.handler);
    }
  }
  let running = false;
  const terminal = createTerminalRuntime({
    fs: context.fs,
    origin,
    setRunning(value) {
      running = value;
    }
  });

  async function backendStage(request: Request): Promise<Response> {
    return withEnvironment(context, environments.backend, async () => {
      record(trace, 'backend:request', request);
      await callHook(config.proxyHooks?.onBackendRequest, 'backend:request', context, request);
      await delay.delayBoundaryRequest('backend', request);
      try {
        let response = await backendDriver.fetch(request);
        await delay.delayBoundaryResponse('backend', request, response);
        response = delayResponseStream(delay, 'backend', request, response);
        response = maybeTraceStream(trace, request, response);
        record(trace, 'backend:response', request, response);
        await callHook(config.proxyHooks?.onBackendResponse, 'backend:response', context, request, response);
        return response;
      } catch (error) {
        record(trace, 'error', request, undefined, {
          boundary: 'backend',
          message: error instanceof Error ? error.message : String(error)
        });
        const response = new Response('Internal MiniWeb backend error', {
          status: 500
        });
        record(trace, 'backend:response', request, response);
        return response;
      }
    });
  }

  async function edgeStage(request: Request): Promise<Response> {
    return withEnvironment(context, environments.edge, async () => {
      record(trace, 'edge:request', request);
      await callHook(config.proxyHooks?.onEdgeRequest, 'edge:request', context, request);
      await delay.delayBoundaryRequest('edge', request);
      let response = await edgeDriver.fetch(request, (nextRequest = request) => backendStage(nextRequest));
      await delay.delayBoundaryResponse('edge', request, response);
      response = delayResponseStream(delay, 'edge', request, response);
      record(trace, 'edge:response', request, response);
      await callHook(config.proxyHooks?.onEdgeResponse, 'edge:response', context, request, response);
      return response;
    });
  }

  async function networkStage(request: Request): Promise<Response> {
    record(trace, 'network:request', request);
    await callHook(config.proxyHooks?.onNetworkRequest, 'network:request', context, request);
    await delay.delayBoundaryRequest('network', request);
    let response: Response;
    const requestUrl = new URL(request.url);
    if (networkConfig.kind === 'miniweb-network' && requestUrl.origin !== origin) {
      record(trace, 'miniweb-network:request', request);
      await delay.delayBoundaryRequest('miniweb-network', request);
      response = await networkDriver.fetch(request, () => edgeStage(request));
      await delay.delayBoundaryResponse('miniweb-network', request, response);
      record(trace, 'miniweb-network:response', request, response);
    } else {
      response = await networkDriver.fetch(request, () => edgeStage(request));
    }
    await delay.delayBoundaryResponse('network', request, response);
    response = delayResponseStream(delay, 'network', request, response);
    record(trace, 'network:response', request, response);
    await callHook(config.proxyHooks?.onNetworkResponse, 'network:response', context, request, response);
    return response;
  }

  async function serviceWorkerStage(request: Request): Promise<Response> {
    return withEnvironment(context, environments.serviceWorker, async () => {
      record(trace, 'service-worker:request', request);
      await callHook(config.proxyHooks?.onServiceWorkerRequest, 'service-worker:request', context, request);
      await delay.delayBoundaryRequest('service-worker', request);
      let response = legacyConfig.pipeline.serviceWorker.kind === 'fake'
        ? await serviceWorker.dispatchFetch(request, context, () => networkStage(request))
        : await networkStage(request);
      await delay.delayBoundaryResponse('service-worker', request, response);
      response = delayResponseStream(delay, 'service-worker', request, response);
      record(trace, 'service-worker:response', request, response);
      await callHook(config.proxyHooks?.onServiceWorkerResponse, 'service-worker:response', context, request, response);
      return response;
    });
  }

  async function fetchThroughPipeline(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    return environments.frontend.platform.fetch(input, init);
  }

  async function frontendStage(request: Request): Promise<Response> {
    return withEnvironment(context, environments.frontend, async () => {
      record(trace, 'frontend:request', request);
      await callHook(config.proxyHooks?.onFrontendRequest, 'frontend:request', context, request);
      await delay.delayBoundaryRequest('frontend', request);
      let response = await serviceWorkerStage(request);
      await delay.delayBoundaryResponse('frontend', request, response);
      response = delayResponseStream(delay, 'frontend', request, response);
      record(trace, 'frontend:response', request, response);
      await callHook(config.proxyHooks?.onFrontendResponse, 'frontend:response', context, request, response);
      return response;
    });
  }

  dispatchPlatformFetch = async (environment, input, init) => {
    let request = toMiniWebRequest(input, init, environment.location.href);
    request = applyRequestCookies(request, environment.platform.cookies);
    return runAbortable(request.signal, async () => {
      let response: Response;
      if (environment.name === 'frontend' || environment.name === 'test') {
        response = await frontendStage(request);
      } else if (environment.name === 'serviceWorker' || environment.name === 'backend') {
        response = await networkStage(request);
      } else {
        response = new URL(request.url).origin === origin
          ? await backendStage(request)
          : await networkStage(request);
      }
      storeResponseCookies(request, response, environment.platform.cookies);
      return response;
    });
  };

  const web: MiniWeb = {
    origin,
    fs: context.fs,
    location: context.location,
    history: context.history,
    navigation: context.navigation,
    platform: environments.frontend.platform,
    environments,
    trace,
    terminal,
    edge: {
      cache: context.edgeCache,
      region: edgeConfig.kind === 'fake' ? edgeConfig.region ?? 'local' : 'local'
    },
    frontend: {
      kind: config.pipeline.frontend.kind,
      fetch: fetchThroughPipeline,
      navigate(url) {
        return web.navigate(url);
      },
      reload() {
        return web.reload();
      }
    },
    fetch: fetchThroughPipeline,
    async navigate(url) {
      const result = context.navigation.navigate(url);
      await result.finished;
      return fetchThroughPipeline(context.location.href);
    },
    async reload() {
      context.location.reload();
      return fetchThroughPipeline(context.location.href);
    },
    async reset() {
      trace.clear();
      running = false;
      terminal.clear();
      await context.edgeCache.purgeAll();
      for (const environment of Object.values(environments)) {
        environment.reset();
      }
      resetFakeHistory(context.history, `${origin}/`);
      bindMiniWebContextEnvironment(context, environments.frontend, environments);
      for (const path of await context.fs.readdir()) {
        await context.fs.deleteFile(path);
      }
      for (const [path, value] of Object.entries(config.files ?? {})) {
        await context.fs.writeFile(path, value);
      }
    }
  };

  void running;
  return web;
}

async function createMiniWebFromAppDefinition(
  config: MiniWebAppDefinition,
  options: MiniWebCreateOptions
): Promise<MiniWeb> {
  validateMiniWebAppDefinition(config);
  const origin = new URL(config.origin).origin;
  const trace = createPipelineTracer();
  const context = createMiniWebContext({
    origin,
    files: collectMiniWebAppFiles(config),
    trace
  });
  let dispatchPlatformFetch: MiniWebPlatformFetchHandler = async () => {
    throw new Error('MiniWeb route fetch is not ready');
  };
  const environments = createMiniWebEnvironmentRuntimes({
    origin,
    frontendLocation: context.location,
    platform: config.platform,
    fetch(environment, input, init) {
      return dispatchPlatformFetch(environment, input, init);
    }
  });
  bindMiniWebContextEnvironment(context, environments.frontend, environments);
  const delay = createDelayController(config.delay, trace);
  const env: MiniWebEnv = {
    NODE_ENV: 'test',
    ...config.env
  };
  const appPlatforms = createMiniWebAppPlatformRuntimes({
    config,
    options,
    origin,
    fetch(environment, input, init) {
      return dispatchPlatformFetch(environment, input, init);
    }
  });
  const frontendRuntime = appPlatforms.get('frontend') ?? environments.frontend;
  bindMiniWebContextEnvironment(context, frontendRuntime, environments);
  const terminal = createTerminalRuntime({
    fs: context.fs,
    origin,
    setRunning() {}
  });
  const routeContext = context as MiniWebRouteContext;
  routeContext.route = {
    params: {}
  };
  routeContext.fetchApp = fetchRegisteredApp;
  const router = composeMiniWeb(config.routes);

  async function fetchRegisteredApp(name: string, request: Request): Promise<Response> {
    const registered = config.apps[name];
    if (!registered) {
      return new Response(`MiniWeb app is not registered: ${name}`, {
        status: 502
      });
    }
    const environment = appPlatforms.get(name) ?? (name === 'frontend' ? environments.frontend : environments.backend);
    return withEnvironment(context, environment, async () => {
      if (name !== 'frontend') {
        record(trace, 'backend:request', request, undefined, {
          app: name
        });
      }
      try {
        const appRequest = environment.execution.mode === 'iframe'
          ? await bufferRequestForRuntime(request)
          : request;
        let response = await registered.app.fetch(appRequest, env, context);
        if (environment.execution.mode === 'iframe') {
          response = await bufferResponseForRuntime(response);
        }
        if (name !== 'frontend') {
          record(trace, 'backend:response', request, response, {
            app: name
          });
        }
        return response;
      } catch (error) {
        record(trace, 'error', request, undefined, {
          app: name,
          message: error instanceof Error ? error.message : String(error)
        });
        return new Response('Internal MiniWeb app error', {
          status: 500
        });
      }
    });
  }

  async function dispatchRoutes(request: Request): Promise<Response> {
    routeContext.route = {
      params: {}
    };
    return router(request, routeContext, finalMiniWebHandler);
  }

  dispatchPlatformFetch = async (environment, input, init) => {
    let request = toMiniWebRequest(input, init, environment.location.href);
    request = applyRequestCookies(request, environment.platform.cookies);
    return runAbortable(request.signal, async () => {
      record(trace, 'frontend:request', request);
      await callHook(config.proxyHooks?.onFrontendRequest, 'frontend:request', context, request);
      await delay.delayBoundaryRequest('frontend', request);
      let response = await dispatchRoutes(request);
      await delay.delayBoundaryResponse('frontend', request, response);
      response = delayResponseStream(delay, 'frontend', request, response);
      record(trace, 'frontend:response', request, response);
      await callHook(config.proxyHooks?.onFrontendResponse, 'frontend:response', context, request, response);
      storeResponseCookies(request, response, environment.platform.cookies);
      return response;
    });
  };

  async function fetchThroughRoutes(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    return frontendRuntime.platform.fetch(input, init);
  }

  const web: MiniWeb = {
    origin,
    fs: context.fs,
    location: context.location,
    history: context.history,
    navigation: context.navigation,
    platform: frontendRuntime.platform,
    environments,
    trace,
    terminal,
    edge: {
      cache: context.edgeCache,
      region: 'local'
    },
    frontend: {
      kind: 'headless',
      fetch: fetchThroughRoutes,
      navigate(url) {
        return web.navigate(url);
      },
      reload() {
        return web.reload();
      }
    },
    fetch: fetchThroughRoutes,
    async navigate(url) {
      const result = context.navigation.navigate(url);
      await result.finished;
      return fetchThroughRoutes(context.location.href);
    },
    async reload() {
      context.location.reload();
      return fetchThroughRoutes(context.location.href);
    },
    async reset() {
      trace.clear();
      terminal.clear();
      await context.edgeCache.purgeAll();
      for (const environment of Object.values(environments)) {
        environment.reset();
      }
      for (const environment of appPlatforms.values()) {
        environment.reset();
      }
      resetFakeHistory(context.history, `${origin}/`);
      bindMiniWebContextEnvironment(context, frontendRuntime, environments);
      for (const path of await context.fs.readdir()) {
        await context.fs.deleteFile(path);
      }
      for (const [path, value] of Object.entries(collectMiniWebAppFiles(config))) {
        await context.fs.writeFile(path, value);
      }
    }
  };

  return web;
}

export function createMiniWebContext(options: {
  origin: string;
  files?: Record<string, string>;
  trace?: PipelineTraceController;
  edgeCacheConfig?: EdgeCacheConfig;
}): MiniWebContext {
  const origin = new URL(options.origin).origin;
  const fs = createMemoryFileSystem(options.files);
  const location = createFakeLocation(`${origin}/`);
  const history = createFakeHistory(location);
  const navigation = createFakeNavigation(location, history);
  const trace = options.trace ?? createPipelineTracer();
  const edgeCache = createEdgeCache(options.edgeCacheConfig);
  const waitUntilPromises = new Set<Promise<unknown>>();
  const environmentState = createEnvironmentState(options.origin, location);

  return {
    fs,
    location,
    history,
    navigation,
    get environment() {
      return environmentState.current;
    },
    get environments() {
      return environmentState.environments;
    },
    get platform() {
      return environmentState.current.platform;
    },
    trace,
    edgeCache,
    waitUntil(promise) {
      waitUntilPromises.add(promise);
      promise.finally(() => {
        waitUntilPromises.delete(promise);
      });
    },
    [miniWebEnvironmentState]: environmentState
  } as MiniWebContext;
}

function resetFakeHistory(history: MiniWebContext['history'], url: string): void {
  const resettable = history as MiniWebContext['history'] & {
    reset?: (url: string, state?: unknown) => void;
  };
  if (resettable.reset) {
    resettable.reset(url, null);
    return;
  }
  history.replaceState(null, '', url);
}

function defaultNetworkConfig(): NetworkLayerConfig {
  return {
    kind: 'blocked'
  };
}

function defaultEdgeConfig(): EdgeLayerConfig {
  return {
    kind: 'bypass'
  };
}

function isMiniWebAppDefinition(config: MiniWebConfig | MiniWebAppDefinition): config is MiniWebAppDefinition {
  return 'apps' in config && 'routes' in config;
}

function validateMiniWebAppDefinition(config: MiniWebAppDefinition): void {
  if (Object.keys(config.apps).length === 0) {
    throw new Error('MiniWeb requires at least one registered app');
  }
  for (const [name, app] of Object.entries(config.apps)) {
    if (!app.app || typeof app.app.fetch !== 'function') {
      throw new Error(`MiniWeb app requires a fetch handler: ${name}`);
    }
    if (app.basePath && app.baseUrl) {
      throw new Error(`MiniWeb app cannot define both basePath and baseUrl: ${name}`);
    }
    const platform = app.platform ? config.platforms?.[app.platform] : undefined;
    if (platform?.basePath && platform.baseUrl) {
      throw new Error(`MiniWeb platform cannot define both basePath and baseUrl: ${app.platform}`);
    }
    if (app.runtime && config.runtimes && !config.runtimes[app.runtime]) {
      throw new Error(`MiniWeb app references an unknown runtime: ${app.runtime}`);
    }
  }
  for (const [name, platform] of Object.entries(config.platforms ?? {})) {
    if (platform.basePath && platform.baseUrl) {
      throw new Error(`MiniWeb platform cannot define both basePath and baseUrl: ${name}`);
    }
    if (platform.baseUrl) {
      new URL(platform.baseUrl);
    }
  }
}

function createMiniWebAppPlatformRuntimes(options: {
  config: MiniWebAppDefinition;
  options: MiniWebCreateOptions;
  origin: string;
  fetch: MiniWebPlatformFetchHandler;
}): Map<string, MiniWebEnvironmentRuntime> {
  const runtimes = new Map<string, MiniWebEnvironmentRuntime>();
  for (const [name, app] of Object.entries(options.config.apps)) {
    const baseUrl = resolveMiniWebAppBaseUrl(options.config, name);
    const execution = resolveMiniWebAppRuntime(options.config, options.options, name, baseUrl);
    const location = createFakeLocation(execution.location ?? baseUrl);
    runtimes.set(name, createMiniWebEnvironmentRuntime({
      name: app.platform ?? name,
      origin: options.origin,
      execution,
      location,
      platform: options.config.platform,
      fetch: options.fetch
    }));
  }
  return runtimes;
}

function resolveMiniWebAppRuntime(
  config: MiniWebAppDefinition,
  options: MiniWebCreateOptions,
  name: string,
  baseUrl: string
): MiniWebEnvironmentExecutionConfig {
  const app = config.apps[name]!;
  const runtimeName = app.runtime ?? name;
  const runtime = options.runtimes?.[runtimeName] ?? config.runtimes?.[runtimeName] ?? {
    mode: 'same-realm' as const
  };
  if (runtime.mode === 'iframe') {
    return {
      mode: 'iframe',
      location: runtime.location ?? baseUrl,
      sandbox: runtime.sandbox
    };
  }
  return {
    mode: 'same-realm',
    location: runtime.location ?? baseUrl
  };
}

function resolveMiniWebAppBaseUrl(config: MiniWebAppDefinition, name: string): string {
  const app = config.apps[name]!;
  const platform = app.platform ? config.platforms?.[app.platform] : config.platforms?.[name];
  const baseUrl = app.baseUrl ?? platform?.baseUrl;
  if (baseUrl) {
    return new URL(baseUrl).href;
  }
  const basePath = app.basePath ?? platform?.basePath ?? (name === 'frontend' ? '/' : `/${name}/`);
  return new URL(basePath, config.origin).href;
}

function collectMiniWebAppFiles(config: MiniWebAppDefinition): Record<string, string> {
  return Object.values(config.apps).reduce<Record<string, string>>((files, app) => {
    return {
      ...files,
      ...app.files
    };
  }, {
    ...config.files
  });
}

async function bufferRequestForRuntime(request: Request): Promise<Request> {
  if (!request.body || request.method === 'GET' || request.method === 'HEAD') {
    return new Request(request);
  }
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: request.headers,
    body: await request.arrayBuffer(),
    duplex: 'half'
  };
  return new Request(request.url, init);
}

async function bufferResponseForRuntime(response: Response): Promise<Response> {
  const body = response.body ? await response.arrayBuffer() : null;
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

function toMiniWebRequest(input: string | URL | Request, init: RequestInit | undefined, base: string): Request {
  if (input instanceof Request) {
    return init ? new Request(input, init) : new Request(input);
  }
  return new Request(new URL(input, base), init);
}

function record(
  trace: PipelineTraceController,
  boundary: Parameters<PipelineTraceController['record']>[0]['boundary'],
  request: Request,
  response?: Response,
  detail?: unknown
): void {
  trace.record({
    boundary,
    method: request.method,
    url: request.url,
    status: response?.status,
    detail
  });
}

async function callHook(
  hook: ProxyHook | undefined,
  boundary: Parameters<PipelineTraceController['record']>[0]['boundary'],
  context: MiniWebContext,
  request?: Request,
  response?: Response
): Promise<void> {
  await hook?.({
    boundary,
    request,
    response,
    context
  });
}

function maybeTraceStream(
  trace: PipelineTraceController,
  request: Request,
  response: Response
): Response {
  if (!response.body || response.headers.get('x-miniweb-stream') !== '1') {
    return response;
  }
  return recordStreamLifecycle(trace, request, response);
}

function delayResponseStream(
  delay: DelayController,
  boundary: DelayBoundary,
  request: Request,
  response: Response
): Response {
  if (!response.body) {
    return response;
  }
  const body = delay.delayStream(boundary, request, response.body);
  if (body === response.body) {
    return response;
  }
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

const miniWebEnvironmentState = Symbol('miniweb.environmentState');

interface MiniWebEnvironmentState {
  current: MiniWebEnvironmentRuntime;
  environments: MiniWebEnvironmentMap;
}

function createEnvironmentState(
  origin: string,
  location: MiniWebContext['location']
): MiniWebEnvironmentState {
  const testEnvironment = createMiniWebEnvironmentRuntime({
    name: 'test',
    origin,
    location,
    fetch(_environment, input, init) {
      return fetch(toMiniWebRequest(input, init, location.href));
    }
  });
  return {
    current: testEnvironment,
    environments: {
      frontend: testEnvironment,
      serviceWorker: testEnvironment,
      edge: testEnvironment,
      backend: testEnvironment
    }
  };
}

function bindMiniWebContextEnvironment(
  context: MiniWebContext,
  current: MiniWebEnvironmentRuntime,
  environments: MiniWebEnvironmentMap
): void {
  const state = getEnvironmentState(context);
  state.current = current;
  state.environments = environments;
}

async function withEnvironment<T>(
  context: MiniWebContext,
  environment: MiniWebEnvironmentRuntime,
  run: () => Promise<T>
): Promise<T> {
  const state = getEnvironmentState(context);
  const previous = state.current;
  state.current = environment;
  try {
    return await run();
  } finally {
    state.current = previous;
  }
}

function getEnvironmentState(context: MiniWebContext): MiniWebEnvironmentState {
  return (context as MiniWebContext & {
    [miniWebEnvironmentState]: MiniWebEnvironmentState;
  })[miniWebEnvironmentState];
}

async function runAbortable<T>(signal: AbortSignal, run: () => Promise<T>): Promise<T> {
  if (signal.aborted) {
    throw createAbortError(signal.reason);
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(createAbortError(signal.reason));
    };
    signal.addEventListener('abort', onAbort, {
      once: true
    });
    run().then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}

function createAbortError(reason: unknown): Error | DOMException {
  if (reason instanceof Error || reason instanceof DOMException) {
    return reason;
  }
  return new DOMException(
    typeof reason === 'string' ? reason : 'The operation was aborted.',
    'AbortError'
  );
}

function applyRequestCookies(request: Request, cookies: MiniWebCookieJar): Request {
  if (request.credentials === 'omit' || request.headers.has('cookie')) {
    return request;
  }
  const cookieHeader = cookies.getCookieHeader(request.url);
  if (!cookieHeader) {
    return request;
  }
  const headers = new Headers(request.headers);
  headers.set('cookie', cookieHeader);
  return new Request(request, {
    headers
  });
}

function storeResponseCookies(
  request: Request,
  response: Response,
  cookies: MiniWebCookieJar
): void {
  if (request.credentials === 'omit') {
    return;
  }
  const setCookie = getSetCookieHeaders(response.headers);
  if (setCookie.length > 0) {
    cookies.setCookie(request.url, setCookie);
  }
}

function getSetCookieHeaders(headers: Headers): string[] {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headersWithSetCookie.getSetCookie === 'function') {
    return headersWithSetCookie.getSetCookie();
  }
  const value = headers.get('set-cookie');
  return value ? [value] : [];
}
