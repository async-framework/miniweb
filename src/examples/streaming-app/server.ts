import { createJsonLineStreamResponse, createTextStreamResponse } from '../../core/create-stream-response.ts';
import type { FetchApp } from '../../core/types.ts';

export const streamingServer: FetchApp = {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/events') {
      return createJsonLineStreamResponse({
        values: [
          {
            type: 'start'
          },
          {
            type: 'progress',
            value: 50
          },
          {
            type: 'done'
          }
        ],
        delayMs: 10,
        headers: {
          'content-type': 'application/x-ndjson',
          'cache-control': 'no-store'
        }
      });
    }
    if (url.pathname === '/') {
      return createTextStreamResponse({
        chunks: [
          '<!doctype html><html><body>',
          '<h1>Streaming Home</h1>',
          '<p>Done</p>',
          '</body></html>'
        ],
        firstChunkDelayMs: 20,
        delayMs: 10,
        headers: {
          'content-type': 'text/html; charset=utf-8'
        }
      });
    }
    return new Response('Not found', {
      status: 404
    });
  }
};
