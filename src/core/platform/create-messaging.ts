export interface MiniWebMessagingRuntime {
  readonly BroadcastChannel: typeof BroadcastChannel;
  postMessage(message: unknown, targetOrigin?: string): void;
  addEventListener(type: 'message', listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: 'message', listener: EventListenerOrEventListenerObject): void;
  reset(): void;
}

interface MiniWebMessageEvent extends Event {
  readonly data: unknown;
  readonly origin: string;
}

export function createMiniWebMessaging(origin: string): MiniWebMessagingRuntime {
  const target = new EventTarget();
  const channels = new Map<string, Set<MiniWebBroadcastChannel>>();

  class MiniWebBroadcastChannel extends EventTarget implements BroadcastChannel {
    onmessage: ((this: BroadcastChannel, event: MessageEvent) => unknown) | null = null;
    onmessageerror: ((this: BroadcastChannel, event: MessageEvent) => unknown) | null = null;
    readonly name: string;
    private closed = false;

    constructor(name: string) {
      super();
      this.name = String(name);
      const channelSet = channels.get(this.name) ?? new Set<MiniWebBroadcastChannel>();
      channelSet.add(this);
      channels.set(this.name, channelSet);
    }

    postMessage(message: unknown): void {
      if (this.closed) {
        return;
      }
      for (const channel of channels.get(this.name) ?? []) {
        if (channel === this || channel.closed) {
          continue;
        }
        const event = createMessageEvent(message, origin);
        channel.dispatchEvent(event);
        channel.onmessage?.call(channel as unknown as BroadcastChannel, event as MessageEvent);
      }
    }

    close(): void {
      this.closed = true;
      channels.get(this.name)?.delete(this);
    }
  }

  return {
    BroadcastChannel: MiniWebBroadcastChannel as unknown as typeof BroadcastChannel,
    postMessage(message, targetOrigin = '*') {
      if (targetOrigin !== '*' && targetOrigin !== origin) {
        return;
      }
      target.dispatchEvent(createMessageEvent(message, origin));
    },
    addEventListener(type, listener) {
      target.addEventListener(type, listener);
    },
    removeEventListener(type, listener) {
      target.removeEventListener(type, listener);
    },
    reset() {
      for (const channelSet of channels.values()) {
        for (const channel of channelSet) {
          channel.close();
        }
      }
      channels.clear();
    }
  };
}

function createMessageEvent(data: unknown, origin: string): MiniWebMessageEvent {
  const event = new Event('message') as MiniWebMessageEvent;
  Object.defineProperties(event, {
    data: {
      value: structuredClone(data),
      enumerable: true
    },
    origin: {
      value: origin,
      enumerable: true
    }
  });
  return event;
}
