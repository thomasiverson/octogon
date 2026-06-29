# Phase 3 — Repo context

**Goal:** Inject repository context — active file + selection, manually attached files, and lightweight retrieval — token-budgeted and transparent. Works on **any** open repo.

**Depends on:** Phase 1 (independent of Phase 2).

---

## Tasks

1. **Context builder** (`src/context/contextBuilder.ts`): gather the active editor document + current selection; accept a list of attached file paths. Assemble a context block with clear per-file path headers and contents.
2. **Retrieval** (`src/context/retrieval.ts`): lightweight keyword/identifier search across the workspace (`vscode.workspace.findFiles` + read + simple relevance scoring, or ripgrep). Return the top-K snippets. Config: `octogon.retrieval.topK` (default 5).
3. **Token budgeting:** use `model.countTokens` on the assembled context and **trim to fit** `maxInputTokens` minus the prompt and a reserve for the response. Budget to the **smallest** selected model's window for fairness — document the choice.
4. **Webview context panel:** an active-file chip, an **Attach files** button (QuickPick), a **retrieval toggle + K**, and a **"context included"** disclosure listing the files/snippets actually sent.
5. **Orchestrator:** prepend the assembled context to the first `User` message.

## Files

`src/context/contextBuilder.ts`, `src/context/retrieval.ts`, orchestrator + webview updates (`ContextPanel`), config entry.

## Implementation notes

- Respect `.gitignore` and `files.exclude` (pass excludes to `findFiles`).
- **Transparency:** always show exactly what was sent — this is also how the user reasons about token cost.
- Keep retrieval simple (keyword) for v1; embeddings RAG is a future upgrade.
- Do **not** hardcode OctoCAT Supply — this must work on any repository.

## Acceptance criteria

- Active file + selection are auto-included and visible in the disclosure.
- Attaching a file makes it appear in context and increases the token count.
- With retrieval on, a repo-specific question pulls in relevant snippets.
- Oversized context is trimmed (no model errors) and the trimming is reported.
