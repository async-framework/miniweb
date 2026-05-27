import { createMiniWebApp } from '../../core/create-miniweb-app.ts';
import { toApp } from '../../core/create-miniweb-router.ts';
import { helloApp } from './manifest.ts';

export const helloAppMiniWeb = createMiniWebApp({
  origin: 'https://hello-app.local',
  files: helloApp.files,
  apps: {
    hello: {
      app: helloApp.app,
      basePath: '/'
    }
  },
  routes: [
    toApp('hello')
  ]
});
