// The agent's tool surface. Tool *definitions* and argument *parsing* are pure
// and unit-tested; execution is sandbox-scoped and guards every path and
// command. write_file and run_command are the dangerous tools — both are
// confined to the sandbox and run_command is additionally gated by a caller
// consent callback.

import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CancellationToken } from 'vscode';
import { isUnsafePath, normalizePath } from '../scoring/codeBlocks';
import { runCommand } from './sandbox';

const MAX_READ_CHARS = 50_000;
const MAX_LIST_FILES = 400;
const MAX_TOOL_LOG = 12_000;

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ToolName = 'list_files' | 'read_file' | 'write_file' | 'run_command' | 'finish';

export const AGENT_TOOLS: ToolSchema[] = [
  {
    name: 'list_files',
    description: 'List files in the sandbox working tree. Optionally restrict to a subdirectory.',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Relative subdirectory to list (optional).' }
      }
    }
  },
  {
    name: 'read_file',
    description: 'Read the UTF-8 contents of a file in the sandbox.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative file path.' } },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file in the sandbox with the given contents.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path.' },
        content: { type: 'string', description: 'Full new file contents.' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'run_command',
    description:
      'Run a shell command in the sandbox (e.g. build or tests). Subject to user approval and a time limit.',
    inputSchema: {
      type: 'object',
      properties: { command: { type: 'string', description: 'The shell command to run.' } },
      required: ['command']
    }
  },
  {
    name: 'finish',
    description: 'Signal that the task is complete. Optionally summarize what changed.',
    inputSchema: {
      type: 'object',
      properties: { summary: { type: 'string', description: 'Short summary of the changes made.' } }
    }
  }
];

// ---------------------------------------------------------------------------
// Pure argument parsing / validation
// ---------------------------------------------------------------------------

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function asRecord(input: unknown): Record<string, unknown> | null {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : null;
}

/**
 * Some models assume the sandbox is mounted at an absolute `/workspace` root
 * and prefix every path with it (e.g. `/workspace/api/src/x.ts`). Accept that
 * alias by rewriting it to a sandbox-relative path. Only the absolute,
 * leading-slash form is stripped, so a legitimate relative `workspace/` folder
 * is left untouched. Traversal protection still applies afterwards.
 */
export function stripSandboxAlias(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/workspace(?:\/|$)/i, '');
}

/** Validate a relative, in-sandbox path argument. */
export function parsePathArg(input: unknown, field = 'path'): ParseResult<string> {
  const rec = asRecord(input);
  if (!rec) return { ok: false, error: 'expected an object argument' };
  const raw = rec[field];
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: `missing required "${field}"` };
  }
  const value = stripSandboxAlias(raw);
  if (isUnsafePath(value)) {
    return { ok: false, error: `unsafe path "${raw}" (must be relative and inside the sandbox)` };
  }
  return { ok: true, value: normalizePath(value) };
}

export function parseWriteArgs(input: unknown): ParseResult<{ path: string; content: string }> {
  const pathResult = parsePathArg(input, 'path');
  if (!pathResult.ok) return pathResult;
  const rec = asRecord(input)!;
  const content = rec.content;
  if (typeof content !== 'string') {
    return { ok: false, error: 'missing required "content" (string)' };
  }
  return { ok: true, value: { path: pathResult.value, content } };
}

export function parseCommandArg(input: unknown): ParseResult<string> {
  const rec = asRecord(input);
  if (!rec) return { ok: false, error: 'expected an object argument' };
  const command = rec.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { ok: false, error: 'missing required "command"' };
  }
  return { ok: true, value: command.trim() };
}

export function parseListArgs(input: unknown): ParseResult<{ dir: string }> {
  const rec = asRecord(input);
  if (!rec || rec.dir === undefined || rec.dir === null || rec.dir === '') {
    return { ok: true, value: { dir: '' } };
  }
  if (typeof rec.dir !== 'string') return { ok: false, error: '"dir" must be a string' };
  const dir = stripSandboxAlias(rec.dir);
  if (isUnsafePath(dir)) return { ok: false, error: `unsafe path "${rec.dir}"` };
  return { ok: true, value: { dir: normalizePath(dir) } };
}

/** True when `rel` resolves to a location inside `dir`. */
export function isInsideSandbox(dir: string, rel: string): boolean {
  const root = path.resolve(dir);
  const resolved = path.resolve(dir, rel);
  return resolved === root || resolved.startsWith(root + path.sep);
}

