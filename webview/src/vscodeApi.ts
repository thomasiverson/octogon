import type { ExtensionToWebview, WebviewToExtension } from '../../src/shared/types';

interface VsCodeApi {
  postMessage(msg: WebviewToExtension): void;
  getState<T = unknown>(): T | undefined;
  setState<T = unknown>(state: T): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// acquireVsCodeApi can only be called once per webview load.
export const vscode: VsCodeApi = acquireVsCodeApi();

/** Send a typed message to the extension host. */
export function post(msg: WebviewToExtension): void {
  vscode.postMessage(msg);
}

/** Subscribe to typed messages from the extension host. Returns an unsubscribe. */
export function onMessage(handler: (msg: ExtensionToWebview) => void): () => void {
  const listener = (event: MessageEvent) => handler(event.data as ExtensionToWebview);
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
