import { createMiniWebApp } from '../../core/create-miniweb-app.ts';
import { mount, toApp } from '../../core/create-miniweb-router.ts';
import { requestBodyLabBackendApp } from './backend.ts';
import { requestBodyLabFrontendApp } from './frontend.ts';

export const requestBodyLabMiniWeb = createMiniWebApp({
  origin: 'https://request-body-lab.local',
  apps: {
    frontend: {
      app: requestBodyLabFrontendApp,
      basePath: '/'
    },
    backend: {
      app: requestBodyLabBackendApp,
      runtime: 'backend',
      basePath: '/api/'
    }
  },
  routes: [
    mount('/api', toApp('backend')),
    toApp('frontend')
  ]
});
