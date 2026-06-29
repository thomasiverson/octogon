import { RunRecord } from '../shared/types';

function fmtUsd(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function fmtLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Render a run as a readable Markdown summary (pure; unit-testable). */
export function buildMarkdownSummary(record: RunRecord): string {
  const date = new Date(record.timestamp).toISOString();
  const lines: string[] = [];

  lines.push(`# Octogon run — ${date}`);
  lines.push('');
  lines.push('## Prompt');
  lines.push('');
  lines.push('```');
  lines.push(record.prompt);
  lines.push('```');
  lines.push('');

  if (record.contextRefs.length > 0) {
    lines.push('## Context included');
    lines.push('');
    for (const ref of record.contextRefs) {
      lines.push(`- \`${ref.path}\` (${ref.source}, ${ref.tokens} tokens)`);
    }
    lines.push('');
  }

  lines.push('## Results');
  lines.push('');
  lines.push('| Model | Latency | In | Out | Cost (USD) | Credits | Rating | Judge |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const id of record.modelIds) {
    const r = record.results.find((x) => x.modelId === id);
    const name = record.modelNames[id] ?? id;
    if (!r) {
      lines.push(`| ${name} | — | — | — | — | — | — | — |`);
      continue;
    }
    if (r.error) {
      lines.push(`| ${name} | error | — | — | — | — | — | — |`);
      continue;
    }
    const cost = r.cost?.rateAvailable ? fmtUsd(r.cost.usd) : 'n/a';
    const credits = r.cost?.rateAvailable ? r.cost.credits.toFixed(2) : 'n/a';
    const rating = typeof r.manualRating === 'number' ? `${r.manualRating}/5` : '—';
    const judge = r.judge && r.judge.score > 0 ? `${r.judge.score}/10` : '—';
    const winnerMark = record.winner === id ? ' 👑' : '';
    lines.push(
      `| ${name}${winnerMark} | ${fmtLatency(r.latencyMs)} | ${r.tokens.input} | ${r.tokens.output} | ${cost} | ${credits} | ${rating} | ${judge} |`
    );
  }
  lines.push('');

  const judged = record.results.filter((r) => r.judge && r.judge.rationale);
  if (judged.length > 0) {
    lines.push('## Judge rationales');
    lines.push('');
    for (const r of judged) {
      const name = record.modelNames[r.modelId] ?? r.modelId;
      lines.push(`- **${name}** (${r.judge!.score}/10): ${r.judge!.rationale}`);
    }
    lines.push('');
  }

  lines.push('## Responses');
  lines.push('');
  for (const id of record.modelIds) {
    const r = record.results.find((x) => x.modelId === id);
    const name = record.modelNames[id] ?? id;
    lines.push(`### ${name}`);
    lines.push('');
    lines.push('```');
    lines.push(r?.error ? `[error] ${r.error.message}` : r?.output ?? '');
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}
