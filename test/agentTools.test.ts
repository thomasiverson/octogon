import { describe, it, expect } from 'vitest';
import {
  AGENT_TOOLS,
  isInsideSandbox,
  parseCommandArg,
  parseListArgs,
  parsePathArg,
  parseWriteArgs
} from '../src/agent/tools';
import { summarizeNumstat } from '../src/agent/sandbox';

describe('parsePathArg', () => {
  it('accepts and normalizes a relative path', () => {
    expect(parsePathArg({ path: 'src/a.ts' })).toEqual({ ok: true, value: 'src/a.ts' });
    expect(parsePathArg({ path: 'src\\a.ts' })).toEqual({ ok: true, value: 'src/a.ts' });
    expect(parsePathArg({ path: './src/a.ts' })).toEqual({ ok: true, value: 'src/a.ts' });
  });

  it('rejects traversal and absolute paths', () => {
    expect(parsePathArg({ path: '../etc/passwd' }).ok).toBe(false);
    expect(parsePathArg({ path: '/etc/passwd' }).ok).toBe(false);
    expect(parsePathArg({ path: 'C:\\Windows' }).ok).toBe(false);
  });

  it('accepts the /workspace sandbox-root alias models often assume', () => {
    expect(parsePathArg({ path: '/workspace/api/src/x.ts' })).toEqual({
      ok: true,
      value: 'api/src/x.ts'
    });
    expect(parsePathArg({ path: '/workspace/index.ts' })).toEqual({
      ok: true,
      value: 'index.ts'
    });
    // Traversal is still blocked even with the alias prefix.
    expect(parsePathArg({ path: '/workspace/../etc/passwd' }).ok).toBe(false);
  });

  it('rejects missing or empty input', () => {
    expect(parsePathArg({}).ok).toBe(false);
    expect(parsePathArg({ path: '' }).ok).toBe(false);
    expect(parsePathArg(null).ok).toBe(false);
  });
});

describe('parseWriteArgs', () => {
  it('requires both path and content', () => {
    expect(parseWriteArgs({ path: 'a.ts', content: 'x' })).toEqual({
      ok: true,
      value: { path: 'a.ts', content: 'x' }
    });
    expect(parseWriteArgs({ path: 'a.ts' }).ok).toBe(false);
    expect(parseWriteArgs({ content: 'x' }).ok).toBe(false);
  });

  it('allows empty-string content', () => {
    expect(parseWriteArgs({ path: 'a.ts', content: '' }).ok).toBe(true);
  });

  it('rejects unsafe paths', () => {
    expect(parseWriteArgs({ path: '../a.ts', content: 'x' }).ok).toBe(false);
  });
});

describe('parseCommandArg', () => {
  it('accepts a non-empty command', () => {
    expect(parseCommandArg({ command: ' npm test ' })).toEqual({ ok: true, value: 'npm test' });
  });
  it('rejects empty/missing/non-string', () => {
    expect(parseCommandArg({ command: '   ' }).ok).toBe(false);
    expect(parseCommandArg({}).ok).toBe(false);
    expect(parseCommandArg({ command: 3 }).ok).toBe(false);
  });
});

describe('parseListArgs', () => {
  it('defaults to the sandbox root when dir is absent', () => {
    expect(parseListArgs({})).toEqual({ ok: true, value: { dir: '' } });
    expect(parseListArgs(null)).toEqual({ ok: true, value: { dir: '' } });
  });
  it('accepts a safe subdirectory and rejects traversal', () => {
    expect(parseListArgs({ dir: 'src' })).toEqual({ ok: true, value: { dir: 'src' } });
    expect(parseListArgs({ dir: '../x' }).ok).toBe(false);
    expect(parseListArgs({ dir: '/workspace/api/src' })).toEqual({
      ok: true,
      value: { dir: 'api/src' }
    });
  });
});

describe('isInsideSandbox', () => {
  it('is true for descendants and false for escapes', () => {
    const root = process.cwd();
    expect(isInsideSandbox(root, 'a/b.ts')).toBe(true);
    expect(isInsideSandbox(root, '.')).toBe(true);
    expect(isInsideSandbox(root, '../outside')).toBe(false);
  });
});

describe('AGENT_TOOLS', () => {
  it('defines the five expected tools with schemas', () => {
    const names = AGENT_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(['finish', 'list_files', 'read_file', 'run_command', 'write_file']);
    for (const tool of AGENT_TOOLS) {
      expect(typeof tool.description).toBe('string');
      expect(tool.inputSchema).toHaveProperty('type', 'object');
    }
  });
});

describe('summarizeNumstat', () => {
  it('sums additions/deletions and counts files', () => {
    const out = summarizeNumstat('3\t1\tsrc/a.ts\n0\t2\tb.ts');
    expect(out.filesChanged).toBe(2);
    expect(out.additions).toBe(3);
    expect(out.deletions).toBe(3);
  });

  it('treats binary (-/-) entries as zero line changes', () => {
    const out = summarizeNumstat('-\t-\timg.png\n5\t0\tc.ts');
    expect(out.filesChanged).toBe(2);
    expect(out.additions).toBe(5);
    expect(out.files[0]).toMatchObject({ path: 'img.png', binary: true, additions: 0 });
  });

  it('ignores blank and malformed lines', () => {
    expect(summarizeNumstat('\n\ngarbage\n').filesChanged).toBe(0);
  });
});
