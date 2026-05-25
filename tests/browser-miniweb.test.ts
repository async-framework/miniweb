import { Window as HappyWindow } from 'happy-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { createBrowserMiniWeb } from '../src/browser/create-browser-miniweb.ts';
import { helloApp } from '../src/examples/hello-app/manifest.ts';

describe('browser miniweb', () => {
  const globalScope = globalThis as unknown as {
    window: unknown;
    document: unknown;
    Element: unknown;
    HTMLFormElement: unknown;
    FormData: unknown;
  };
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalElement = globalThis.Element;
  const originalHtmlFormElement = globalThis.HTMLFormElement;
  const originalFormData = globalThis.FormData;

  afterEach(() => {
    globalScope.window = originalWindow;
    globalScope.document = originalDocument;
    globalScope.Element = originalElement;
    globalScope.HTMLFormElement = originalHtmlFormElement;
    globalScope.FormData = originalFormData;
  });

  it('renders navigations into a browser frame', async () => {
    const window = new HappyWindow({
      url: 'http://localhost:5173/'
    });
    const frame = window.document.createElement('iframe') as unknown as HTMLIFrameElement;
    window.document.body.append(frame as never);

    const web = await createBrowserMiniWeb({
      origin: 'http://localhost:3000',
      files: helloApp.files,
      app: helloApp.app,
      layers: {
        frontend: {
          kind: 'browser-frame',
          frame
        },
        serviceWorker: {
          kind: 'fake'
        },
        network: {
          kind: 'blocked'
        },
        edge: {
          kind: 'bypass'
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    await web.navigate('/');
    expect(frame.srcdoc).toContain('<h1>Home</h1>');
    await web.navigate('/about');
    expect(web.location.pathname).toBe('/about');
    expect(frame.srcdoc).toContain('<h1>About</h1>');
  });

  it('intercepts same-origin frame clicks but leaves external links alone', async () => {
    const window = installWindow();
    const frame = window.document.createElement('iframe') as unknown as HTMLIFrameElement;
    window.document.body.append(frame as never);
    const web = await createBrowserMiniWeb({
      origin: 'http://localhost:3000',
      app: {
        fetch(request) {
          const url = new URL(request.url);
          if (url.pathname === '/') {
            return html(`
              <h1>Home</h1>
              <a id="about" href="/about">About</a>
              <a id="external" href="https://example.com/out">External</a>
            `);
          }
          return html('<h1>About</h1>');
        }
      },
      layers: {
        frontend: {
          kind: 'browser-frame',
          frame
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    await web.navigate('/');
    await nextTask();
    installForeignElementConstructors();

    clickFrameElement(window, frame, '#about');
    await nextTask();

    expect(web.location.pathname).toBe('/about');
    expect(frame.srcdoc).toContain('<h1>About</h1>');

    await web.navigate('/');
    await nextTask();
    installForeignElementConstructors();
    clickFrameElement(window, frame, '#external');
    await nextTask();

    expect(web.location.pathname).toBe('/');
  });

  it('submits same-origin GET forms and syncs the real URL path', async () => {
    const window = installWindow();
    const frame = window.document.createElement('iframe') as unknown as HTMLIFrameElement;
    window.document.body.append(frame as never);
    const web = await createBrowserMiniWeb({
      origin: 'http://localhost:3000',
      app: {
        fetch(request) {
          const url = new URL(request.url);
          if (url.pathname === '/') {
            return html(`
              <h1>Search</h1>
              <form id="search" action="/search" method="GET">
                <input name="q" value="miniweb">
                <button>Search</button>
              </form>
            `);
          }
          return html(`<h1>${url.pathname}:${url.searchParams.get('q')}</h1>`);
        }
      },
      layers: {
        frontend: {
          kind: 'browser-frame',
          frame
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'fetch-app'
        }
      },
      ui: {
        syncRealUrl: true,
        realUrlBasePath: '/miniweb'
      }
    });

    await web.navigate('/');
    await nextTask();
    installForeignElementConstructors();
    submitFrameForm(window, frame, '#search');
    await nextTask();

    expect(web.location.pathname).toBe('/search');
    expect(web.location.search).toBe('?q=miniweb');
    expect(frame.srcdoc).toContain('<h1>/search:miniweb</h1>');
    expect(window.location.pathname).toBe('/miniweb/search');
    expect(window.location.search).toBe('?q=miniweb');
  });
});

function installWindow(): HappyWindow {
  const window = new HappyWindow({
    url: 'http://localhost:5173/'
  });
  const globalScope = globalThis as unknown as {
    window: unknown;
    document: unknown;
    Element: unknown;
    HTMLFormElement: unknown;
    FormData: unknown;
  };
  globalScope.window = window;
  globalScope.document = window.document;
  globalScope.Element = window.Element;
  globalScope.HTMLFormElement = window.HTMLFormElement;
  globalScope.FormData = window.FormData;
  return window;
}

function installForeignElementConstructors(): void {
  const foreignWindow = new HappyWindow();
  const globalScope = globalThis as unknown as {
    Element: unknown;
    HTMLFormElement: unknown;
  };
  globalScope.Element = foreignWindow.Element;
  globalScope.HTMLFormElement = foreignWindow.HTMLFormElement;
}

function html(body: string): Response {
  return new Response(`<!doctype html><html><body>${body}</body></html>`, {
    headers: {
      'content-type': 'text/html; charset=utf-8'
    }
  });
}

function clickFrameElement(window: HappyWindow, frame: HTMLIFrameElement, selector: string): void {
  const element = frame.contentDocument?.querySelector(selector);
  if (!element) {
    throw new Error(`Missing frame element: ${selector}`);
  }
  element.dispatchEvent(new window.MouseEvent('click', {
    bubbles: true,
    cancelable: true
  }) as unknown as Event);
}

function submitFrameForm(window: HappyWindow, frame: HTMLIFrameElement, selector: string): void {
  const form = frame.contentDocument?.querySelector(selector);
  if (!form) {
    throw new Error(`Missing frame form: ${selector}`);
  }
  form.dispatchEvent(new window.Event('submit', {
    bubbles: true,
    cancelable: true
  }) as unknown as Event);
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
