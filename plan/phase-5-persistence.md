# Phase 5 — Persistence & history

**Goal:** Save runs to local storage and browse / reload / compare / export them.

**Depends on:** Phases 1–4.

---

## Tasks

1. **Store** (`src/store/historyStore.ts`): persist runs to `context.globalStorageUri` as JSON (one file per run + an `index.json`, or JSONL). Schema: `id`, `timestamp`, `prompt`, `contextRefs`, `models[]`, per-model results (`output`, `tokens`, `latency`, `costs`, `manualRating`, `judgeScore`), `winner`, and a `version` field.
2. **Save** on run completion and whenever ratings/judge results change.
3. **History panel** (webview): list past runs (date, prompt snippet, models, winner); clicking one reloads it into the grid as a read-only view.
4. **Compare:** select two runs and show a basic diff of costs/scores.
5. **Export:** a single run to JSON **or** a readable Markdown summary (copy + save to file).

## Files

`src/store/historyStore.ts`, extension-activation update (pass `globalStorageUri`), panel/webview `HistoryPanel`, shared types.

## Implementation notes

- JSON for v1 (zero native dependencies); SQLite is an optional later upgrade.
- Add an `octogon.clearHistory` command and cap stored history size.
- Validate/migrate on load using the `version` field.

## Acceptance criteria

- A completed run persists and appears in the history list after reloading the panel.
- A past run can be reloaded into the grid.
- Export produces valid JSON and a readable Markdown summary.
