# Examples

The root browser shell is an example directory. It links to ten setups that show different ways to connect apps and platform APIs.

Run it:

```sh
npm run dev
```

Open `http://localhost:5173/`.

## Example Directory

| Example | Path | What It Shows |
| --- | --- | --- |
| Hello App | `/examples/hello-app/` | original manifest app served through MiniWeb |
| Streaming App | `/examples/streaming-app/` | visibly delayed long streamed HTML, text, and NDJSON |
| Simple Fullstack | `/examples/simple-fullstack/` | frontend plus backend route graph |
| Service Worker Cache | `/examples/service-worker-cache/` | platform cache storage as a service-worker-style cache |
| CDN Edge Cache | `/examples/cdn-edge-cache/` | shared edge cache with tags and trace entries |
| Edge Middleware | `/examples/edge-middleware/` | redirect, rewrite, and HTML transform middleware |
| Multi-App Network | `/examples/multi-app-network/` | host-based routing to another app |
| Platform Fetch Chain | `/examples/platform-fetch-chain/` | backend code fetching another backend route |
| Request Body Lab | `/examples/request-body-lab/` | POST body preservation |
| Stateful Session Cache | `/examples/stateful-session-cache/` | scoped cookies and named caches |

For the streaming demo, add `delay` and `firstDelay` query params to the shell URL or fake URL:
`/?demo=%2Fexamples%2Fstreaming-app%2F&delay=700&firstDelay=1200`.

## Source Files

Every reusable example has a `miniweb.ts` setup:

```txt
src/examples/<example>/
  frontend.ts
  backend.ts
  miniweb.ts
```

Some older examples use `manifest.ts` plus `server.ts` and expose a `miniweb.ts` wrapper.

## Tests

The example contract is covered by:

- `tests/example-apps.test.ts`
- `tests/example-route-coverage.test.ts`
- `tests/browser-miniweb.test.ts`

Together these verify the reusable setup modules, root routes, browser shell directory, and mounted example navigation.
