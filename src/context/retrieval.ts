import * as vscode from 'vscode';
import { ContextPiece } from './contextBuilder';
import { extractTerms, scoreText, extractSnippet } from './ranking';

const INCLUDE_GLOB =
  '**/*.{ts,tsx,js,jsx,mjs,cjs,py,java,go,rb,rs,c,cc,cpp,h,hpp,cs,php,kt,swift,scala,md,json,yaml,yml,toml,txt,sql,sh}';

// Common heavy/generated directories. findFiles' default excludes do not cover
// node_modules, so exclude explicitly to keep the scan lightweight.
const EXCLUDE_GLOB =
  '**/{node_modules,.git,dist,out,build,coverage,.vscode-test,.next,.nuxt,vendor,bin,obj,target,__pycache__,.venv,venv,media}/**';

const MAX_FILES = 500;
const MAX_FILE_BYTES = 512 * 1024;

/**
 * Lightweight keyword retrieval across the open workspace. Returns the top-K
 * scored snippets. Pure ranking lives in ranking.ts; this layer only does I/O.
 */
export async function retrieve(
  prompt: string,
  topK: number,
  token?: vscode.CancellationToken
): Promise<ContextPiece[]> {
  if (topK <= 0) return [];
  const terms = extractTerms(prompt);
  if (terms.length === 0) return [];

  const files = await vscode.workspace.findFiles(INCLUDE_GLOB, EXCLUDE_GLOB, MAX_FILES);
  const scored: { uri: vscode.Uri; content: string; score: number }[] = [];

  for (const uri of files) {
    if (token?.isCancellationRequested) break;
    let content: string;
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.byteLength > MAX_FILE_BYTES) continue;
      content = Buffer.from(bytes).toString('utf8');
    } catch {
      continue;
    }
    const score = scoreText(content, terms);
    if (score > 0) {
      scored.push({ uri, content, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map(({ uri, content }) => {
    const rel = vscode.workspace.asRelativePath(uri);
    const snippet = extractSnippet(content, terms);
    return {
      ref: {
        path: rel,
        source: 'retrieval' as const,
        tokens: 0,
        preview: snippet.slice(0, 160).replace(/\s+/g, ' ').trim()
      },
      header: `// Retrieved snippet — ${rel}`,
      body: snippet
    };
  });
}
