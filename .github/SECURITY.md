# Security Policy

## Supported versions

Octogon is under active development. Security fixes land on the latest released version.

| Version | Supported |
| --- | --- |
| 0.2.x | :white_check_mark: |
| < 0.2 | :x: |

## Reporting a vulnerability

**Please do not report security issues in public GitHub issues.**

Use GitHub's **private vulnerability reporting**:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe the issue, the affected version, and reproduction steps.

You can expect an initial response within a few days. Once a fix is available it will be released, and the report credited unless you prefer to remain anonymous.

## Security model & scope

A few design points worth knowing when assessing risk:

- **No external API keys or third-party network calls on the core path.** Model access goes through the VS Code Language Model API (`vscode.lm`) using your existing Copilot subscription.
- **No telemetry.** Run history, cost figures, and model stats are stored locally in extension storage; Octogon does not send them anywhere.
- **Command execution is opt-in and gated.** The optional *verification* command and *Agent Mode* can run shell commands. These are:
  - off by default (`octogon.verifyCommand` is unset; `octogon.agent.enabled` is `false`),
  - confined to an isolated sandbox copy of the workspace with path checks, and
  - shown to you and gated behind an explicit consent prompt before anything runs.
- **Pricing data is local.** The bundled pricing table is a static JSON file; the override path is user-controlled.

If you find a way to bypass the consent gate, escape the sandbox, or break path confinement, please report it through the process above.
