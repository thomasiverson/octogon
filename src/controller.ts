import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { ComparePanel } from './webview/panel';
import {
  ContextRef,
  CostEstimate,
  HISTORY_SCHEMA_VERSION,
  ModelInfo,
  ModelResult,
  OctogonConfig,
  RunOptions,
  RunRecord,
  WebviewToExtension
} from './shared/types';
import { loadPricingTable, PricingTable } from './cost/pricing';
import { resolveRate, tokenCost, ModelIdentity } from './cost/costCalculator';
import { ModelRegistry } from './models/registry';
import { buildMessages, countMessageTokens, runComparison, RunHandlers } from './runner/orchestrator';
import {
  assembleContext,
  BuiltContext,
  collectActivePieces,
  collectAttachedPieces,
  ContextPiece
} from './context/contextBuilder';
import { retrieve } from './context/retrieval';
import { buildJudgePrompt, JudgeInput, parseJudgeResponse } from './scoring/judge';
import { clampRating } from './scoring/manual';
import { computeLeaderboard } from './shared/leaderboard';
import { verifyResponse } from './scoring/verify';
import { HistoryStore } from './store/historyStore';
import { buildMarkdownSummary } from './store/exporter';
import { computeModelStats } from './store/modelStats';

interface RunState {
  runId: string;
  timestamp: number;
  prompt: string;
  contextRefs: ContextRef[];
  modelIds: string[];
  modelNames: Record<string, string>;
  results: Map<string, ModelResult>;
  winner: string | null;
}

/**
 * Owns all message routing and business logic for a ComparePanel. Created once
 * per panel; services are added phase by phase (registry, orchestrator, cost,
 * context, judge, history, verify).
 */
export class OctogonController {
  private readonly registry = new ModelRegistry();
  private readonly store: HistoryStore;
  private currentRun: vscode.CancellationTokenSource | undefined;
  private pricingTable: PricingTable | undefined;
  private lastRun: RunState | undefined;
  /** Last focused file editor — the webview steals activeTextEditor focus. */
  private lastActiveEditor: vscode.TextEditor | undefined;

