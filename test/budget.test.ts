import { describe, it, expect } from 'vitest';
import { assembleContext, type ContextPiece, type CountModel } from '../src/context/assemble';

// Fake model: 1 token per whitespace-separated word.
function fakeModel(maxInputTokens: number): CountModel {
  return {
    maxInputTokens,
    countTokens: (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0)
  };
}

function piece(path: string, words: number): ContextPiece {
  return {
    ref: { path, source: 'attached', tokens: 0 },
    header: `// ${path}`,
    body: Array.from({ length: words }, (_, i) => `w${i}`).join(' ')
  };
}

describe('assembleContext budgeting', () => {
  it('returns empty for no pieces', async () => {
    const built = await assembleContext([], fakeModel(100), 'prompt', 10);
    expect(built.block).toBe('');
    expect(built.info.refs).toHaveLength(0);
  });

  it('includes everything that fits and reports tokens', async () => {
    const built = await assembleContext(
      [piece('a.ts', 3), piece('b.ts', 4)],
      fakeModel(100),
      'one two three',
      10
    );
    expect(built.info.trimmed).toBe(false);
    expect(built.info.refs).toHaveLength(2);
    // budget = 100 - 3 (prompt) - 10 (reserve) = 87
    expect(built.info.budget).toBe(87);
    expect(built.info.totalTokens).toBeLessThanOrEqual(built.info.budget);
    expect(built.block).toContain('# Repository context');
  });

  it('marks trimmed when a piece does not fit and the remainder is tiny', async () => {
    const built = await assembleContext([piece('big.ts', 30)], fakeModel(20), 'x', 5);
    expect(built.info.trimmed).toBe(true);
    expect(built.info.totalTokens).toBeLessThanOrEqual(built.info.budget);
  });

  it('partially includes a too-large trailing piece when room remains', async () => {
    const built = await assembleContext(
      [piece('first.ts', 100), piece('second.ts', 300)],
      fakeModel(260),
      'x',
      5
    );
    expect(built.info.trimmed).toBe(true);
    expect(built.info.refs.length).toBe(2);
    expect(built.info.totalTokens).toBeLessThanOrEqual(built.info.budget);
  });
});
