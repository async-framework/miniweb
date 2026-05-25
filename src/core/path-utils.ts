export function normalizeMiniWebPath(path: string): string {
  if (!path) {
    return '/';
  }

  const withoutQuery = path.split(/[?#]/, 1)[0] ?? '';
  const withForwardSlashes = withoutQuery.replaceAll('\\', '/');
  const parts = withForwardSlashes.split('/');
  const normalized: string[] = [];

  for (const part of parts) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      throw new Error(`Invalid MiniWeb path: ${path}`);
    }
    normalized.push(part);
  }

  return `/${normalized.join('/')}`;
}

export function joinMiniWebPath(prefix: string, path: string): string {
  return normalizeMiniWebPath(`${normalizeMiniWebPath(prefix)}/${path}`);
}

export function pathnameFromRequest(request: Request): string {
  return normalizeMiniWebPath(new URL(request.url).pathname);
}
