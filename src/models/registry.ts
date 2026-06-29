import * as vscode from 'vscode';
import { ModelInfo } from '../shared/types';

/** Map a vscode language model to the serializable shape sent to the webview. */
export function toModelInfo(model: vscode.LanguageModelChat): ModelInfo {
  return {
    id: model.id,
    family: model.family,
    name: model.name,
    vendor: model.vendor,
    maxInputTokens: model.maxInputTokens
  };
}

/**
 * Enumerates Copilot-vendor chat models and caches the live instances so the
 * orchestrator can call sendRequest/countTokens on the exact model the user
 * picked. The first selectChatModels call triggers the consent dialog.
 */
export class ModelRegistry {
  private readonly cache = new Map<string, vscode.LanguageModelChat>();

  /** Re-query the picker. Returns serializable infos; throws nothing on empty. */
  public async refresh(): Promise<ModelInfo[]> {
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    this.cache.clear();
    const seen = new Set<string>();
    const infos: ModelInfo[] = [];
    for (const model of models) {
      this.cache.set(model.id, model);
      // The picker can list the same model more than once; collapse duplicates
      // by display name so each model appears as a single chip.
      const key = (model.name || model.id).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      infos.push(toModelInfo(model));
    }
    return infos;
  }

  public get(id: string): vscode.LanguageModelChat | undefined {
    return this.cache.get(id);
  }

  /** All currently cached model instances. */
  public list(): vscode.LanguageModelChat[] {
    return [...this.cache.values()];
  }

  /** Resolve instances for the given ids, refreshing once if any are missing. */
  public async resolve(ids: string[]): Promise<vscode.LanguageModelChat[]> {
    const missing = ids.some((id) => !this.cache.has(id));
    if (missing) {
      await this.refresh();
    }
    return ids
      .map((id) => this.cache.get(id))
      .filter((m): m is vscode.LanguageModelChat => Boolean(m));
  }

  public get size(): number {
    return this.cache.size;
  }
}
