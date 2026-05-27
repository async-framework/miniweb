import { createMiniWebApp } from '../../core/create-miniweb-app.ts';
import { toApp } from '../../core/create-miniweb-router.ts';
import { streamingApp } from './manifest.ts';

export const streamingAppMiniWeb = createMiniWebApp({
  origin: 'https://streaming-app.local',
  files: streamingApp.files,
  apps: {
    streaming: {
      app: streamingApp.app,
      basePath: '/'
    }
  },
  routes: [
    toApp('streaming')
  ]
});
