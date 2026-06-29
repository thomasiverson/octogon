# Phase 4 — Quality scoring

**Goal:** Add **manual rating** and **LLM-as-judge** scoring.

**Depends on:** Phases 1–2.

---

## Tasks

1. **Manual rating:** per-column star rating (1–5) plus a **"pick winner"** toggle, stored on the run result (held in memory now; persisted in Phase 5).
2. **Judge** (`src/scoring/judge.ts`): select a judge model (config `octogon.judgeModelId`, default to a strong available model). Build a judge prompt = original task + each response (+ optional reference answer) + a rubric, returning JSON `{ modelId, score, rationale }` per response. Parse robustly (strip code fences; tolerate stray text). Trigger via an opt-in **Judge** button.
3. **Judge cost:** each judge call consumes extra tokens/credits — include this in the pre-run cost preview and warn the user.
4. **Webview:** rating UI, judge button, and per-column judge score + rationale; extend the leaderboard with **highest-rated**.
5. **Reference answer (optional):** an input field; when provided, the judge scores responses against it.

## Files

`src/scoring/manual.ts`, `src/scoring/judge.ts`, orchestrator/panel/webview updates, config entry.

## Implementation notes

- Prefer a **single batched judge call** that ranks all responses (fewer tokens/credits) over one call per response — document the choice.
- The judge is also non-deterministic; always surface its rationale so the user can sanity-check.
- Guard against judge JSON parse failures (fallback to "unscored" with the raw text shown).

## Acceptance criteria

- Responses can be rated; ratings persist within the session and feed the leaderboard.
- Running the judge produces scores + rationales, and the cost preview reflects the extra tokens/credits.
- Providing a reference answer changes the judge's scoring.
