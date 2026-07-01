// The agent loop: drive a single vscode.lm model as an autonomous, tool-using
// coding agent inside an isolated sandbox. We implement tool-calling ourselves
// against vscode.lm (LanguageModelChatTool definitions + tool-call parts in the
// response stream), execute each requested tool against the sandbox, feed the
// result back, and iterate until the model calls `finish` or a hard cap is hit.
//
// Safety: every tool runs through executeTool, which confines paths to the
// sandbox and gates run_command behind the caller's consent callback. The loop
// enforces iteration, wall-clock, and token caps.

import * as vscode from 'vscode';
import type { AgentResult, AgentStep, AgentStopReason } from '../shared/types';
import { AGENT_TOOLS, executeTool } from './tools';
import type { Sandbox } from './sandbox';

const STEP_ARG_LIMIT = 2_000;
const STEP_RESULT_LIMIT = 2_000;

export interface AgentCaps {
  maxIterations: number;
  timeoutMs: number;
  maxTokens: number;
}

export interface AgentHandlers {
  onStart(): void;
  /** Assistant natural-language narration as it streams. */
  onFragment(text: string): void;
  /** A completed tool call + result. */
  onStep(step: AgentStep): void;
}

export interface AgentLoopOptions {
  model: vscode.LanguageModelChat;
  sandbox: Sandbox;
  task: string;
  /** Optional repo-context block prepended to the task. */
  contextBlock?: string;
  caps: AgentCaps;
  /** Per-run_command timeout. */
  commandTimeoutMs: number;
  /** Consent gate for run_command; return false to deny a command. */
  allowCommand: (command: string) => boolean | Promise<boolean>;
  token: vscode.CancellationToken;
  handlers: AgentHandlers;
}

const SYSTEM_PREAMBLE = [
  'You are an autonomous coding agent working inside an isolated sandbox copy of the user\u2019s repository.',
  'Complete the task by calling the provided tools. Inspect files before editing.',
  'Use list_files and read_file to understand the code, write_file to make changes, and run_command to build or test.',
  'Before each tool call, write one short sentence of natural-language narration explaining what you are about to do and why, so your reasoning is visible.',
  'Make the smallest correct change. When the task is complete, call the finish tool with a short summary.',
  'Do not ask the user questions; act autonomously. All paths are relative to the sandbox root \u2014 use plain relative paths like "api/src/x.ts", never a leading slash or a "/workspace" prefix.'
].join(' ');

function truncate(text: string, limit: number): string {
  return text.length > limit ? text.slice(0, limit) + '\u2026' : text;
}

function toLmTools(): vscode.LanguageModelChatTool[] {
  return AGENT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema
  }));
}

function describeError(err: unknown): { message: string; code?: string } {
  if (err instanceof vscode.LanguageModelError) return { message: err.message, code: err.code };
  if (err instanceof Error) {
    if (err.name === 'Canceled' || err.message === 'Canceled') {
      return { message: 'Cancelled', code: 'cancelled' };
    }
    return { message: err.message };
  }
  return { message: String(err) };
}

/**
 * Run one model as an agent against its sandbox. Always resolves with an
 * AgentResult (never throws); failures are captured in `stopReason`/`error`.
 */
