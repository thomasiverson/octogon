# Changelog

All notable changes to **Octogon** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] — 2026-07-14

### Added
- **Pick your own blind contestants** — a **Contestants** toggle in Blind mode lets you switch from
  **Auto (random)** to **Pick models** and hand-pick which models compete (at least 2). Your
  choices are shuffled server-side and stay anonymized as **Model A / B / C** until you pick the
  best answer (or reveal), so the judging is still bias-free.

## [0.5.0] — 2026-07-14

### Added
- **Blind test mode** — a new **Blind** mode beside Ask/Agent. Octogon picks N random models
  (`octogon.blind.modelCount`, clamped 2–4, default 3) and streams them as anonymized
  **Model A / B / C** with names, cost, latency, and the leaderboard hidden. Pick the best answer —
  or hit **Reveal** — to unveil identities, metrics, and the leaderboard. Winner picks and star
  ratings feed history and model stats **bias-free**; the history list tags blind runs, and the
  LLM judge / verification unlock after the reveal.

## [0.4.0] — 2026-07-01

### Added
- **Settings shortcut** — an **Octogon: Settings** command and a ⚙ gear in the panel header that
  open VS Code Settings filtered to Octogon.
- **Pricing freshness** — the header now shows how old the pricing snapshot is (amber past 30 days)
  with a one-click **refresh**. A new **Octogon: Refresh Pricing** command + `octogon.pricingUrl`
  fetch an updated table from a URL you control. The fetch is **opt-in and user-initiated** — the
  only outbound request Octogon makes. Load precedence is override path → refreshed cache → bundled.
- **Sharper pre-run estimate** — the cost preview now estimates each model's output using its
  historical average output tokens (from your run history), falling back to
  `octogon.expectedOutputTokens`; the per-model expected output is shown in the preview.
- **Activation smoke test** — a Vitest test that mocks the host and verifies the extension registers
  its commands and opens the panel.

### Changed
- Moved the bundled pricing table to **`pricing/model-pricing.json`** — an obvious, updatable
  location that doubles as the default refresh source.
- Docs: corrected the README testing description (there is no `@vscode/test-electron` suite) and
  documented pricing refresh; SECURITY.md now notes the single opt-in pricing fetch.

## [0.3.0] — 2026-07-01

### Added
- **Self-preference guard for the LLM judge.** When the model chosen to judge a run also competed
  in it, the Ask row now shows a non-blocking warning (naming the model) — models tend to rate
  their own answers higher. You can still proceed.

### Changed
- **Auto judge selection now avoids competitors.** "Auto (strongest)" — and a configured
  `octogon.judgeModelId` — prefers a strong evaluator that did *not* compete in the run, falling
  back to a competitor only when no other model is available. An explicit dropdown choice is still
  always honored.

## [0.2.0] — 2026-06-30

### Added
- **Agent Mode — experimental bake-off** *(opt-in, off by default)*. With `octogon.agent.enabled`,
  each selected model runs as an autonomous, tool-using coding agent inside an **isolated sandbox**
  copy of the repo. Agents read files, write changes, and run build/test commands on their own,
  narrating each step, and are ranked side by side.
  - Self-driven `vscode.lm` tool-calling loop with per-agent iteration, wall-clock, and token caps
    (`src/agent/loop.ts`).
  - Sandbox with path confinement and a consent gate on every shell command
    (`src/agent/sandbox.ts`, `src/agent/tools.ts`).
  - Agent ranking across cost, speed, and completion (`src/agent/agentRanking.ts`), with unit tests.
  - New webview surface — a mode toggle, per-agent columns with live step narration, and an agent
    grid (`ModeToggle`, `AgentColumn`, `AgentGrid`).
- **Agent settings** — `octogon.agent.enabled`, `octogon.agent.maxIterations`,
  `octogon.agent.timeoutMs`, `octogon.agent.maxTokens`, and `octogon.agent.commandTimeoutMs`.

### Changed
- Prepared the repository for public release — a marketing-focused README rewrite, community
  health files (contributing guide, code of conduct, security policy, and issue/PR templates), and
  `homepage`/`bugs` metadata in `package.json`.
- Sandboxed verification (`src/scoring/verify.ts`) now shares the agent sandbox primitives.

### Removed
- Internal `plan/` phase documents, superseded by the shipped implementation.

## [0.1.0] — 2026-06-29

### Added
- **Best-value leaderboard** and **per-model performance dashboard** — throughput (tokens/sec)
  badges, cheapest / fastest / best-value ranking, and per-model stats persisted across runs
  (`src/shared/leaderboard.ts`, `src/shared/metrics.ts`, `src/store/modelStats.ts`, `ModelStatsPanel`).
- **Markdown-rendered responses** in each result column.
- **Ask action row** — judge and verify controls consolidated into one row with a judge-model
  dropdown (replacing the separate judge/verify bars).
- **Provider-grouped, price-sorted model picker** with inline token rates.
- **Activity Bar presence** — Octogon icon and brand mark (`assets/octogon-icon.svg`, `OctogonMark`).
- **Collapsible sections** with full-height, independently scrolling result columns, the leaderboard
  moved above the answers, and descriptive badge tooltips.
- **CI & release** — GitHub Actions CI that packages a `.vsix` artifact and a manual release
  workflow; action runners upgraded to the Node 24 runtime (built on Node 22 LTS).

### Changed
- Context builder tracks the last active editor so active-file context survives focus changes.

### Fixed
- De-duplicate models returned by the picker; add `gpt-4o` pricing.

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
