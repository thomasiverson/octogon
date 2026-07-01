import * as vscode from 'vscode';
import { ComparePanel } from './webview/panel';
import { OctogonController } from './controller';

let controller: OctogonController | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const open = vscode.commands.registerCommand('octogon.open', () => {
    const panel = ComparePanel.createOrShow(context.extensionUri);
    if (!controller) {
      controller = new OctogonController(panel, context);
      const sub = panel.onDidDispose(() => {
        controller?.dispose();
        controller = undefined;
        sub.dispose();
      });
    }
    panel.reveal();
  });

  const clearHistory = vscode.commands.registerCommand('octogon.clearHistory', async () => {
    if (controller) {
      await controller.clearHistory();
    } else {
      await vscode.window.showInformationMessage('Open Octogon first to manage run history.');
    }
  });

  const openSettings = vscode.commands.registerCommand('octogon.openSettings', () =>
    vscode.commands.executeCommand('workbench.action.openSettings', '@ext:octogon.octogon')
  );

  const refreshPricing = vscode.commands.registerCommand('octogon.refreshPricing', async () => {
    if (controller) {
      await controller.refreshPricing();
    } else {
      await vscode.window.showInformationMessage('Open Octogon first to refresh pricing.');
    }
  });

  // Empty tree so the Activity Bar view shows its welcome launcher (viewsWelcome).
  const launchView = vscode.window.registerTreeDataProvider('octogon.launch', {
    getTreeItem: () => new vscode.TreeItem(''),
    getChildren: () => []
  });

  context.subscriptions.push(open, clearHistory, openSettings, refreshPricing, launchView);
}

export function deactivate(): void {
  // Nothing to clean up; the panel disposes itself.
}
