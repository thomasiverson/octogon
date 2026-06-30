# Phase 8 — Agent bake-off (stretch, optional)

**Goal:** Add an optional **Agent mode** that runs an autonomous, tool-using coding loop for each selected model in an **isolated sandbox**, then compares the resulting **diffs, test outcomes, cost, and iterations** side by side — letting you pick a winner and apply its changes to your working tree.

**Depends on:** Phase 3 (repo context) and Phase 6 (verification sandbox). **Optional / stretch.**

---

## Decisive design constraints (read first)

- **Everything runs in the TypeScript extension host.** Copilot models via `vscode.lm` are *only* reachable from the extension host, so the agent loop **must** run there. An external C#/Python orchestrator (e.g. Microsoft Agent Framework) cannot call `vscode.lm` and would be forced into BYOK keys — which breaks Octogon's "compare your Copilot picker, no extra keys" premise. **No rewrite; stay in TS.**
- **DIY tool-calling loop on `vscode.lm`** (the "implement tool calling yourself" path), or optionally a JS-native agent library (LangGraph.js / Vercel AI SDK) with a `vscode.lm` adapter. Do **not** introduce a polyglot backend.
- **Reuse the Phase 6 sandbox** (git worktree per model + optional `node_modules` junction) for isolation.
- **Out of scope for this phase:** exposing tools as an MCP server.
- **Security first:** applying arbitrary model edits and running commands is the riskiest thing the extension does — sandbox everything, require explicit consent, enforce hard caps, and never touch the real working tree until the user applies a chosen diff.

---

## Tasks

### Stage A — Single-model agent loop (prove the loop)

1. **Mode toggle:** add an **Ask | Agent** switch on the main screen (default **Ask** = current behavior). Thread a `mode: 'ask' | 'agent'` through `RunOptions` and the message protocol.
2. **Agent tools** (`src/agent/tools.ts`): a minimal, sandbox-scoped tool set — `list_files`, `read_file`, `write_file`, `run_command`, and a `finish` signal. JSON-schema each; keep argument parsing pure/testable.
3. **Sandbox module** (`src/agent/sandbox.ts`): extract the git-worktree / copy + `node_modules` junction logic out of `src/scoring/verify.ts` into a shared module. One worktree per agent run; guaranteed cleanup.
4. **Agent loop** (`src/agent/loop.ts`): given a model instance + sandbox dir + task, call `model.sendRequest` with tool definitions, read **tool-call parts** from the response stream, execute the requested tool against the sandbox, append the result, and iterate until `finish` or a cap is hit. Capture transcript, tokens, cost, and iteration count.
5. **Caps & safety:** explicit consent modal; per-`run_command` display + confirmation (reuse the `octogon.verifyCommand` allowance); hard limits via config — `octogon.agent.maxIterations`, `octogon.agent.timeoutMs`, `octogon.agent.maxTokens`; default **off**.
6. **UI:** a single agent run streams its transcript (tool calls + outputs) and shows the final diff.

### Stage B — Parallel multi-model bake-off

1. **Parallel orchestration:** run N agent loops concurrently with `Promise.allSettled`, each in its own worktree (reuse the existing parallel run pattern).
2. **Isolation:** one sandbox per model; failures isolated per column.
3. **Streaming:** stream each agent's transcript into its own result column.
4. **Cancellation:** a single `CancellationTokenSource` cancels all in-flight loops and kills their child processes.
5. **Budget guard:** a pre-run cost preview (agents are many calls × tools) plus an aggregate token/credit cap across all agents that halts the run when exceeded.

### Stage C — Comparison & apply

1. **Per-model outcome:** git diff (files changed, +/- lines), test **pass/fail** (run `octogon.verifyCommand` in each sandbox), cost, iterations, latency.
2. **Side-by-side comparison:** a diff view per column (summary + expandable), a test badge, and cost/iteration badges; extend the leaderboard with agent-specific entries (e.g. *passed tests*, *smallest diff*, *cheapest-to-green*).
3. **Apply winner:** picking a winner applies that sandbox's diff to the real working tree **with confirmation and a review step**; never auto-apply. Other sandboxes are discarded.
4. **Persistence:** extend `RunRecord` to store agent transcripts + diff summaries so agent runs appear in history.
5. **Cleanup:** remove all worktrees / temp dirs when the run ends or is cancelled.

## Files

`src/agent/loop.ts`, `src/agent/tools.ts`, `src/agent/sandbox.ts` (extracted from `src/scoring/verify.ts`), orchestrator + controller updates, webview (`ModeToggle`, agent transcript + diff view), shared types (`mode`, agent messages, agent run record), config entries (caps).

## Implementation notes

- Keep **pure, vscode-free, unit-tested** functions for: tool-call argument parsing, diff summarization, and budget accounting.
- The loop must use `vscode.lm` tool support (`LanguageModelChatTool` definitions + tool-call parts in the stream). A JS-native agent lib with a `vscode.lm` adapter is an acceptable alternative to a hand-rolled loop.
- Treat `run_command` and `write_file` as the dangerous tools: confine to the sandbox, validate paths (reject traversal/absolute — reuse `isUnsafePath`), gate behind consent, and cap.
- Agent mode is **experimental and opt-in**; failures must never break Ask mode or any earlier phase.

## Acceptance criteria

- A visible **Ask | Agent** toggle switches between today's response comparison and the agent bake-off.
- In Agent mode, selecting 2–3 models + a coding task runs each as an **isolated** agent; transcripts stream side by side.
- Each column shows a **diff, test pass/fail, cost, and iteration count**.
- Picking a winner **applies that diff** to the working tree (with confirmation); other sandboxes are discarded and cleaned up.
- Agent mode is opt-in, consent-gated, and hard-capped; disabling it leaves **all earlier phases fully functional**.
