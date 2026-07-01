import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CancellationToken } from 'vscode';
import { extractCodeBlocks, inferTargets, isUnsafePath } from './codeBlocks';
import { createSandbox, disposeSandbox, linkNodeModules, runCommand } from '../agent/sandbox';

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
  const sandbox = await createSandbox(opts.workspaceRoot);
  try {
    const targets = inferTargets(extractCodeBlocks(opts.output), opts.activeFileRel).filter(
      (t) => !isUnsafePath(t.path)
    );

    const applied: string[] = [];
    for (const target of targets) {
      const dest = path.join(sandbox.dir, target.path);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, target.code, 'utf8');
      applied.push(target.path);
    }

    await linkNodeModules(opts.workspaceRoot, sandbox);

    const { exitCode, log } = await runCommand(opts.verifyCommand, sandbox.dir, opts.timeoutMs, token);
    const header =
      applied.length > 0
        ? `[octogon] applied: ${applied.join(', ')}\n`
        : '[octogon] no code blocks applied (ran command against unmodified sandbox)\n';
    return { passed: exitCode === 0, exitCode, log: header + log, appliedFiles: applied };
  } finally {
    await disposeSandbox(opts.workspaceRoot, sandbox);
  }
}
