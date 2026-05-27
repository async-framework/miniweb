# Vite Compile-Away

MiniWeb can act as a development harness without becoming the production runtime. App code imports platform APIs from MiniWeb, and the Vite plugin swaps those imports by target.

## Authoring

```ts
import { fetch, Request, Response, caches, localStorage } from '@async/miniweb/platform';

export async function loadUser() {
  const response = await fetch('/api/user');
  return response.json();
}
```

## Development Harness

```ts
import { miniweb } from '@async/miniweb/vite';

export default {
  plugins: [
    miniweb()
  ]
};
```

The default target is `auto`:

- `vite dev` uses MiniWeb scoped platform APIs.
- `vite build` uses native `globalThis` APIs.

## Static MiniWeb Demo

Use this when a GitHub Pages-style demo should keep MiniWeb routing after build:

```ts
miniweb({
  target: 'miniweb',
  app: '/src/examples/simple-fullstack/miniweb.ts'
});
```

The `app` string is imported by Vite and used to create a MiniWeb instance for the platform module. Code can also bind a MiniWeb instance manually with `setMiniWebPlatform(web)`.

## Native App Target

Use this when you want source imports to resolve to native browser APIs in both dev and build:

```ts
miniweb({
  target: 'native'
});
```

## Non-Goal

The v1 plugin does not rewrite bare globals such as `fetch('/api')`. Use imports from `@async/miniweb/platform` so the code remains explicit, typeable, and easy to compile away.
