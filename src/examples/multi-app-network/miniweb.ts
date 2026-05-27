import { createMiniWebApp } from '../../core/create-miniweb-app.ts';
import { domain, toApp } from '../../core/create-miniweb-router.ts';
import { multiAppNetworkApiApp } from './api.ts';
import { multiAppNetworkFrontendApp } from './frontend.ts';

export const multiAppNetworkMiniWeb = createMiniWebApp({
  origin: 'https://web.local',
  apps: {
    frontend: {
      app: multiAppNetworkFrontendApp,
      baseUrl: 'https://web.local/'
    },
    api: {
      app: multiAppNetworkApiApp,
      baseUrl: 'https://api.local/'
    }
  },
  routes: [
    domain('api.local', toApp('api')),
    toApp('frontend')
  ]
});
