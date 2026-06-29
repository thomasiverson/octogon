# Phase 7 — Polish, docs & demo

**Goal:** Production-ready polish, documentation, tests, and a repeatable demo.

**Depends on:** Phases 1–5 (and 6 if implemented).

---

## Tasks

1. **Docs:** update [../README.md](../README.md) for any behavior changes; add a screenshot or short GIF of the side-by-side panel.
2. **Settings:** ensure every `octogon.*` key is declared in `contributes.configuration` with clear descriptions.
3. **UX:** polish loading/empty/error states, add streaming indicators, and ensure basic keyboard accessibility in the webview.
4. **Demo script** (`docs/demo.md`): clone `Azure-Samples/octocat-supply`, run a sample task (e.g. *"Add a discount field to the Product model and update related components"*), and walk through the cost/accuracy comparison.
5. **Disclaimers in-UI:** a visible "estimate" banner for the pre-run cost and a reminder that runs consume real tokens/credits.
6. **Tests + CI:** unit tests for cost math, token budgeting, retrieval ranking, the message protocol, and judge-output parsing (LM mocked). Add `.github/workflows/ci.yml` (build + test).
7. **Packaging:** produce a `.vsix` (`vsce package`). Keep **"Copilot"** out of the extension name/ID (Marketplace + trademark guidance).

## Files

`../README.md`, `docs/demo.md`, `test/*`, `.github/workflows/ci.yml`, `CHANGELOG.md`.

## Acceptance criteria

- All configuration is documented; estimate + consumption disclaimers are visible in the UI.
- Unit tests pass locally and in CI.
- A `.vsix` packages successfully, and the demo script reproduces a full comparison on OctoCAT Supply.
