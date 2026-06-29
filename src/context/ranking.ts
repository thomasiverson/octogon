// Pure keyword ranking for lightweight retrieval. No 'vscode' dependency so the
// ranking can be unit-tested directly.

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'you',
  'are', 'was', 'were', 'has', 'have', 'had', 'not', 'but', 'all', 'any', 'can',
  'will', 'would', 'should', 'could', 'add', 'update', 'change', 'make', 'use',
  'using', 'how', 'what', 'when', 'where', 'which', 'who', 'why', 'please', 'need',
  'want', 'get', 'set', 'new', 'old', 'code', 'file', 'files', 'function', 'method'
]);

/** Extract distinct lowercase identifier/word terms (length >= 3, non-stopword). */
export function extractTerms(prompt: string): string[] {
  const tokens = prompt.match(/[A-Za-z0-9_]+/g) ?? [];
  const terms = new Set<string>();
  for (const raw of tokens) {
    const lower = raw.toLowerCase();
    if (lower.length >= 3 && !STOPWORDS.has(lower) && !/^\d+$/.test(lower)) {
      terms.add(lower);
    }
  }
  return [...terms];
}

/** Score content by capped term frequency plus a breadth bonus for distinct hits. */
export function scoreText(content: string, terms: string[]): number {
  if (terms.length === 0) return 0;
  const lower = content.toLowerCase();
  let score = 0;
  let distinct = 0;

  for (const term of terms) {
    let count = 0;
    let idx = lower.indexOf(term);
    while (idx !== -1) {
      count++;
      if (count >= 50) break;
      idx = lower.indexOf(term, idx + term.length);
    }
    if (count > 0) {
      distinct++;
      score += count;
    }
  }
  return score + distinct * 5;
}

/** Return a window of lines centered on the densest term match. */
export function extractSnippet(content: string, terms: string[], maxLines = 40): string {
  const lines = content.split(/\r?\n/);
  if (lines.length <= maxLines) return content;

  const lowerLines = lines.map((l) => l.toLowerCase());
  let bestLine = 0;
  let bestScore = -1;
  for (let i = 0; i < lowerLines.length; i++) {
    let s = 0;
    for (const term of terms) {
      if (lowerLines[i].includes(term)) s++;
    }
    if (s > bestScore) {
      bestScore = s;
      bestLine = i;
    }
  }

  const start = Math.max(0, bestLine - Math.floor(maxLines / 4));
  const end = Math.min(lines.length, start + maxLines);
  return lines.slice(start, end).join('\n');
}
