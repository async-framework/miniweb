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
  MiniWebConfig,
  MiniWebContext,
  MiniWebEnv,
  MiniWebProxyHooks,
  NetworkLayerConfig,
  PipelineTraceController,
  ProxyHook
} from './types.ts';

export async function createMiniWeb(config: MiniWebConfig): Promise<MiniWeb> {
  const origin = new URL(config.origin).origin;
  const trace = createPipelineTracer();
  const edgeConfig = config.layers.edge ?? defaultEdgeConfig();
  const context = createMiniWebContext({
    origin,
    files: config.files,
    trace,
    edgeCacheConfig: edgeConfig.kind === 'fake' ? edgeConfig.cache : undefined
  });
  const delay = createDelayController(config.delay, trace);
  const networkConfig = config.layers.network ?? defaultNetworkConfig();
  const env: MiniWebEnv = {
    NODE_ENV: 'test',
    ...config.env
  };
  const edgeEnv: MiniWebEnv = {
    ...env,
    ...config.edgeEnv
  };
  const backendDriver = createBackendDriver({
    config: config.layers.backend,
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
  let running = false;
  const terminal = createTerminalRuntime({
    fs: context.fs,
    origin,
    setRunning(value) {
      running = value;
    }
  });

  async function backendStage(request: Request): Promise<Response> {
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
  }

  async function edgeStage(request: Request): Promise<Response> {
    record(trace, 'edge:request', request);
    await callHook(config.proxyHooks?.onEdgeRequest, 'edge:request', context, request);
    await delay.delayBoundaryRequest('edge', request);
    let response = await edgeDriver.fetch(request, (nextRequest = request) => backendStage(nextRequest));
    await delay.delayBoundaryResponse('edge', request, response);
    response = delayResponseStream(delay, 'edge', request, response);
    record(trace, 'edge:response', request, response);
    await callHook(config.proxyHooks?.onEdgeResponse, 'edge:response', context, request, response);
    return response;
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
    record(trace, 'service-worker:request', request);
    await callHook(config.proxyHooks?.onServiceWorkerRequest, 'service-worker:request', context, request);
    await delay.delayBoundaryRequest('service-worker', request);
    let response = config.layers.serviceWorker.kind === 'fake'
      ? await serviceWorker.dispatchFetch(request, context, () => networkStage(request))
      : await networkStage(request);
    await delay.delayBoundaryResponse('service-worker', request, response);
    response = delayResponseStream(delay, 'service-worker', request, response);
    record(trace, 'service-worker:response', request, response);
    await callHook(config.proxyHooks?.onServiceWorkerResponse, 'service-worker:response', context, request, response);
    return response;
  }

  async function fetchThroughPipeline(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const request = toMiniWebRequest(input, init, context.location.href);
    record(trace, 'frontend:request', request);
    await callHook(config.proxyHooks?.onFrontendRequest, 'frontend:request', context, request);
    await delay.delayBoundaryRequest('frontend', request);
    let response = await serviceWorkerStage(request);
    await delay.delayBoundaryResponse('frontend', request, response);
    response = delayResponseStream(delay, 'frontend', request, response);
    record(trace, 'frontend:response', request, response);
    await callHook(config.proxyHooks?.onFrontendResponse, 'frontend:response', context, request, response);
    return response;
  }

  const web: MiniWeb = {
    origin,
    fs: context.fs,
    location: context.location,
    history: context.history,
    navigation: context.navigation,
    trace,
    terminal,
    edge: {
      cache: context.edgeCache,
      region: edgeConfig.kind === 'fake' ? edgeConfig.region ?? 'local' : 'local'
    },
    frontend: {
      kind: config.layers.frontend.kind,
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
      resetFakeHistory(context.history, `${origin}/`);
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

  return {
    fs,
    location,
    history,
    navigation,
    trace,
    edgeCache,
    waitUntil(promise) {
      waitUntilPromises.add(promise);
      promise.finally(() => {
        waitUntilPromises.delete(promise);
      });
    }
  };
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
