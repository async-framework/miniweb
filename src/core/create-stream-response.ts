import { createReadableStreamFromTextChunks } from './stream-utils.ts';

export function createTextStreamResponse(options: {
  chunks: string[];
  delayMs?: number;
  firstChunkDelayMs?: number;
  headers?: HeadersInit;
  status?: number;
}): Response {
  const headers = new Headers(options.headers);
  headers.set('x-miniweb-stream', '1');
  return new Response(createReadableStreamFromTextChunks(options.chunks, {
    delayMs: options.delayMs,
    firstChunkDelayMs: options.firstChunkDelayMs
  }), {
    status: options.status,
    headers
  });
}

export function createJsonLineStreamResponse(options: {
  values: unknown[];
  delayMs?: number;
  firstChunkDelayMs?: number;
  headers?: HeadersInit;
  status?: number;
}): Response {
  return createTextStreamResponse({
    chunks: options.values.map((value) => `${JSON.stringify(value)}\n`),
    delayMs: options.delayMs,
    firstChunkDelayMs: options.firstChunkDelayMs,
    headers: options.headers,
    status: options.status
  });
}

export function createStreamFromAsyncIterable<T extends Uint8Array | string>(
  iterable: AsyncIterable<T> | Iterable<T>,
  options: {
    delayMs?: number;
    firstChunkDelayMs?: number;
  } = {}
): ReadableStream<T> {
  return new ReadableStream<T>({
    async start(controller) {
      let index = 0;
      for await (const chunk of toAsyncIterable(iterable)) {
        const delayMs = index === 0
          ? options.firstChunkDelayMs ?? 0
          : options.delayMs ?? 0;
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        controller.enqueue(chunk);
        index += 1;
      }
      controller.close();
    }
  });
}

async function* toAsyncIterable<T>(
  iterable: AsyncIterable<T> | Iterable<T>
): AsyncIterable<T> {
  if (Symbol.asyncIterator in iterable) {
    yield* iterable;
    return;
  }
  yield* iterable;
}
