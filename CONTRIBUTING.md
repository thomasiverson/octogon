# Contributing to Octogon

Thanks for your interest in improving Octogon! This guide covers how to build, test, and submit changes.

## Prerequisites

- **Node.js 22** — the CI and release workflows build on Node 22 LTS.
- **npm** (bundled with Node).
- **VS Code 1.95+** with an active GitHub Copilot subscription — needed to exercise the model-picker features at runtime.

## Getting started

```bash
git clone https://github.com/thomasiverson/octogon.git
cd octogon
npm install
npm run build        # builds the extension (esbuild) + webview (Vite)
```

Press **F5** in VS Code to launch the Extension Development Host, then run **"Octogon: Open"** from the Command Palette.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run build` | Build extension + webview |
| `npm run watch:extension` | Rebuild the extension on change |
| `npm run compile` | Type-check both projects (no emit) |
| `npm test` | Run the Vitest unit suite (the language model is mocked) |
| `npm run package` | Produce a `.vsix` |

## Before you open a pull request

1. Keep changes focused — one logical change per PR.
2. Add or update unit tests for new behavior. Tests mock `vscode.lm`, so they run without real model calls or credits.
3. Run the checks locally:
   ```bash
   npm run compile
   npm test
   ```
4. Add a note to [CHANGELOG.md](CHANGELOG.md) under the next version.
5. Write a clear, imperative commit message. This project loosely follows Conventional Commits (`feat:`, `fix:`, `ci:`, `chore:`, `docs:`).

## Project layout

See the **Under the hood** section of the [README](README.md#under-the-hood) for a map of `src/` and `webview/`.

## Reporting bugs & requesting features

Open an issue using the provided templates. For anything security-sensitive, follow the [security policy](.github/SECURITY.md) instead of filing a public issue.

## Code of Conduct

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).
