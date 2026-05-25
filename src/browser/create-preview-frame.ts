export function createPreviewFrame(options: {
  parent: HTMLElement;
  title?: string;
  className?: string;
}): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.title = options.title ?? 'MiniWeb preview';
  frame.className = options.className ?? 'miniweb-preview-frame';
  frame.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin');
  options.parent.append(frame);
  return frame;
}
