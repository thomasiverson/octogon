import * as vscode from 'vscode';
import { PricingTable } from './pricingTypes';

export { ModelRate, PricingTable } from './pricingTypes';

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the pricing table. Precedence: the `octogon.pricingTablePath` override,
 * then a refreshed cache written by "Octogon: Refresh Pricing" (when present),
 * then the bundled snapshot at pricing/model-pricing.json (re-included in the .vsix).
 */
export async function loadPricingTable(
  extensionUri: vscode.Uri,
  cacheUri?: vscode.Uri
): Promise<PricingTable> {
  const override = (
    vscode.workspace.getConfiguration('octogon').get<string>('pricingTablePath') ?? ''
  ).trim();

  let uri: vscode.Uri;
  if (override) {
    uri = vscode.Uri.file(override);
  } else if (cacheUri && (await fileExists(cacheUri))) {
    uri = cacheUri;
  } else {
    uri = vscode.Uri.joinPath(extensionUri, 'pricing', 'model-pricing.json');
  }

  const bytes = await vscode.workspace.fs.readFile(uri);
  const text = Buffer.from(bytes).toString('utf8');
  const parsed = JSON.parse(text) as PricingTable;

  if (!parsed.models || typeof parsed.aiCreditUsd !== 'number') {
    throw new Error('Invalid pricing table: missing "models" or "aiCreditUsd".');
  }
  return parsed;
}
