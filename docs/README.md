# MiniWeb Docs

MiniWeb is a tiny local web runtime for static-hosted demos and fast Node-side integration tests.

Use these pages by task:

- [Getting Started](getting-started.md): build the smallest full-stack MiniWeb setup and run the browser shell.
- [Concepts](concepts.md): understand apps, routes, platform APIs, runtimes, and the request flow.
- [Examples](examples.md): choose one of the ten example setups.
- [Routes And Cache](routes-and-cache.md): connect apps with promise middleware and cache behavior.
- [Platform And Runtimes](platform-and-runtimes.md): use scoped Web APIs and choose same-realm or iframe execution.
- [Vite Compile-Away](vite-compile-away.md): import MiniWeb platform APIs in source and swap them by dev/build target.
- [Releasing](releasing.md): publish `@async/miniweb` to npm and GitHub Releases.
- [Browser Shell](browser-shell.md): run the root examples directory locally or through Tailscale Serve.

The short path is:

```sh
npm install
npm run dev
```

Then open `http://localhost:5173/`.
