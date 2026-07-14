import * as vscode from 'vscode';
import { HISTORY_SCHEMA_VERSION, RunRecord, RunSummary } from '../shared/types';

const MAX_RUNS = 100;

/** Convert a full record into the lightweight index summary. */
export function toSummary(record: RunRecord): RunSummary {
  let totalUsd = 0;
  let totalCredits = 0;
  for (const r of record.results) {
    if (r.cost?.rateAvailable) {
      totalUsd += r.cost.usd;
      totalCredits += r.cost.credits;
    }
  }
  return {
    id: record.id,
    timestamp: record.timestamp,
    promptSnippet: record.prompt.slice(0, 120),
    modelIds: record.modelIds,
    modelNames: record.modelIds.map((id) => record.modelNames[id] ?? id),
    totalUsd,
    totalCredits,
    winner: record.winner ?? null,
    blind: record.blind ?? false
  };
}

/** Validate/migrate a loaded record using its version field. */
export function migrate(record: RunRecord): RunRecord {
  if (!record.version) {
    record.version = HISTORY_SCHEMA_VERSION;
  }
  if (!record.modelNames) {
    record.modelNames = {};
  }
  return record;
}

/**
 * JSON-backed run history in the extension's global storage. Layout:
 *   <globalStorage>/history/index.json   — array of RunSummary (newest first)
 *   <globalStorage>/history/<id>.json     — one RunRecord per run
 * Capped at MAX_RUNS; the oldest runs are pruned on save.
 */
export class HistoryStore {
  private readonly dir: vscode.Uri;
  private readonly indexUri: vscode.Uri;

  constructor(storageUri: vscode.Uri) {
    this.dir = vscode.Uri.joinPath(storageUri, 'history');
    this.indexUri = vscode.Uri.joinPath(this.dir, 'index.json');
  }

  private async ensureDir(): Promise<void> {
    try {
      await vscode.workspace.fs.createDirectory(this.dir);
    } catch {
      // Already exists.
    }
  }

  private runUri(id: string): vscode.Uri {
    return vscode.Uri.joinPath(this.dir, `${id}.json`);
  }

  async list(): Promise<RunSummary[]> {
    try {
      const bytes = await vscode.workspace.fs.readFile(this.indexUri);
      const parsed = JSON.parse(Buffer.from(bytes).toString('utf8'));
      if (Array.isArray(parsed)) return parsed as RunSummary[];
    } catch {
      // No index yet.
    }
    return [];
  }

  private async writeIndex(index: RunSummary[]): Promise<void> {
    await this.ensureDir();
    await vscode.workspace.fs.writeFile(
      this.indexUri,
      Buffer.from(JSON.stringify(index, null, 2), 'utf8')
    );
  }

  async save(record: RunRecord): Promise<void> {
    await this.ensureDir();
    await vscode.workspace.fs.writeFile(
      this.runUri(record.id),
      Buffer.from(JSON.stringify(record, null, 2), 'utf8')
    );

    let index = (await this.list()).filter((s) => s.id !== record.id);
    index.unshift(toSummary(record));

    if (index.length > MAX_RUNS) {
      const overflow = index.slice(MAX_RUNS);
      index = index.slice(0, MAX_RUNS);
      for (const old of overflow) {
        try {
          await vscode.workspace.fs.delete(this.runUri(old.id));
        } catch {
          // Best effort.
        }
      }
    }

    await this.writeIndex(index);
  }

  async load(id: string): Promise<RunRecord | undefined> {
    try {
      const bytes = await vscode.workspace.fs.readFile(this.runUri(id));
      const parsed = JSON.parse(Buffer.from(bytes).toString('utf8')) as RunRecord;
      return migrate(parsed);
    } catch {
      return undefined;
    }
  }

  async clear(): Promise<void> {
    const index = await this.list();
    for (const summary of index) {
      try {
        await vscode.workspace.fs.delete(this.runUri(summary.id));
      } catch {
        // Best effort.
      }
    }
    await this.writeIndex([]);
  }
}
