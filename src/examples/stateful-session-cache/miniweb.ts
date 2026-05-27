import { createMiniWebApp } from '../../core/create-miniweb-app.ts';
import { mount, toApp } from '../../core/create-miniweb-router.ts';
import { statefulSessionCacheBackendApp } from './backend.ts';
import { statefulSessionCacheFrontendApp } from './frontend.ts';

export const statefulSessionCacheMiniWeb = createMiniWebApp({
  origin: 'https://stateful-session-cache.local',
  apps: {
    frontend: {
      app: statefulSessionCacheFrontendApp,
      basePath: '/'
    },
    backend: {
      app: statefulSessionCacheBackendApp,
      runtime: 'backend',
      basePath: '/api/'
    }
  },
  routes: [
    mount('/api', toApp('backend')),
    toApp('frontend')
  ]
});
