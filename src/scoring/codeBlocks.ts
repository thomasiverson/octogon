// Pure helpers for extracting code from model output and inferring a target
// file. No 'vscode' dependency so they stay unit-testable.

export interface CodeBlock {
  lang?: string;
  /** Path hint from the fence info-string or a preceding filepath comment. */
  path?: string;
  code: string;
}

export interface VerifyTarget {
  path: string;
  code: string;
}

function looksLikePath(token: string): boolean {
  return token.includes('/') || token.includes('\\') || /\.[a-z0-9]+$/i.test(token);
}

/** Detect a "filepath: x", "File: x", `x.ts`, or **x.ts** hint on a line. */
function pathFromHint(line: string): string | undefined {
  const labelled = line.match(/(?:file ?path|filename|file|path)\s*[:=]\s*([^\s*`'"]+)/i);
  if (labelled && looksLikePath(labelled[1])) return labelled[1];
  const backtick = line.match(/`([^`]+\.[A-Za-z0-9]+)`/);
  if (backtick) return backtick[1];
  const bold = line.match(/\*\*([^*]+\.[A-Za-z0-9]+)\*\*/);
  if (bold) return bold[1];
  return undefined;
}

/** Extract fenced code blocks with optional language and file-path hints. */
export function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const fence = /```([^\n]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(text)) !== null) {
    const info = match[1].trim();
    const code = match[2].replace(/\n$/, '');

    let lang: string | undefined;
    let path: string | undefined;

    if (info) {
      const parts = info.split(/\s+/);
      if (looksLikePath(parts[0]) && parts.length === 1) {
        path = parts[0];
      } else {
        lang = parts[0] || undefined;
        const rest = parts.slice(1).find(looksLikePath);
        if (rest) path = rest;
      }
    }

    if (!path) {
      // Look at the last non-empty line before the fence for a path hint.
      const before = text.slice(0, match.index).split(/\r?\n/);
      for (let i = before.length - 1; i >= 0 && i >= before.length - 3; i--) {
        const line = before[i].trim();
        if (!line) continue;
        const hint = pathFromHint(line);
        if (hint) {
          path = hint;
          break;
        }
      }
    }

    blocks.push({ lang, path, code });
  }

  return blocks;
}

/**
 * Infer which files to write. Blocks with explicit paths are used directly;
 * otherwise the largest block is written to the active file (when known).
 */
export function inferTargets(blocks: CodeBlock[], activeFileRel?: string): VerifyTarget[] {
  const withPath = blocks.filter((b) => b.path);
  if (withPath.length > 0) {
    return withPath.map((b) => ({ path: normalizePath(b.path!), code: b.code }));
  }
  if (activeFileRel && blocks.length > 0) {
    const largest = blocks.reduce((a, b) => (b.code.length > a.code.length ? b : a));
    return [{ path: normalizePath(activeFileRel), code: largest.code }];
  }
  return [];
}

/** Normalize and reject path-traversal so writes stay inside the sandbox. */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

/** True when a relative path would escape the sandbox root. */
export function isUnsafePath(p: string): boolean {
  const norm = normalizePath(p);
  return norm.split('/').includes('..') || /^[a-zA-Z]:/.test(p) || p.startsWith('/');
}
