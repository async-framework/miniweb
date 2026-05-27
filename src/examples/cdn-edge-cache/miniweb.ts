import { createMiniWebApp } from '../../core/create-miniweb-app.ts';
import { cacheFirst, mount, toApp } from '../../core/create-miniweb-router.ts';
import { cdnEdgeCacheBackendApp } from './backend.ts';
import { cdnEdgeCacheFrontendApp } from './frontend.ts';

export const cdnEdgeCacheMiniWeb = createMiniWebApp({
  origin: 'https://cdn-cache.local',
  apps: {
    frontend: {
      app: cdnEdgeCacheFrontendApp,
      basePath: '/'
    },
    backend: {
      app: cdnEdgeCacheBackendApp,
      basePath: '/api/'
    }
  },
  routes: [
    mount('/api', [
      cacheFirst({
        store: 'edge',
        ttl: 60,
        tags: ['api']
      }),
      toApp('backend')
    ]),
    toApp('frontend')
  ]
});
