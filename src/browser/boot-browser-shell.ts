import { createStaticAssetEdgeWorker } from '../core/create-static-asset-edge-worker.ts';
import { helloApp } from '../examples/hello-app/manifest.ts';
import { createBrowserMiniWeb, type BrowserMiniWeb } from './create-browser-miniweb.ts';

export async function bootBrowserShell(root: Document = document): Promise<BrowserMiniWeb> {
  const frame = requireElement<HTMLIFrameElement>(root, '#preview');
  const urlInput = requireElement<HTMLInputElement>(root, '#fake-url');
  const terminalInput = requireElement<HTMLInputElement>(root, '#terminal-command');
  const terminalOutput = requireElement<HTMLElement>(root, '#terminal-output');
  const traceOutput = requireElement<HTMLElement>(root, '#trace-output');
  const cacheOutput = requireElement<HTMLElement>(root, '#cache-output');
  const status = requireElement<HTMLElement>(root, '#status');

  let web = await createWeb(frame);

  async function navigate(url: string): Promise<void> {
    const response = await web.navigate(url);
    urlInput.value = `${web.location.pathname}${web.location.search}${web.location.hash}`;
    status.textContent = `${response.status} ${response.statusText || 'OK'}`;
    await renderPanels();
  }

  async function renderPanels(): Promise<void> {
    traceOutput.textContent = web.trace.entries()
      .slice(-24)
      .map((entry) => `${entry.boundary} ${entry.status ?? ''} ${new URL(entry.url).pathname}`)
      .join('\n');
    const keys = await web.edge.cache.keys();
    cacheOutput.textContent = keys.length === 0
      ? 'No edge cache entries'
      : keys.map((entry) => `${entry.status} ${new URL(entry.url).pathname} ${entry.tags.join(',')}`).join('\n');
    terminalOutput.textContent = web.terminal.output();
  }

  web.trace.subscribe(() => {
    void renderPanels();
  });
  web.terminal.subscribe(() => {
    void renderPanels();
  });

  root.querySelector('[data-action="back"]')?.addEventListener('click', async () => {
    web.history.back();
    await web.frontend.reload();
    urlInput.value = web.location.pathname;
    await renderPanels();
  });
  root.querySelector('[data-action="forward"]')?.addEventListener('click', async () => {
    web.history.forward();
    await web.frontend.reload();
    urlInput.value = web.location.pathname;
    await renderPanels();
  });
  root.querySelector('[data-action="reload"]')?.addEventListener('click', async () => {
    await web.frontend.reload();
    await renderPanels();
  });
  root.querySelector('[data-action="run"]')?.addEventListener('click', async () => {
    await navigate(urlInput.value || '/');
  });
  root.querySelector('[data-action="reset"]')?.addEventListener('click', async () => {
    web = await createWeb(frame);
    await navigate('/');
  });
  root.querySelector('[data-action="purge"]')?.addEventListener('click', async () => {
    await web.edge.cache.purgeAll();
    await renderPanels();
  });
  root.querySelector('#terminal-run')?.addEventListener('click', async () => {
    await web.terminal.run(terminalInput.value);
    terminalInput.value = '';
    await renderPanels();
  });
  terminalInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      await web.terminal.run(terminalInput.value);
      terminalInput.value = '';
      await renderPanels();
    }
  });
  urlInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      await navigate(urlInput.value || '/');
    }
  });

  await web.terminal.run('npm install');
  await web.terminal.run('npm run dev');
  await navigate('/');
  return web;
}

async function createWeb(frame: HTMLIFrameElement): Promise<BrowserMiniWeb> {
  return createBrowserMiniWeb({
    origin: 'http://localhost:3000',
    files: {
      ...helloApp.files,
      '/public/assets/app.js': 'console.log("MiniWeb asset");'
    },
    app: helloApp.app,
    layers: {
      frontend: {
        kind: 'browser-frame',
        frame,
        streaming: 'buffer'
      },
      serviceWorker: {
        kind: 'fake'
      },
      network: {
        kind: 'blocked'
      },
      edge: {
        kind: 'fake',
        worker: createStaticAssetEdgeWorker({
          publicPrefix: '/assets/',
          filePrefix: '/public/assets/',
          cacheTtl: 60
        }),
        cache: {
          enabled: true,
          defaultTtl: 60,
          respectCacheControl: true
        },
        region: 'local'
      },
      backend: {
        kind: 'fetch-app'
      }
    }
  });
}

function requireElement<T extends Element>(root: Document, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing MiniWeb shell element: ${selector}`);
  }
  return element as T;
}
