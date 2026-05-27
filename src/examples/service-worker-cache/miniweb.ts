import { createMiniWebApp } from '../../core/create-miniweb-app.ts';
import { cacheFirst, mount, toApp } from '../../core/create-miniweb-router.ts';
import { serviceWorkerCacheBackendApp } from './backend.ts';
import { serviceWorkerCacheFrontendApp } from './frontend.ts';

export const serviceWorkerCacheMiniWeb = createMiniWebApp({
  origin: 'https://sw-cache.local',
  apps: {
    frontend: {
      app: serviceWorkerCacheFrontendApp,
      basePath: '/'
    },
    backend: {
      app: serviceWorkerCacheBackendApp,
      basePath: '/api/'
    }
  },
  routes: [
    mount('/api', [
      cacheFirst({
        store: 'service-worker'
      }),
      toApp('backend')
    ]),
    toApp('frontend')
  ]
});
