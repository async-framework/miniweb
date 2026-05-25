import { createMiniWeb } from '../core/create-miniweb.ts';
import type { MiniWeb, MiniWebConfig } from '../core/types.ts';

export function createTestMiniWeb(config: MiniWebConfig): Promise<MiniWeb> {
  return createMiniWeb({
    ...config,
    delay: {
      enabled: false,
      ...config.delay
    }
  });
}
