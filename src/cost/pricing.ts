import * as vscode from 'vscode';
import { PricingTable } from './pricingTypes';

export { ModelRate, PricingTable } from './pricingTypes';

/**
 * Load the pricing table. Uses `octogon.pricingTablePath` when set, otherwise the
 * bundled snapshot at src/cost/data/model-pricing.json (re-included in the .vsix).
 */
export async function loadPricingTable(extensionUri: vscode.Uri): Promise<PricingTable> {
  const override = (
    vscode.workspace.getConfiguration('octogon').get<string>('pricingTablePath') ?? ''
  ).trim();

  const uri = override
    ? vscode.Uri.file(override)
    : vscode.Uri.joinPath(extensionUri, 'src', 'cost', 'data', 'model-pricing.json');

  const bytes = await vscode.workspace.fs.readFile(uri);
  const text = Buffer.from(bytes).toString('utf8');
  const parsed = JSON.parse(text) as PricingTable;

  if (!parsed.models || typeof parsed.aiCreditUsd !== 'number') {
    throw new Error('Invalid pricing table: missing "models" or "aiCreditUsd".');
  }
  return parsed;
}
