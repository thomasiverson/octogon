import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CancellationToken } from 'vscode';
import { extractCodeBlocks, inferTargets, isUnsafePath } from './codeBlocks';

export interface VerifyOptions {
  workspaceRoot: string;
  verifyCommand: string;
  output: string;
  activeFileRel?: string;
  timeoutMs: number;
}

export interface VerifyOutcome {
  passed: boolean;
  exitCode: number | null;
  log: string;
  appliedFiles: string[];
}

const MAX_LOG = 20_000;

function runCommand(
  cmd: string,
  cwd: string,
  timeoutMs: number,
  token?: CancellationToken
): Promise<{ exitCode: number | null; log: string }> {
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
      log += '\n[octogon] verification timed out.';
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

async function makeScratch(root: string): Promise<{ dir: string; tmp: string; isWorktree: boolean }> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'octogon-verify-'));
  const dir = path.join(tmp, 'repo');

  if (existsSync(path.join(root, '.git'))) {
    const res = await runCommand(`git worktree add --detach "${dir}" HEAD`, root, 60_000);
    if (res.exitCode === 0 && existsSync(dir)) {
      return { dir, tmp, isWorktree: true };
    }
  }
  // Fallback: copy the workspace (without heavy/generated dirs).
  await copyDir(root, dir, new Set(['node_modules', '.git', 'dist', 'out', 'media', '.vscode-test']));
  return { dir, tmp, isWorktree: false };
}

async function linkNodeModules(root: string, scratch: string): Promise<void> {
  const src = path.join(root, 'node_modules');
  const dest = path.join(scratch, 'node_modules');
  if (!existsSync(src) || existsSync(dest)) return;
  try {
    await fs.symlink(src, dest, process.platform === 'win32' ? 'junction' : 'dir');
  } catch {
    // Non-fatal: tests needing deps may fail, which is reported as such.
  }
}

async function cleanup(root: string, dir: string, tmp: string, isWorktree: boolean): Promise<void> {
  if (isWorktree) {
    try {
      await runCommand(`git worktree remove --force "${dir}"`, root, 30_000);
    } catch {
      // best effort
    }
  }
  try {
    await fs.rm(tmp, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

/**
 * Apply a model's code blocks to an isolated sandbox copy of the workspace and
 * run the user-configured verify command there. The command itself comes from
 * config (never from model output); model output only writes files in the
 * sandbox. Experimental and best-effort.
 */
export async function verifyResponse(
  opts: VerifyOptions,
  token?: CancellationToken
): Promise<VerifyOutcome> {
  const { dir, tmp, isWorktree } = await makeScratch(opts.workspaceRoot);
  try {
    const targets = inferTargets(extractCodeBlocks(opts.output), opts.activeFileRel).filter(
      (t) => !isUnsafePath(t.path)
    );

    const applied: string[] = [];
    for (const target of targets) {
      const dest = path.join(dir, target.path);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, target.code, 'utf8');
      applied.push(target.path);
    }

    await linkNodeModules(opts.workspaceRoot, dir);

    const { exitCode, log } = await runCommand(opts.verifyCommand, dir, opts.timeoutMs, token);
    const header =
      applied.length > 0
        ? `[octogon] applied: ${applied.join(', ')}\n`
        : '[octogon] no code blocks applied (ran command against unmodified sandbox)\n';
    return { passed: exitCode === 0, exitCode, log: header + log, appliedFiles: applied };
  } finally {
    await cleanup(opts.workspaceRoot, dir, tmp, isWorktree);
  }
}
