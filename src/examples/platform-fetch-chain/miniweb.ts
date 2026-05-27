import { createMiniWebApp } from '../../core/create-miniweb-app.ts';
import { mount, toApp } from '../../core/create-miniweb-router.ts';
import { platformFetchChainBackendApp } from './backend.ts';
import { platformFetchChainFrontendApp } from './frontend.ts';

export const platformFetchChainMiniWeb = createMiniWebApp({
  origin: 'https://platform-fetch-chain.local',
  apps: {
    frontend: {
      app: platformFetchChainFrontendApp,
      basePath: '/'
    },
    backend: {
      app: platformFetchChainBackendApp,
      runtime: 'backend',
      basePath: '/api/'
    }
  },
  routes: [
    mount('/api', toApp('backend')),
    toApp('frontend')
  ]
});
