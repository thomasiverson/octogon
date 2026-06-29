import { describe, it, expect } from 'vitest';
import { extractCodeBlocks, inferTargets, isUnsafePath, normalizePath } from '../src/scoring/codeBlocks';

describe('extractCodeBlocks', () => {
  it('extracts a fenced block with a language', () => {
    const blocks = extractCodeBlocks('Here:\n```ts\nconst x = 1;\n```\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].lang).toBe('ts');
    expect(blocks[0].code).toBe('const x = 1;');
  });

  it('reads a path from the fence info-string', () => {
    const blocks = extractCodeBlocks('```ts src/models/product.ts\nexport const p = 1;\n```');
    expect(blocks[0].path).toBe('src/models/product.ts');
  });

  it('reads a path from a preceding filepath comment', () => {
    const blocks = extractCodeBlocks('// filepath: src/a.ts\n```ts\nconst a = 1;\n```');
    expect(blocks[0].path).toBe('src/a.ts');
  });

  it('reads a path from a preceding bold filename', () => {
    const blocks = extractCodeBlocks('**src/b.ts**\n```ts\nconst b = 1;\n```');
    expect(blocks[0].path).toBe('src/b.ts');
  });

  it('extracts multiple blocks', () => {
    const blocks = extractCodeBlocks('```js\na\n```\ntext\n```py\nb\n```');
    expect(blocks).toHaveLength(2);
    expect(blocks[1].lang).toBe('py');
  });
});

describe('inferTargets', () => {
  it('uses explicit paths when present', () => {
    const targets = inferTargets([
      { lang: 'ts', path: 'src/a.ts', code: 'a' },
      { lang: 'ts', code: 'b' }
    ]);
    expect(targets).toEqual([{ path: 'src/a.ts', code: 'a' }]);
  });

  it('falls back to the active file with the largest block', () => {
    const targets = inferTargets(
      [
        { lang: 'ts', code: 'short' },
        { lang: 'ts', code: 'a much longer block of code here' }
      ],
      'src/active.ts'
    );
    expect(targets).toEqual([{ path: 'src/active.ts', code: 'a much longer block of code here' }]);
  });

  it('returns nothing when there is no path and no active file', () => {
    expect(inferTargets([{ lang: 'ts', code: 'x' }])).toEqual([]);
  });
});

describe('path safety', () => {
  it('normalizes separators and leading markers', () => {
    expect(normalizePath('.\\src\\a.ts')).toBe('src/a.ts');
    expect(normalizePath('/etc/passwd')).toBe('etc/passwd');
  });

  it('flags traversal and absolute paths as unsafe', () => {
    expect(isUnsafePath('../outside.ts')).toBe(true);
    expect(isUnsafePath('/etc/passwd')).toBe(true);
    expect(isUnsafePath('C:/Windows/x')).toBe(true);
    expect(isUnsafePath('src/ok.ts')).toBe(false);
  });
});
