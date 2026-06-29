# Phase 2 — Cost engine (token-based)

**Goal:** Show **token cost** (Copilot's usage-based AI-credit rates) per model in **USD and AI credits**, a **pre-run cost preview**, and a **leaderboard**.

**Depends on:** Phase 1.

---

## Tasks

1. **Seed data (already pre-populated — verified 2026-06-25; just wire it up):**
   - `src/cost/data/model-pricing.json` → usage-based token rates: `{ aiCreditUsd, unit, models: { <modelKey>: { provider, input, cachedInput, output, cacheWrite?, longContext? } } }` (per 1M tokens).
   - Carries `lastUpdated` and a `source` URL. Keep an `unknown`/`TODO` path for models missing from the table.
2. **Calculator** (`src/cost/costCalculator.ts`):
   - `tokenCost(modelId, inTok, outTok)` → `{ usd, credits }` where `usd = inTok/1e6*input + outTok/1e6*output` and `credits = usd / aiCreditUsd`. Honor the `longContext` tier when `inTok` exceeds the threshold.
   - A normalization helper mapping VS Code model `id`/`family` → these JSON keys, with an `unknown` fallback that flags "rate unavailable".
3. **Config** (`package.json`): `octogon.pricingTablePath` (load override JSON when set) and `octogon.expectedOutputTokens` (default output-token estimate for the pre-run preview).
4. **Pre-run preview:** before running, estimate the token cost from input tokens + the configurable expected-output estimate (exact cost is known only after the run). Show a confirm step ("This run ≈ $X / N credits").
5. **Webview:** per-column cost block — token cost in **USD + AI credits**, broken down by input/output. Mark the pre-run number as an estimate; show the exact post-run number.
6. **Leaderboard:** cheapest (by token USD) and fastest (latency). Highest-rated is added in Phase 4.

## Files

`src/cost/costCalculator.ts`, `src/cost/data/model-pricing.json`, orchestrator update (attach costs to results), webview `CostBadge` + `Leaderboard`, config entries in `package.json`.

## Implementation notes

- Rates change → surface `lastUpdated`, mark the pre-run number an estimate, honor the override path.
- 1 AI credit = $0.01 USD; show both USD and credits. Anthropic adds a `cacheWrite` rate; `cachedInput` is the reuse rate.
- Respect `longContext` tiers (GPT-5.4/5.5 > 272K input tokens; Gemini 3.1 Pro > 200K).
- Normalize model identifiers carefully (Copilot family names vs JSON keys); flag unknown models instead of guessing.

## Acceptance criteria

- Each column shows **token cost (USD + AI credits)**, split into input/output.
- The pre-run preview shows an estimated cost and requires confirmation; the post-run number reflects actual tokens.
- The leaderboard highlights cheapest (by token cost) + fastest.
- Setting `octogon.pricingTablePath` changes the displayed numbers.