export async function runAgent(opts: AgentLoopOptions): Promise<AgentResult> {
  const { model, sandbox, caps, token, handlers } = opts;
  handlers.onStart();

  const start = Date.now();
  const tools = toLmTools();

  // Hard deadline: the per-iteration checks below only fire *between* turns, but
  // a model can hang inside a single sendRequest/stream and never yield control.
  // A watchdog cancels the in-flight request when the wall-clock cap elapses so
  // a stuck model can't run forever (and block the whole bake-off from finishing).
  const deadline = new vscode.CancellationTokenSource();
  let timedOut = false;
  // timeoutMs <= 0 means "no wall-clock limit" — let the model run to completion.
  // When set, a watchdog cancels the in-flight request so a hung model can't run
  // forever (the per-iteration checks below only fire *between* turns).
  const watchdog =
    caps.timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          deadline.cancel();
        }, caps.timeoutMs)
      : undefined;
  const externalCancel = token.onCancellationRequested(() => deadline.cancel());
  const opToken = deadline.token;

  const taskText =
    opts.contextBlock && opts.contextBlock.trim().length > 0
      ? `${opts.contextBlock}\n\n---\n\nTask:\n${opts.task}`
      : `Task:\n${opts.task}`;

  const messages: vscode.LanguageModelChatMessage[] = [
    vscode.LanguageModelChatMessage.User(`${SYSTEM_PREAMBLE}\n\n${taskText}`)
  ];

  const steps: AgentStep[] = [];
  let transcript = '';
  let iterations = 0;
  let lastInputTokens = 0;
  let outputTokens = 0;
  let stopReason: AgentStopReason = 'max-iterations';
  let summary: string | undefined;
  let error: { message: string; code?: string } | undefined;

  try {
    // maxIterations <= 0 means "no iteration cap".
    while (caps.maxIterations <= 0 || iterations < caps.maxIterations) {
      if (token.isCancellationRequested) {
        stopReason = 'cancelled';
        break;
      }
      if (timedOut || (caps.timeoutMs > 0 && Date.now() - start > caps.timeoutMs)) {
        stopReason = 'timeout';
        break;
      }

      // Token budget guard (input context + everything generated so far).
      try {
        lastInputTokens = 0;
        for (const m of messages) {
          lastInputTokens += await model.countTokens(m);
        }
      } catch {
        // countTokens can fail transiently; keep the previous estimate.
      }
      if (caps.maxTokens > 0 && lastInputTokens + outputTokens > caps.maxTokens) {
        stopReason = 'token-budget';
        break;
      }

      iterations++;

      const response = await model.sendRequest(
        messages,
        { tools, toolMode: vscode.LanguageModelChatToolMode.Auto },
        opToken
      );

      let assistantText = '';
      const toolCalls: vscode.LanguageModelToolCallPart[] = [];

      for await (const part of response.stream) {
        if (opToken.isCancellationRequested) break;
        if (part instanceof vscode.LanguageModelTextPart) {
          assistantText += part.value;
          handlers.onFragment(part.value);
        } else if (part instanceof vscode.LanguageModelToolCallPart) {
          toolCalls.push(part);
        }
      }

      if (assistantText) {
        transcript += assistantText;
        try {
          outputTokens += await model.countTokens(assistantText);
        } catch {
          // best effort
        }
      }

      if (opToken.isCancellationRequested) {
        stopReason = token.isCancellationRequested ? 'cancelled' : 'timeout';
        break;
      }

      // No tool calls => the model produced its final answer.
      if (toolCalls.length === 0) {
        stopReason = 'finished';
        break;
      }

      // Record the assistant turn (text + tool calls) so the model has context.
      const assistantParts: Array<
        vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart
      > = [];
      if (assistantText) assistantParts.push(new vscode.LanguageModelTextPart(assistantText));
      assistantParts.push(...toolCalls);
      messages.push(vscode.LanguageModelChatMessage.Assistant(assistantParts));

      // Execute each requested tool and feed results back as a User turn.
      const resultParts: vscode.LanguageModelToolResultPart[] = [];
      let finished = false;
      for (const call of toolCalls) {
        const outcome = await executeTool(call.name, call.input, {
          dir: sandbox.dir,
          commandTimeoutMs: opts.commandTimeoutMs,
          token: opToken,
          allowCommand: opts.allowCommand
        });

        const step: AgentStep = {
          iteration: iterations,
          tool: call.name,
          args: truncate(JSON.stringify(call.input ?? {}), STEP_ARG_LIMIT),
          result: truncate(outcome.content, STEP_RESULT_LIMIT),
          ok: outcome.ok
        };
        steps.push(step);
        handlers.onStep(step);

        resultParts.push(
          new vscode.LanguageModelToolResultPart(call.callId, [
            new vscode.LanguageModelTextPart(outcome.content)
          ])
        );

        if (outcome.finished) {
          finished = true;
          summary = outcome.content;
        }
      }

      messages.push(vscode.LanguageModelChatMessage.User(resultParts));

      if (finished) {
        stopReason = 'finished';
        break;
      }
    }
  } catch (err) {
    const described = describeError(err);
    if (timedOut && !token.isCancellationRequested) {
      stopReason = 'timeout';
    } else if (described.code === 'cancelled' || token.isCancellationRequested) {
      stopReason = 'cancelled';
    } else {
      stopReason = 'error';
      error = described;
    }
  } finally {
    if (watchdog) clearTimeout(watchdog);
    externalCancel.dispose();
    deadline.dispose();
  }

  return {
    modelId: model.id,
    transcript,
    steps,
    iterations,
    tokens: { input: lastInputTokens, output: outputTokens },
    latencyMs: Date.now() - start,
    stopReason,
    filesChanged: 0,
    canApply: sandbox.isWorktree,
    summary,
    error
  };
}
