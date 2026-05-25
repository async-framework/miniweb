export function createRuntimeFrame(options: {
  parent: HTMLElement;
  title?: string;
  className?: string;
}): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.title = options.title ?? 'MiniWeb runtime';
  frame.className = options.className ?? 'miniweb-runtime-frame';
  frame.setAttribute('sandbox', 'allow-scripts');
  options.parent.append(frame);
  return frame;
}
