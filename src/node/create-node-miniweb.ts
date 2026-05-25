import { createMiniWeb } from '../core/create-miniweb.ts';
import type { MiniWeb, MiniWebConfig } from '../core/types.ts';
import { createNodeFrontend, type NodeFrontend } from './create-node-frontend.ts';

export type NodeMiniWeb = Omit<MiniWeb, 'frontend'> & {
  readonly frontend: NodeFrontend;
};

export async function createNodeMiniWeb(config: MiniWebConfig): Promise<NodeMiniWeb> {
  const web = await createMiniWeb(config);
  const frontend = createNodeFrontend(web);

  return {
    ...web,
    frontend
  };
}
