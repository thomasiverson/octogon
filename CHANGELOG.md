# Changelog

All notable changes to **Octogon** are documented here.

## [0.0.1] — 2026-06-25

Initial implementation across phases 0–7.

### Added
- **Scaffold** — VS Code extension host (TypeScript + esbuild) with a React 18 + Vite + Tailwind
  webview opened by the `octogon.open` command, behind a CSP-hardened panel and a typed
  extension↔webview message protocol.
- **Core comparison loop** — enumerate Copilot models via `vscode.lm.selectChatModels`, run a
  prompt across multiple models in parallel, stream responses side by side, and capture latency,
  time-to-first-token, and input/output token counts. Per-column error isolation and cancellation.
- **Cost engine** — token cost in USD and GitHub AI credits from a bundled, dated pricing table,
  with long-context tiers, a model-id normalizer, a pre-run cost preview with confirmation, and a
  cheapest/fastest leaderboard. Override via `octogon.pricingTablePath`.
- **Repo context** — active file + selection, manually attached files, and lightweight keyword
  retrieval, all token-budgeted to the smallest selected model's window, with a transparent
  "context included" disclosure.
- **Quality scoring** — manual 1–5 star ratings, pick-a-winner, and an opt-in batched LLM-as-judge
  (with optional reference answer) that adds a highest-rated leaderboard entry.
- **Persistence** — local run history (save / browse / reload read-only / compare / export to JSON
  or Markdown) in global storage, plus an `octogon.clearHistory` command.
- **Verification (experimental)** — opt-in, consent-gated sandboxed build/test verification of code
  responses via `octogon.verifyCommand`.
- **Tooling** — unit tests (Vitest) for cost math, token budgeting, retrieval ranking, judge-output
  parsing, code-block extraction, the Markdown exporter, and the webview reducer; GitHub Actions CI.

### Notes
- All cost figures are estimates; running comparisons consumes real tokens/credits.
