# Phase 1 — Core comparison loop

**Goal:** Enter a prompt, select multiple Copilot models, run them in parallel, stream responses side by side, and capture latency + token counts.

**Depends on:** Phase 0.

---

## Tasks

1. **Model registry** (`src/models/registry.ts`): call `vscode.lm.selectChatModels({ vendor: 'copilot' })`; map each to `{ id, family, name, vendor, maxInputTokens }`. Return `[]` (with a UI message) when none are available. Must run from the command so the **consent** dialog can appear.
2. **Webview controls:** prompt `textarea`, a **model multiselect** populated from the registry (sent via message), a **Run** button, and a **Cancel** button.
3. **Orchestrator** (`src/runner/orchestrator.ts`): for each selected model, build messages (a single `User` message containing the prompt for now) and call `model.sendRequest(messages, {}, token)`. Stream fragments back to the webview tagged with `modelId`. Run all models concurrently with `Promise.allSettled`.
4. **Metrics:** record `startTime`, **time-to-first-token**, and total duration; compute `inputTokens` via `model.countTokens(messages)` and `outputTokens` via `model.countTokens(fullResponse)`.
5. **Side-by-side grid:** one column per selected model showing streaming text plus latency + token badges, with an isolated **error state** per column.
6. **Cancellation:** Cancel triggers a `CancellationTokenSource` that stops all in-flight requests.

## Files

`src/models/registry.ts`, `src/runner/orchestrator.ts`, updates to `src/webview/panel.ts` and `src/shared/types.ts`, webview components (`PromptBar`, `ModelPicker`, `ResultColumn`, `ResultGrid`).

## Implementation notes

- **No system messages** — prepend any instructions into the first `User` message.
- Wrap `sendRequest` in try/catch for `LanguageModelError`; surface `code`/`cause` (e.g., `off_topic`, quota) per column.
- `countTokens` is async and model-specific; call it on the right model instance.
- Respect `maxInputTokens`: warn if exceeded now (actual trimming arrives in Phase 3).

## Acceptance criteria

- Selecting 2–3 models, entering a prompt, and clicking **Run** streams answers into parallel columns simultaneously.
- Each column shows latency and input/output token counts.
- The consent dialog appears on first use; the empty-model case is handled gracefully.
- **Cancel** stops streaming promptly.
