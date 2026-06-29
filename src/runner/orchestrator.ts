import * as vscode from 'vscode';
import { ModelResult } from '../shared/types';

/** Streaming + completion callbacks fired as a comparison run progresses. */
export interface RunHandlers {
  onModelStart(modelId: string): void;
  onFragment(modelId: string, text: string): void;
  onModelDone(modelId: string, result: ModelResult): void;
  onModelError(modelId: string, message: string, code?: string): void;
}

export interface OrchestratorRequest {
  prompt: string;
  /** Optional repo-context block, prepended to the first User message (Phase 3). */
  contextBlock?: string;
  models: vscode.LanguageModelChat[];
  token: vscode.CancellationToken;
  handlers: RunHandlers;
}

/**
 * vscode.lm has no system role, so any instructions/context are folded into the
 * single User message. Returns one message array per request.
 */
export function buildMessages(
  prompt: string,
  contextBlock?: string
): vscode.LanguageModelChatMessage[] {
  const text = contextBlock && contextBlock.trim().length > 0
    ? `${contextBlock}\n\n---\n\n${prompt}`
    : prompt;
  return [vscode.LanguageModelChatMessage.User(text)];
}

/** countTokens accepts a single message/string; sum across the message array. */
export async function countMessageTokens(
  model: vscode.LanguageModelChat,
  messages: vscode.LanguageModelChatMessage[]
): Promise<number> {
  let total = 0;
  for (const message of messages) {
    total += await model.countTokens(message);
  }
  return total;
}

function describeLmError(err: unknown): { message: string; code?: string } {
  if (err instanceof vscode.LanguageModelError) {
    return { message: err.message, code: err.code };
  }
  if (err instanceof vscode.CancellationError) {
    return { message: 'Cancelled', code: 'cancelled' };
  }
  if (err instanceof Error) {
    if (err.name === 'Canceled' || err.message === 'Canceled') {
      return { message: 'Cancelled', code: 'cancelled' };
    }
    return { message: err.message };
  }
  return { message: String(err) };
}

async function runOne(
  model: vscode.LanguageModelChat,
  req: OrchestratorRequest
): Promise<ModelResult> {
  const { prompt, contextBlock, token, handlers } = req;
  const messages = buildMessages(prompt, contextBlock);

  handlers.onModelStart(model.id);
  const start = Date.now();
  let firstTokenAt: number | null = null;
  let full = '';
  let inputTokens = 0;

  try {
    inputTokens = await countMessageTokens(model, messages);
    const response = await model.sendRequest(messages, {}, token);
    for await (const fragment of response.text) {
      if (token.isCancellationRequested) {
        break;
      }
      if (firstTokenAt === null) {
        firstTokenAt = Date.now();
      }
      full += fragment;
      handlers.onFragment(model.id, fragment);
    }

    const latencyMs = Date.now() - start;
    const outputTokens = await model.countTokens(full || ' ');
    const result: ModelResult = {
      modelId: model.id,
      output: full,
      tokens: { input: inputTokens, output: full ? outputTokens : 0 },
      latencyMs,
      timeToFirstTokenMs: firstTokenAt === null ? null : firstTokenAt - start
    };
    handlers.onModelDone(model.id, result);
    return result;
  } catch (err) {
    const { message, code } = describeLmError(err);
    handlers.onModelError(model.id, message, code);
    return {
      modelId: model.id,
      output: full,
      tokens: { input: inputTokens, output: 0 },
      latencyMs: Date.now() - start,
      timeToFirstTokenMs: firstTokenAt === null ? null : firstTokenAt - start,
      error: { message, code }
    };
  }
}

/** Run every selected model concurrently; isolate failures per model. */
export async function runComparison(req: OrchestratorRequest): Promise<ModelResult[]> {
  const tasks = req.models.map((model) => runOne(model, req));
  const settled = await Promise.allSettled(tasks);
  return settled.map((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      return outcome.value;
    }
    const { message, code } = describeLmError(outcome.reason);
    return {
      modelId: req.models[index].id,
      output: '',
      tokens: { input: 0, output: 0 },
      latencyMs: 0,
      timeToFirstTokenMs: null,
      error: { message, code }
    };
  });
}
