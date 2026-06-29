# Phase 6 — Automated task verification (stretch, optional)

**Goal:** For code tasks, run each model's output against the repo's build/tests and record pass/fail.

**Depends on:** Phase 3. **Optional** — skip if you only need cost + subjective/judged accuracy.

---

## Tasks

1. **Config:** `octogon.verifyCommand` (per-workspace; e.g. `make test` or `npm test`), default unset.
2. **Verifier** (`src/scoring/verify.ts`): for each model result, create an isolated **scratch copy or git worktree** of the repo, apply the model's output (start narrow: extract code blocks / a single target file inferred from the prompt), run the verify command, and capture exit code + output.
3. **Safety:** sandbox with a timeout; require **explicit opt-in**; show the exact command before running; default **off**.
4. **Webview:** a pass/fail badge + collapsible log per column; feed the leaderboard (verified-pass ranks above unverified).

## Files

`src/scoring/verify.ts`, orchestrator/panel/webview updates, config entry.

## Implementation notes

- **Security first:** never run commands silently. Display the command, gate behind explicit consent, and isolate via a temp dir or `git worktree`.
- Applying arbitrary model output is heuristic — keep scope narrow (single-file edits) initially.
- Treat this as experimental; failures here must never break the core comparison flow.

## Acceptance criteria

- For a code task on OctoCAT Supply, each model's output is built/tested and a pass/fail result is recorded.
- Verification is opt-in, shows the command, and runs sandboxed.
- Disabling it leaves all earlier phases fully functional.