// ---------------------------------------------------------------------------
// Execution (sandbox-scoped, guarded)
// ---------------------------------------------------------------------------

export interface ToolContext {
  /** Absolute sandbox directory. */
  dir: string;
  /** Per-command timeout for run_command. */
  commandTimeoutMs: number;
  token?: CancellationToken;
  /** Consent gate for run_command; return false to deny. Defaults to deny. */
  allowCommand?: (command: string) => boolean | Promise<boolean>;
}

export interface ToolResult {
  ok: boolean;
  content: string;
  /** Set by write_file with the relative path that changed. */
  wrotePath?: string;
  /** Set by finish. */
  finished?: boolean;
}

const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'media', '.vscode-test']);

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (rel: string): Promise<void> => {
    if (out.length >= MAX_LIST_FILES) return;
    const abs = path.join(dir, rel);
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= MAX_LIST_FILES) return;
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(childRel);
      } else if (entry.isFile()) {
        out.push(childRel);
      }
    }
  };
  await walk('');
  return out;
}

/** Execute a single tool call against the sandbox. Never throws. */
export async function executeTool(
  name: string,
  input: unknown,
  ctx: ToolContext
): Promise<ToolResult> {
  switch (name) {
    case 'list_files': {
      const parsed = parseListArgs(input);
      if (!parsed.ok) return { ok: false, content: parsed.error };
      const base = path.join(ctx.dir, parsed.value.dir);
      if (!isInsideSandbox(ctx.dir, parsed.value.dir)) {
        return { ok: false, content: 'path escapes the sandbox' };
      }
      const files = await listFiles(base);
      const prefix = parsed.value.dir ? `${parsed.value.dir}/` : '';
      const listed = files.map((f) => prefix + f);
      const note = listed.length >= MAX_LIST_FILES ? `\n… (truncated at ${MAX_LIST_FILES})` : '';
      return { ok: true, content: (listed.join('\n') || '(empty)') + note };
    }

    case 'read_file': {
      const parsed = parsePathArg(input);
      if (!parsed.ok) return { ok: false, content: parsed.error };
      if (!isInsideSandbox(ctx.dir, parsed.value)) {
        return { ok: false, content: 'path escapes the sandbox' };
      }
      const abs = path.join(ctx.dir, parsed.value);
      try {
        const text = await fs.readFile(abs, 'utf8');
        const clipped = text.length > MAX_READ_CHARS;
        return {
          ok: true,
          content: clipped ? text.slice(0, MAX_READ_CHARS) + '\n… (truncated)' : text
        };
      } catch (err) {
        return { ok: false, content: `cannot read "${parsed.value}": ${String(err)}` };
      }
    }

    case 'write_file': {
      const parsed = parseWriteArgs(input);
      if (!parsed.ok) return { ok: false, content: parsed.error };
      if (!isInsideSandbox(ctx.dir, parsed.value.path)) {
        return { ok: false, content: 'path escapes the sandbox' };
      }
      const abs = path.join(ctx.dir, parsed.value.path);
      try {
        const existed = existsSync(abs);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, parsed.value.content, 'utf8');
        const verb = existed ? 'updated' : 'created';
        return { ok: true, content: `${verb} ${parsed.value.path}`, wrotePath: parsed.value.path };
      } catch (err) {
        return { ok: false, content: `cannot write "${parsed.value.path}": ${String(err)}` };
      }
    }

    case 'run_command': {
      const parsed = parseCommandArg(input);
      if (!parsed.ok) return { ok: false, content: parsed.error };
      const allowed = ctx.allowCommand ? await ctx.allowCommand(parsed.value) : false;
      if (!allowed) {
        return { ok: false, content: `command not approved: ${parsed.value}` };
      }
      const { exitCode, log } = await runCommand(
        parsed.value,
        ctx.dir,
        ctx.commandTimeoutMs,
        ctx.token
      );
      const clipped = log.length > MAX_TOOL_LOG ? log.slice(-MAX_TOOL_LOG) : log;
      return { ok: exitCode === 0, content: `exit ${exitCode}\n${clipped}` };
    }

    case 'finish': {
      const rec = asRecord(input);
      const summary = rec && typeof rec.summary === 'string' ? rec.summary : '';
      return { ok: true, content: summary || 'done', finished: true };
    }

    default:
      return { ok: false, content: `unknown tool "${name}"` };
  }
}
