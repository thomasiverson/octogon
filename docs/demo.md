# Octogon demo — OctoCAT Supply

A repeatable walkthrough that compares models on **cost** and **accuracy** against a real repo.

## 1. Set up

```bash
# In a separate folder, clone the demo repo (OctoCAT Supply)
git clone https://github.com/microsoft/GitHubCopilot_Customized octocat-supply
```

Build and launch Octogon from this repository:

```bash
npm install
npm run build
# Press F5 to open the Extension Development Host
```

In the **Extension Development Host** window, open the cloned `octocat-supply`
folder (File → Open Folder).

## 2. Open the panel

Run **"Octogon: Open"** from the Command Palette (`Ctrl/Cmd+Shift+P`). The first
run triggers the GitHub Copilot consent dialog — grant model access.

## 3. Pick models and a task

1. In the model picker, select **2–3 models** (e.g. a small, a mid, and a frontier model).
2. (Optional) Open `src/.../product` model file so it becomes the **active file**, or use
   **Attach files…** and toggle **Retrieval** on.
3. Enter a task, for example:

   > Add a `discount` field to the Product model and update the related components.

## 4. Preview cost, then run

1. Click **Run comparison** — Octogon shows an **estimated** cost (USD + AI credits) per model.
2. Confirm to run. Responses stream side by side with latency, token, and **cost** badges.
3. Review the **leaderboard** (cheapest / fastest) and the **"context included"** disclosure.

## 5. Score accuracy

- Give each response a **star rating**, or **Pick winner**.
- Click **Run LLM judge** (optionally add a reference answer) to get per-model scores + rationales.
  The judge consumes additional tokens/credits.

## 6. (Optional) Verify

1. Set `octogon.verifyCommand` (e.g. `npm test`) in Settings.
2. Click **Run verification**, confirm the command in the dialog. Each response is applied to an
   isolated sandbox copy of the repo and the test command runs; pass/fail is recorded per column.

## 7. History & export

- Reopen the run later from **History**, **Compare** two runs, or **Export** a run to JSON/Markdown.

---

> All costs are estimates based on Copilot usage-based rates (1 AI credit = $0.01). Running
> comparisons, the judge, and verification consume real tokens/credits against your plan.
