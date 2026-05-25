import { createMiniWeb } from '../core/create-miniweb.ts';
import type {
  BrowserFrameStreamingMode,
  MiniWeb,
  MiniWebConfig,
  MiniWebFrontendRuntime
} from '../core/types.ts';

export interface BrowserFrameFrontend extends MiniWebFrontendRuntime {
  readonly kind: 'browser-frame';
  readonly frame: HTMLIFrameElement;
  readonly streaming: BrowserFrameStreamingMode;
  render(response: Response): Promise<void>;
}

export type BrowserMiniWeb = Omit<MiniWeb, 'frontend' | 'navigate' | 'reload'> & {
  readonly frontend: BrowserFrameFrontend;
  navigate(url: string): Promise<Response>;
  reload(): Promise<Response>;
};

export async function createBrowserMiniWeb(config: MiniWebConfig): Promise<BrowserMiniWeb> {
  if (config.layers.frontend.kind !== 'browser-frame') {
    throw new Error('createBrowserMiniWeb requires frontend.kind = "browser-frame"');
  }

  const baseWeb = await createMiniWeb(config);
  const frontend = createBrowserFrameFrontend(baseWeb, {
    frame: config.layers.frontend.frame,
    streaming: config.layers.frontend.streaming ?? 'buffer',
    syncRealUrl: config.ui?.syncRealUrl ?? false,
    realUrlBasePath: config.ui?.realUrlBasePath ?? ''
  });

  return {
    ...baseWeb,
    frontend,
    async navigate(url) {
      return frontend.navigate(url);
    },
    async reload() {
      return frontend.reload();
    }
  };
}

function createBrowserFrameFrontend(
  web: MiniWeb,
  options: {
    frame: HTMLIFrameElement;
    streaming: BrowserFrameStreamingMode;
    syncRealUrl: boolean;
    realUrlBasePath: string;
  }
): BrowserFrameFrontend {
  async function render(response: Response): Promise<void> {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return;
    }

    if (options.streaming !== 'buffer') {
      // TODO: support document-write and message-chunks streaming modes.
    }

    options.frame.srcdoc = await response.text();
    syncRealUrl(web, options);
    setTimeout(() => {
      installFrameInterceptors(web, options.frame, render);
    }, 0);
  }

  return {
    kind: 'browser-frame',
    frame: options.frame,
    streaming: options.streaming,
    async fetch(input, init) {
      return web.fetch(input, init);
    },
    async navigate(url) {
      const response = await web.navigate(url);
      await render(response.clone());
      return response;
    },
    async reload() {
      const response = await web.reload();
      await render(response.clone());
      return response;
    },
    render
  };
}

function installFrameInterceptors(
  web: MiniWeb,
  frame: HTMLIFrameElement,
  render: (response: Response) => Promise<void>
): void {
  const document = frame.contentDocument;
  if (!document) {
    return;
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!isDomElement(target)) {
      return;
    }
    const anchor = target.closest('a[href]');
    if (!anchor) {
      return;
    }
    const href = anchor.getAttribute('href');
    if (!href || new URL(href, web.location.href).origin !== web.location.origin) {
      return;
    }
    event.preventDefault();
    void web.navigate(href).then((response) => render(response.clone()));
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!isFormElement(form)) {
      return;
    }
    event.preventDefault();
    const method = (form.method || 'GET').toUpperCase();
    const action = form.getAttribute('action') || web.location.href;
    if (method === 'GET') {
      const url = new URL(action, web.location.href);
      const data = new FormData(form as HTMLFormElement);
      for (const [key, value] of data) {
        url.searchParams.set(key, String(value));
      }
      void web.navigate(url.href).then((response) => render(response.clone()));
      return;
    }
    void web.fetch(action, {
      method,
      body: new FormData(form as HTMLFormElement)
    }).then((response) => render(response.clone()));
  });
}

function isDomElement(value: EventTarget | null): value is Element {
  return value instanceof Element;
}

function isFormElement(value: EventTarget | null): value is HTMLFormElement {
  return value instanceof HTMLFormElement;
}

function syncRealUrl(
  web: MiniWeb,
  options: {
    syncRealUrl: boolean;
    realUrlBasePath: string;
  }
): void {
  if (!options.syncRealUrl || typeof window === 'undefined') {
    return;
  }
  const basePath = options.realUrlBasePath.replace(/\/$/, '');
  const nextPath = `${basePath}${web.location.pathname}${web.location.search}${web.location.hash}`;
  if (nextPath.startsWith('/')) {
    window.history.pushState({}, '', nextPath);
  }
}