  constructor(
    public readonly panel: ComparePanel,
    private readonly context: vscode.ExtensionContext
  ) {
    this.store = new HistoryStore(context.globalStorageUri);
    this.lastActiveEditor =
      vscode.window.activeTextEditor?.document.uri.scheme === 'file'
        ? vscode.window.activeTextEditor
        : vscode.window.visibleTextEditors.find((e) => e.document.uri.scheme === 'file');

    this.panel.onMessage((msg) => void this.handle(msg));
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('octogon')) {
          this.pricingTable = undefined;
          void this.sendInit();
        }
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.uri.scheme === 'file') {
          this.lastActiveEditor = editor;
        }
        this.sendActiveFile();
      }),
      vscode.window.onDidChangeVisibleTextEditors(() => this.sendActiveFile())
    );
  }

  /**
   * Resolve the file editor to use for context. Prefers the truly active editor,
   * but falls back to the last focused file editor (since focusing the Octogon
   * webview clears activeTextEditor) and then any visible file editor.
   */
  private getEffectiveEditor(): vscode.TextEditor | undefined {
    const active = vscode.window.activeTextEditor;
    if (active && active.document.uri.scheme === 'file') {
      this.lastActiveEditor = active;
      return active;
    }
    if (this.lastActiveEditor && !this.lastActiveEditor.document.isClosed) {
      return this.lastActiveEditor;
    }
    const visible = vscode.window.visibleTextEditors.find((e) => e.document.uri.scheme === 'file');
    if (visible) {
      this.lastActiveEditor = visible;
      return visible;
    }
    return undefined;
  }

  private async handle(msg: WebviewToExtension): Promise<void> {
    switch (msg.type) {
      case 'ready':
        await this.sendInit();
        break;
      case 'requestModels':
        await this.sendModels();
        break;
      case 'previewCost':
        await this.handlePreviewCost(msg.prompt, msg.modelIds, msg.options);
        break;
      case 'run':
        await this.handleRun(msg.prompt, msg.modelIds, msg.options);
        break;
      case 'attachFiles':
        await this.handleAttachFiles();
        break;
      case 'rate':
        await this.handleRate(msg.runId, msg.modelId, msg.rating);
        break;
      case 'pickWinner':
        this.handlePickWinner(msg.runId, msg.modelId);
        break;
      case 'runJudge':
        await this.handleJudge(msg.runId, msg.referenceAnswer);
        break;
      case 'loadHistory':
        await this.sendHistory();
        break;
      case 'reloadRun':
        await this.handleReloadRun(msg.id);
        break;
      case 'exportRun':
        await this.handleExportRun(msg.id, msg.format);
        break;
      case 'clearHistory':
        await this.clearHistory();
        break;
      case 'loadModelStats':
        await this.handleLoadModelStats();
        break;
      case 'runVerify':
        await this.handleVerify(msg.runId, msg.modelId);
        break;
      case 'cancel':
        this.cancelCurrentRun();
        break;
      case 'log':
        console.log('[octogon:webview]', msg.message);
        break;
      default:
        // Later phases handle the remaining message types.
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Init / models
  // -------------------------------------------------------------------------

  private async sendInit(): Promise<void> {
    const config = await this.readConfig();
    const models = await this.safeEnumerate();
    await this.panel.post({ type: 'init', models, config });
    this.sendActiveFile();
    if (models.length === 0) {
      await this.panel.post({
        type: 'notice',
        level: 'warn',
        message:
          'No Copilot models are available. Ensure GitHub Copilot is active and grant model access when prompted.'
      });
    }
  }

  private sendActiveFile(): void {
    const editor = this.getEffectiveEditor();
    const path = editor ? vscode.workspace.asRelativePath(editor.document.uri) : null;
    void this.panel.post({ type: 'activeFile', path });
  }

  private async sendModels(): Promise<void> {
    const models = await this.safeEnumerate();
    await this.panel.post({ type: 'models', models });
    if (models.length === 0) {
      await this.panel.post({
        type: 'notice',
        level: 'warn',
        message: 'No Copilot models found.'
      });
    }
  }

  private async safeEnumerate(): Promise<ModelInfo[]> {
    try {
      const models = await this.registry.refresh();
      return await this.enrichRates(models);
    } catch (err) {
      console.error('[octogon] selectChatModels failed:', err);
      await this.panel.post({
        type: 'notice',
        level: 'error',
        message: `Could not enumerate models: ${err instanceof Error ? err.message : String(err)}`
      });
      return [];
    }
  }

  /** Attach input/output $/1M rates to each model for the picker. */
  private async enrichRates(models: ModelInfo[]): Promise<ModelInfo[]> {
    const table = await this.getPricing();
    if (!table) return models;
    return models.map((m) => {
      const resolved = resolveRate(table, { id: m.id, family: m.family, name: m.name });
      return resolved
        ? { ...m, inputRate: resolved.rate.input, outputRate: resolved.rate.output }
        : m;
    });
  }

  // -------------------------------------------------------------------------
  // Run / cancel
  // -------------------------------------------------------------------------

  private async handleRun(prompt: string, modelIds: string[], options: RunOptions): Promise<void> {
    if (!prompt.trim()) {
      await this.panel.post({ type: 'notice', level: 'warn', message: 'Enter a prompt first.' });
      return;
    }
    if (modelIds.length === 0) {
      await this.panel.post({ type: 'notice', level: 'warn', message: 'Select at least one model.' });
      return;
    }

    this.cancelCurrentRun();
    const models = await this.registry.resolve(modelIds);
    if (models.length === 0) {
      await this.panel.post({
        type: 'notice',
        level: 'error',
        message: 'Selected models are no longer available. Refresh the model list.'
      });
      return;
    }

    const runId = randomUUID();
    const cts = new vscode.CancellationTokenSource();
    this.currentRun = cts;

    const identities = new Map<string, ModelIdentity>(
      models.map((m) => [m.id, { id: m.id, family: m.family, name: m.name }])
    );
    const table = await this.getPricing();

    await this.panel.post({ type: 'runStarted', runId, modelIds: models.map((m) => m.id) });

    // Build token-budgeted context and disclose exactly what was sent.
    const context = await this.buildContext(prompt, models, options, cts.token);
    await this.panel.post({ type: 'context', runId, context: context.info });

    this.lastRun = {
      runId,
      timestamp: Date.now(),
      prompt,
      contextRefs: context.info.refs,
      modelIds: models.map((m) => m.id),
      modelNames: Object.fromEntries(models.map((m) => [m.id, m.name])),
      results: new Map<string, ModelResult>(),
      winner: null
    };

    const handlers: RunHandlers = {
      onModelStart: (modelId) => void this.panel.post({ type: 'modelStart', runId, modelId }),
      onFragment: (modelId, text) => void this.panel.post({ type: 'fragment', runId, modelId, text }),
      onModelDone: (modelId, result) => {
        if (table) {
          const identity = identities.get(modelId);
          if (identity) {
            result.cost = tokenCost(table, identity, result.tokens.input, result.tokens.output);
          }
        }
        this.lastRun?.results.set(modelId, result);
        void this.panel.post({ type: 'modelDone', runId, modelId, result });
      },
      onModelError: (modelId, message, code) =>
        void this.panel.post({ type: 'modelError', runId, modelId, message, code })
    };

    try {
      const results = await runComparison({
        prompt,
        contextBlock: context.block,
        models,
        token: cts.token,
        handlers
      });
      if (this.lastRun?.runId === runId) {
        for (const result of results) {
          this.lastRun.results.set(result.modelId, result);
        }
      }
      const leaderboard = computeLeaderboard(results);
      await this.panel.post({ type: 'runComplete', runId, leaderboard });
      await this.saveLastRun();
    } finally {
      if (this.currentRun === cts) {
        this.currentRun = undefined;
      }
      cts.dispose();
    }
  }

  private cancelCurrentRun(): void {
    this.currentRun?.cancel();
  }

  // -------------------------------------------------------------------------
  // Quality: manual rating + LLM-as-judge
  // -------------------------------------------------------------------------

  private orderedResults(): ModelResult[] {
    if (!this.lastRun) return [];
    return this.lastRun.modelIds
      .map((id) => this.lastRun!.results.get(id))
      .filter((r): r is ModelResult => Boolean(r));
  }

  private async recomputeLeaderboard(runId: string): Promise<void> {
    await this.panel.post({
      type: 'runComplete',
      runId,
      leaderboard: computeLeaderboard(this.orderedResults())
    });
  }

  private async handleRate(runId: string, modelId: string, rating: number | null): Promise<void> {
    if (!this.lastRun || this.lastRun.runId !== runId) return;
    const result = this.lastRun.results.get(modelId);
    if (!result) return;
    result.manualRating = clampRating(rating);
    await this.recomputeLeaderboard(runId);
    await this.saveLastRun();
  }

  private handlePickWinner(runId: string, modelId: string | null): void {
    if (!this.lastRun || this.lastRun.runId !== runId) return;
    this.lastRun.winner = modelId;
    void this.saveLastRun();
  }

  private async handleJudge(runId: string, referenceAnswer?: string): Promise<void> {
    if (!this.lastRun || this.lastRun.runId !== runId) {
      await this.panel.post({ type: 'judgeError', runId, message: 'No active run to judge.' });
      return;
    }

    const judgeable = this.orderedResults().filter((r) => !r.error && r.output.trim().length > 0);
    if (judgeable.length === 0) {
      await this.panel.post({ type: 'judgeError', runId, message: 'No successful responses to judge.' });
      return;
    }

    const judgeModel = await this.pickJudgeModel();
    if (!judgeModel) {
      await this.panel.post({ type: 'judgeError', runId, message: 'No judge model is available.' });
      return;
    }

    const input: JudgeInput = {
      prompt: this.lastRun.prompt,
      referenceAnswer,
      responses: judgeable.map((r) => ({
        modelId: r.modelId,
        name: this.registry.get(r.modelId)?.name ?? r.modelId,
        output: r.output
      }))
    };

    const messages = buildMessages(buildJudgePrompt(input));
    const cts = new vscode.CancellationTokenSource();
    try {
      const inputTokens = await countMessageTokens(judgeModel, messages);
      const response = await judgeModel.sendRequest(messages, {}, cts.token);
      let full = '';
      for await (const fragment of response.text) {
        full += fragment;
      }

      const scores = parseJudgeResponse(full, judgeable.map((r) => r.modelId));
      for (const score of scores) {
        const result = this.lastRun.results.get(score.modelId);
        if (result) {
          result.judge = score;
        }
      }

      await this.panel.post({ type: 'judgeDone', runId, scores });
      await this.recomputeLeaderboard(runId);
      await this.saveLastRun();

      // Transparency: report the judge call's own token cost.
      const table = await this.getPricing();
      if (table) {
        const outputTokens = await judgeModel.countTokens(full || ' ');
        const cost = tokenCost(
          table,
          { id: judgeModel.id, family: judgeModel.family, name: judgeModel.name },
          inputTokens,
          outputTokens
        );
        if (cost.rateAvailable) {
          await this.panel.post({
            type: 'notice',
            level: 'info',
            message: `Judge (${judgeModel.name}) cost ≈ $${cost.usd.toFixed(4)} / ${cost.credits.toFixed(2)} credits.`
          });
        }
      }
    } catch (err) {
      await this.panel.post({
        type: 'judgeError',
        runId,
        message: err instanceof Error ? err.message : String(err)
      });
    } finally {
      cts.dispose();
    }
  }

  private async pickJudgeModel(): Promise<vscode.LanguageModelChat | undefined> {
    if (this.registry.list().length === 0) {
      await this.safeEnumerate();
    }
    const list = this.registry.list();
    if (list.length === 0) return undefined;

    const configured = vscode.workspace
      .getConfiguration('octogon')
      .get<string>('judgeModelId', '')
      .trim();
    if (configured) {
      const match = list.find((m) => m.id === configured || m.family === configured);
      if (match) return match;
    }

    // Heuristic preference for a strong evaluator among available models.
    const priorities = ['opus', 'gpt-5.5', 'sonnet-4', 'gpt-5.4', 'gemini-3.1-pro', 'fable', 'gpt-4o'];
    for (const key of priorities) {
      const match = list.find(
        (m) => m.family.toLowerCase().includes(key) || m.name.toLowerCase().includes(key)
      );
      if (match) return match;
    }
    return list[0];
  }

  // -------------------------------------------------------------------------
  // History / persistence
  // -------------------------------------------------------------------------

  private toRecord(run: RunState): RunRecord {
    const results = run.modelIds
      .map((id) => run.results.get(id))
      .filter((r): r is ModelResult => Boolean(r));
    return {
      version: HISTORY_SCHEMA_VERSION,
      id: run.runId,
      timestamp: run.timestamp,
      prompt: run.prompt,
      contextRefs: run.contextRefs,
      modelIds: run.modelIds,
      modelNames: run.modelNames,
      results,
      winner: run.winner
    };
  }

  private async saveLastRun(): Promise<void> {
    if (!this.lastRun || this.lastRun.results.size === 0) return;
    try {
      await this.store.save(this.toRecord(this.lastRun));
      await this.sendHistory();
    } catch (err) {
      console.error('[octogon] failed to save run history:', err);
    }
  }

  private async sendHistory(): Promise<void> {
    const runs = await this.store.list();
    await this.panel.post({ type: 'history', runs });
  }

  private async handleLoadModelStats(): Promise<void> {
    const summaries = await this.store.list();
    const records: RunRecord[] = [];
    for (const summary of summaries) {
      const record = await this.store.load(summary.id);
      if (record) records.push(record);
    }
    await this.panel.post({ type: 'modelStats', stats: computeModelStats(records) });
  }

  private async handleReloadRun(id: string): Promise<void> {
    const run = await this.store.load(id);
    if (!run) {
      await this.panel.post({ type: 'notice', level: 'warn', message: 'That run could not be loaded.' });
      return;
    }
    await this.panel.post({ type: 'historyRun', run });
  }

  private async handleExportRun(id: string, format: 'json' | 'markdown'): Promise<void> {
    const run = await this.store.load(id);
    if (!run) {
      await this.panel.post({ type: 'notice', level: 'warn', message: 'That run could not be exported.' });
      return;
    }

    const content = format === 'json' ? JSON.stringify(run, null, 2) : buildMarkdownSummary(run);
    const ext = format === 'json' ? 'json' : 'md';
    const stamp = new Date(run.timestamp).toISOString().replace(/[:.]/g, '-');
    const target = await vscode.window.showSaveDialog({
      filters: format === 'json' ? { JSON: ['json'] } : { Markdown: ['md'] },
      saveLabel: `Export Octogon run (${format})`,
      defaultUri: vscode.Uri.joinPath(this.context.globalStorageUri, `octogon-run-${stamp}.${ext}`)
    });
    if (!target) return;

    await vscode.workspace.fs.writeFile(target, Buffer.from(content, 'utf8'));
    const open = await vscode.window.showInformationMessage(
      `Exported run to ${vscode.workspace.asRelativePath(target)}.`,
      'Open'
    );
    if (open === 'Open') {
      await vscode.window.showTextDocument(target);
    }
  }

  // -------------------------------------------------------------------------
  // Verification (stretch): apply output to a sandbox and run the test command
  // -------------------------------------------------------------------------

  private async handleVerify(runId: string, modelId?: string): Promise<void> {
    if (!this.lastRun || this.lastRun.runId !== runId) {
      await this.panel.post({ type: 'notice', level: 'warn', message: 'No active run to verify.' });
      return;
    }

    const cmd = vscode.workspace.getConfiguration('octogon').get<string>('verifyCommand', '').trim();
    if (!cmd) {
      await this.panel.post({
        type: 'notice',
        level: 'warn',
        message: 'Set "octogon.verifyCommand" (e.g. "npm test") to enable verification.'
      });
      return;
    }

    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
      await this.panel.post({ type: 'notice', level: 'warn', message: 'Open a folder to run verification.' });
      return;
    }

    // Explicit, non-silent consent showing the exact command.
    const choice = await vscode.window.showWarningMessage(
      `Octogon will copy this workspace to a temporary sandbox and run:\n\n${cmd}\n\nagainst each model's applied output. Continue?`,
      { modal: true },
      'Run verification'
    );
    if (choice !== 'Run verification') return;

    const targets = this.orderedResults().filter(
      (r) => !r.error && r.output.trim().length > 0 && (!modelId || r.modelId === modelId)
    );
    if (targets.length === 0) {
      await this.panel.post({ type: 'notice', level: 'info', message: 'No successful responses to verify.' });
      return;
    }

    const activeFileRel = this.lastRun.contextRefs.find((r) => r.source === 'active')?.path;
    const cts = new vscode.CancellationTokenSource();
    try {
      for (const r of targets) {
        try {
          const outcome = await verifyResponse(
            { workspaceRoot: root, verifyCommand: cmd, output: r.output, activeFileRel, timeoutMs: 120_000 },
            cts.token
          );
          const result = {
            modelId: r.modelId,
            passed: outcome.passed,
            exitCode: outcome.exitCode,
            command: cmd,
            log: outcome.log
          };
          const stored = this.lastRun.results.get(r.modelId);
          if (stored) stored.verify = result;
          await this.panel.post({ type: 'verifyDone', runId, modelId: r.modelId, result });
        } catch (err) {
          await this.panel.post({
            type: 'verifyError',
            runId,
            modelId: r.modelId,
            message: err instanceof Error ? err.message : String(err)
          });
        }
      }
      await this.saveLastRun();
    } finally {
      cts.dispose();
    }
  }

  // -------------------------------------------------------------------------
  // Cost preview
  // -------------------------------------------------------------------------

  private async handlePreviewCost(
    prompt: string,
    modelIds: string[],
    options: RunOptions
  ): Promise<void> {
    if (!prompt.trim() || modelIds.length === 0) {
      await this.panel.post({
        type: 'costPreview',
        estimates: [],
        totalUsd: 0,
        totalCredits: 0,
        expectedOutputTokens: 0
      });
      return;
    }

    const models = await this.registry.resolve(modelIds);
    const table = await this.getPricing();
    const expectedOutputTokens = vscode.workspace
      .getConfiguration('octogon')
      .get<number>('expectedOutputTokens', 800);

    // Same context the run will use, so the preview reflects context tokens too.
    const context = await this.buildContext(prompt, models, options);

    const estimates: CostEstimate[] = [];
    let totalUsd = 0;
    let totalCredits = 0;

    for (const model of models) {
      let inputTokens = 0;
      try {
        inputTokens = await countMessageTokens(model, buildMessages(prompt, context.block));
      } catch (err) {
        console.warn('[octogon] countTokens failed during preview:', err);
      }
      const cost = table
        ? tokenCost(
            table,
            { id: model.id, family: model.family, name: model.name },
            inputTokens,
            expectedOutputTokens
          )
        : undefined;
      const usd = cost?.usd ?? 0;
      const credits = cost?.credits ?? 0;
      totalUsd += usd;
      totalCredits += credits;
      estimates.push({
        modelId: model.id,
        usd,
        credits,
        inputTokens,
        expectedOutputTokens,
        rateAvailable: cost?.rateAvailable ?? false
      });
    }

    await this.panel.post({
      type: 'costPreview',
      estimates,
      totalUsd,
      totalCredits,
      expectedOutputTokens
    });
  }

  // -------------------------------------------------------------------------
  // Context
  // -------------------------------------------------------------------------

  /**
   * Build a token-budgeted context block. Budgeted to the SMALLEST selected
   * model's window so the same context fits every model in the run (fairness).
   */
  private async buildContext(
    prompt: string,
    models: vscode.LanguageModelChat[],
    options: RunOptions,
    token?: vscode.CancellationToken
  ): Promise<BuiltContext> {
    const empty: BuiltContext = {
      block: '',
      info: { refs: [], totalTokens: 0, trimmed: false, budget: 0 }
    };
    if (models.length === 0) return empty;

    const pieces: ContextPiece[] = [];
    if (options.useActiveFile) {
      pieces.push(...(await collectActivePieces(this.getEffectiveEditor())));
    }
    if (options.attachedFiles.length > 0) {
      pieces.push(...(await collectAttachedPieces(options.attachedFiles)));
    }
    if (options.useRetrieval) {
      const cfgK = vscode.workspace.getConfiguration('octogon').get<number>('retrieval.topK', 5);
      const topK = options.retrievalTopK ?? cfgK;
      pieces.push(...(await retrieve(prompt, topK, token)));
    }
    if (pieces.length === 0) return empty;

    const smallest = models.reduce((a, b) => (a.maxInputTokens <= b.maxInputTokens ? a : b));
    const expectedOutputTokens = vscode.workspace
      .getConfiguration('octogon')
      .get<number>('expectedOutputTokens', 800);
    const reserve = expectedOutputTokens + 256;

    return assembleContext(pieces, smallest, prompt, reserve);
  }

  private async handleAttachFiles(): Promise<void> {
    const files = await vscode.workspace.findFiles(
      '**/*',
      '**/{node_modules,.git,dist,out,build,coverage,.vscode-test,media}/**',
      2000
    );
    if (files.length === 0) {
      await this.panel.post({ type: 'notice', level: 'info', message: 'No files found to attach.' });
      return;
    }
    const items = files.map((uri) => ({
      label: vscode.workspace.asRelativePath(uri),
      uri
    }));
    const picked = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      placeHolder: 'Select files to attach as context'
    });
    if (!picked || picked.length === 0) return;
    await this.panel.post({ type: 'attachedFiles', files: picked.map((p) => p.uri.fsPath) });
  }

  private async getPricing(): Promise<PricingTable | undefined> {
    if (this.pricingTable) {
      return this.pricingTable;
    }
    try {
      this.pricingTable = await loadPricingTable(this.context.extensionUri);
      return this.pricingTable;
    } catch (err) {
      console.error('[octogon] failed to load pricing table:', err);
      await this.panel.post({
        type: 'notice',
        level: 'warn',
        message: 'Pricing table could not be loaded — costs will show as unavailable.'
      });
      return undefined;
    }
  }

  // -------------------------------------------------------------------------
  // Config
  // -------------------------------------------------------------------------

  private async readConfig(): Promise<OctogonConfig> {
    const cfg = vscode.workspace.getConfiguration('octogon');
    let pricingLastUpdated = 'unknown';
    let aiCreditUsd = 0.01;
    const table = await this.getPricing();
    if (table) {
      pricingLastUpdated = table.lastUpdated;
      aiCreditUsd = table.aiCreditUsd;
    }
    return {
      expectedOutputTokens: cfg.get<number>('expectedOutputTokens', 800),
      retrievalTopK: cfg.get<number>('retrieval.topK', 5),
      judgeModelId: cfg.get<string>('judgeModelId', ''),
      verifyCommand: cfg.get<string>('verifyCommand', ''),
      pricingLastUpdated,
      aiCreditUsd
    };
  }

  /** Clear all persisted run history (also exposed via octogon.clearHistory). */
  public async clearHistory(): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
      'Clear all saved Octogon run history? This cannot be undone.',
      { modal: true },
      'Clear'
    );
    if (choice !== 'Clear') return;
    await this.store.clear();
    await this.sendHistory();
    await this.panel.post({ type: 'notice', level: 'info', message: 'Run history cleared.' });
  }
}
