const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function readResponseText(response: Response): Promise<string> {
  return response.text();
}

export async function readStreamText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    chunks.push(result.value);
  }

  return decoder.decode(concat(chunks));
}

export function cloneResponseWithBody(
  response: Response,
  body: BodyInit | null
): Response {
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

export function isStreamingResponse(response: Response): boolean {
  return response.body !== null;
}

export function createReadableStreamFromTextChunks(
  chunks: string[],
  options: {
    delayMs?: number;
    firstChunkDelayMs?: number;
  } = {}
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const [index, chunk] of chunks.entries()) {
        const delayMs = index === 0
          ? options.firstChunkDelayMs ?? 0
          : options.delayMs ?? 0;
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
