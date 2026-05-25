import { Window as HappyWindow } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFrameRpcClient,
  createFrameRpcServer,
  type FrameRpcRequest,
  type FrameRpcResponse
} from '../src/browser/frame-rpc.ts';

describe('frame rpc', () => {
  const globalScope = globalThis as unknown as {
    window: unknown;
  };
  const originalWindow = globalThis.window;

  afterEach(() => {
    vi.useRealTimers();
    globalScope.window = originalWindow;
  });

  it('resolves client calls from matching frame responses', async () => {
    const window = installWindow();
    const targetWindow = {
      postMessage(data: FrameRpcRequest) {
        setTimeout(() => {
          window.dispatchEvent(new window.MessageEvent('message', {
            data: {
              type: 'miniweb:response',
              requestId: data.requestId,
              result: {
                ok: true
              }
            },
            source: targetWindow as never
          }));
        }, 0);
      }
    } as unknown as Window;
    const client = createFrameRpcClient({
      targetWindow,
      timeoutMs: 50
    });

    await expect(client.call('ping')).resolves.toEqual({
      ok: true
    });

    client.destroy();
  });

  it('rejects unknown server commands and ignores disallowed origins', async () => {
    const window = installWindow();
    const responses: FrameRpcResponse[] = [];
    const source = {
      postMessage(response: FrameRpcResponse) {
        responses.push(response);
      }
    } as unknown as Window;
    const server = createFrameRpcServer({
      allowedOrigin: 'https://allowed.local'
    });

    window.dispatchEvent(new window.MessageEvent('message', {
      origin: 'https://blocked.local',
      source: source as never,
      data: {
        type: 'miniweb:request',
        requestId: 'blocked',
        command: 'missing'
      }
    }));
    await nextTask();

    expect(responses).toEqual([]);

    window.dispatchEvent(new window.MessageEvent('message', {
      origin: 'https://allowed.local',
      source: source as never,
      data: {
        type: 'miniweb:request',
        requestId: 'allowed',
        command: 'missing'
      }
    }));
    await nextTask();

    expect(responses).toEqual([
      {
        type: 'miniweb:response',
        requestId: 'allowed',
        error: {
          message: 'Unknown MiniWeb frame RPC command: missing'
        }
      }
    ]);

    server.destroy();
  });

  it('times out pending calls and rejects them when destroyed', async () => {
    vi.useFakeTimers();
    const window = installWindow();
    const targetWindow = {
      postMessage() {}
    } as unknown as Window;
    const timeoutClient = createFrameRpcClient({
      targetWindow,
      timeoutMs: 10
    });
    const timedOut = timeoutClient.call('slow');

    await vi.advanceTimersByTimeAsync(10);
    await expect(timedOut).rejects.toThrow('MiniWeb frame RPC timed out: slow');

    const destroyedClient = createFrameRpcClient({
      targetWindow,
      timeoutMs: 100
    });
    const destroyed = destroyedClient.call('pending');
    destroyedClient.destroy();

    await expect(destroyed).rejects.toThrow('MiniWeb frame RPC client destroyed');
    timeoutClient.destroy();
  });
});

function installWindow(): HappyWindow {
  const window = new HappyWindow({
    url: 'https://parent.local/'
  });
  const globalScope = globalThis as unknown as {
    window: unknown;
  };
  globalScope.window = window;
  return window;
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
