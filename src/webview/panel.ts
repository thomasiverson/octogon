import * as vscode from 'vscode';
import { ExtensionToWebview, WebviewToExtension } from '../shared/types';

/** Generate a random nonce for the webview Content-Security-Policy. */
export function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

/**
 * Thin transport layer around a singleton WebviewPanel. It owns the panel
 * lifecycle, builds the CSP-hardened HTML, and forwards messages. All business
 * logic lives in the controller that subscribes via {@link onMessage}.
 */
export class ComparePanel {
  public static readonly viewType = 'octogon.compare';
  private static current: ComparePanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly disposables: vscode.Disposable[] = [];
  private messageHandler?: (msg: WebviewToExtension) => void;

  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  public readonly onDidDispose = this._onDidDispose.event;

  public static createOrShow(extensionUri: vscode.Uri): ComparePanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    if (ComparePanel.current) {
      ComparePanel.current.panel.reveal(column);
      return ComparePanel.current;
    }
    const panel = vscode.window.createWebviewPanel(
      ComparePanel.viewType,
      'Octogon',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
      }
    );
    ComparePanel.current = new ComparePanel(panel, extensionUri);
    return ComparePanel.current;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.panel.webview.html = this.getHtml(this.panel.webview);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewToExtension) => this.messageHandler?.(msg),
      null,
      this.disposables
    );
  }

  /** Register the single handler for inbound webview messages. */
  public onMessage(handler: (msg: WebviewToExtension) => void): void {
    this.messageHandler = handler;
  }

  /** Post a typed message to the webview. */
  public post(message: ExtensionToWebview): Thenable<boolean> {
    return this.panel.webview.postMessage(message);
  }

  public reveal(): void {
    this.panel.reveal();
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'webview.css')
    );

    // Scripts are locked to the nonce; styles allow the webview source + inline
    // (React applies dynamic inline styles). No remote script/style is allowed.
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} https: data:`,
      `font-src ${webview.cspSource}`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`
    ].join('; ');

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Octogon</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public dispose(): void {
    ComparePanel.current = undefined;
    this._onDidDispose.fire();
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}
