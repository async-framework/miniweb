import { createMiniWebApp } from '../../core/create-miniweb-app.ts';
import { mount, toApp } from '../../core/create-miniweb-router.ts';
import { simpleBackendApp } from './backend.ts';
import { simpleFrontendApp } from './frontend.ts';

export const simpleFullstackMiniWeb = createMiniWebApp({
  origin: 'https://miniweb.local',
  apps: {
    frontend: {
      app: simpleFrontendApp,
      basePath: '/'
    },
    backend: {
      app: simpleBackendApp,
      basePath: '/api/'
    }
  },
  routes: [
    mount('/api', toApp('backend')),
    toApp('frontend')
  ]
});
