# Phase 0 — Scaffold

**Goal:** A runnable VS Code extension with a React/Vite/Tailwind webview and an `octogon.open` command that opens an empty panel.

**Depends on:** nothing.

---

## Tasks

1. **Extension manifest** (`package.json` at repo root): set `engines.vscode` to `^1.90.0`; contribute command `octogon.open` with title `"Octogon: Open"`; set activation to `onCommand:octogon.open`; declare `main` → `dist/extension.js`.
2. **TypeScript config** (`tsconfig.json`): strict, `module` CommonJS, `target` ES2021, `outDir dist`.
3. **esbuild** (`esbuild.js`): bundle `src/extension.ts` → `dist/extension.js`, `platform: node`, `external: ['vscode']`, with `build`/`watch` modes.
4. **Webview app** (`webview/`): Vite + React 18 + Tailwind + TypeScript. Configure Vite to build to `media/` (or `dist/webview/`) with a single JS + CSS entry.
5. **Panel host** (`src/webview/panel.ts`): a `ComparePanel` class that creates/reveals a singleton `WebviewPanel`, loads the built assets via `webview.asWebviewUri`, sets a strict **CSP** with a nonce, and enables `retainContextWhenHidden`.
6. **Typed message protocol** (`src/shared/types.ts`): a discriminated union for extension↔webview messages. Implement a `ready` → `init` handshake.
7. **Activation** (`src/extension.ts`): register `octogon.open`; create/reveal the panel.
8. **Tooling:** npm scripts `build`, `watch`, `package`; add `.vscodeignore`.

## Files

`package.json`, `tsconfig.json`, `esbuild.js`, `.vscodeignore`, `src/extension.ts`, `src/webview/panel.ts`, `src/shared/types.ts`, `webview/index.html`, `webview/vite.config.ts`, `webview/tailwind.config.js`, `webview/postcss.config.js`, `webview/src/main.tsx`, `webview/src/App.tsx`.

## Implementation notes

- CSP: allow scripts/styles only from `webview.cspSource` + the script nonce. Add a `getNonce()` helper.
- The asset path referenced in `panel.ts` **must** match the Vite output directory.
- Keep the message protocol typed and shared by both sides (import the same `types.ts`).

## Acceptance criteria

- `F5` launches the Extension Development Host with no errors.
- Running **"Octogon: Open"** opens a panel that renders a React placeholder (an "Octogon" heading).
- The `ready`/`init` postMessage round-trip is observable (log on both sides).
- `npm run build` completes with zero TypeScript errors.
