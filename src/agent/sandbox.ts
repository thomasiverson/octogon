// Isolated sandbox lifecycle shared by verification (Phase 6) and the agent
// loop (Phase 8). A sandbox is a throwaway copy of the workspace — a detached
// git worktree when possible, otherwise a filtered directory copy — so model
// edits and commands never touch the real working tree.
//
// Runtime-safe: only imports `vscode` as a type (elided at compile), so the
// pure helpers here remain unit-testable without the extension host.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CancellationToken } from 'vscode';

export const MAX_LOG = 20_000;

const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'media', '.vscode-test']);

export interface CommandResult {
  exitCode: number | null;
  log: string;
}

/** Run a shell command in `cwd`, capturing combined stdout/stderr (capped). */
export function runCommand(
  cmd: string,
  cwd: string,
  timeoutMs: number,
  token?: CancellationToken
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd, shell: true });
    let log = '';
    const capture = (data: Buffer) => {
      log += data.toString();
      if (log.length > MAX_LOG) log = log.slice(-MAX_LOG);
    };
    child.stdout?.on('data', capture);
    child.stderr?.on('data', capture);

    const timer = setTimeout(() => {
      child.kill();
      log += '\n[octogon] command timed out.';
    }, timeoutMs);
    const sub = token?.onCancellationRequested(() => child.kill());

    child.on('close', (code) => {
      clearTimeout(timer);
      sub?.dispose();
      resolve({ exitCode: code, log });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      sub?.dispose();
      resolve({ exitCode: null, log: `${log}\n[octogon] ${String(err)}` });
    });
  });
}

async function copyDir(src: string, dest: string, exclude: Set<string>): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d, exclude);
    } else if (entry.isFile()) {
      await fs.copyFile(s, d);
    }
  }
}

export interface Sandbox {
  /** Absolute path to the sandbox repo directory. */
  dir: string;
  /** Temp root that must be removed on dispose. */
  tmp: string;
  /** True when backed by a git worktree (enables diffs). */
  isWorktree: boolean;
}

/** Create an isolated sandbox copy of the workspace at HEAD. */
export async function createSandbox(root: string): Promise<Sandbox> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'octogon-sandbox-'));
  const dir = path.join(tmp, 'repo');

  if (existsSync(path.join(root, '.git'))) {
    const res = await runCommand(`git worktree add --detach "${dir}" HEAD`, root, 60_000);
    if (res.exitCode === 0 && existsSync(dir)) {
      return { dir, tmp, isWorktree: true };
    }
  }
  // Fallback: copy the workspace (without heavy/generated dirs).
  await copyDir(root, dir, EXCLUDE_DIRS);
  return { dir, tmp, isWorktree: false };
}

/** Link the workspace's node_modules into the sandbox (best effort). */
export async function linkNodeModules(root: string, sandbox: Sandbox): Promise<void> {
  const src = path.join(root, 'node_modules');
  const dest = path.join(sandbox.dir, 'node_modules');
  if (!existsSync(src) || existsSync(dest)) return;
  try {
    await fs.symlink(src, dest, process.platform === 'win32' ? 'junction' : 'dir');
  } catch {
    // Non-fatal: tests needing deps may fail, which is reported as such.
  }
}

/** Remove the sandbox worktree (if any) and its temp directory. */
export async function disposeSandbox(root: string, sandbox: Sandbox): Promise<void> {
  if (sandbox.isWorktree) {
    try {
      await runCommand(`git worktree remove --force "${sandbox.dir}"`, root, 30_000);
    } catch {
      // best effort
    }
  }
  try {
    await fs.rm(sandbox.tmp, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

/** Full unified diff of all changes in the sandbox (worktree-backed only). */
export async function gitDiff(sandbox: Sandbox): Promise<string> {
  if (!sandbox.isWorktree) return '';
  const res = await runCommand('git add -A && git diff --cached', sandbox.dir, 30_000);
  return res.log;
}

/** `git diff --numstat` of all changes in the sandbox (worktree-backed only). */
export async function gitNumstat(sandbox: Sandbox): Promise<string> {
  if (!sandbox.isWorktree) return '';
  const res = await runCommand('git add -A && git diff --cached --numstat', sandbox.dir, 30_000);
  return res.exitCode === 0 ? res.log : '';
}

export interface DiffFile {
  path: string;
  additions: number;
  deletions: number;
  binary: boolean;
}

export interface DiffSummary {
  filesChanged: number;
  additions: number;
  deletions: number;
  files: DiffFile[];
}

/** Parse `git diff --numstat` output into a structured summary (pure). */
export function summarizeNumstat(numstat: string): DiffSummary {
  const files: DiffFile[] = [];
  let additions = 0;
  let deletions = 0;

  for (const raw of numstat.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!m) continue;
    const binary = m[1] === '-' || m[2] === '-';
    const add = binary ? 0 : parseInt(m[1], 10);
    const del = binary ? 0 : parseInt(m[2], 10);
    additions += add;
    deletions += del;
    files.push({ path: m[3], additions: add, deletions: del, binary });
  }

  return { filesChanged: files.length, additions, deletions, files };
}
