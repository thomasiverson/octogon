import { describe, it, expect } from 'vitest';
import { extractTerms, scoreText, extractSnippet } from '../src/context/ranking';

describe('extractTerms', () => {
  it('keeps identifiers, drops stopwords and short tokens', () => {
    const terms = extractTerms('Add a discount field to the Product model');
    expect(terms).toContain('discount');
    expect(terms).toContain('field');
    expect(terms).toContain('product');
    expect(terms).toContain('model');
    expect(terms).not.toContain('add'); // stopword
    expect(terms).not.toContain('the'); // stopword
    expect(terms).not.toContain('to'); // too short
  });

  it('returns nothing for a query with only stopwords', () => {
    expect(extractTerms('please add the new code')).toEqual([]);
  });

  it('deduplicates case-insensitively', () => {
    expect(extractTerms('Discount discount DISCOUNT').length).toBe(1);
  });
});

describe('scoreText', () => {
  const terms = ['discount', 'product'];

  it('scores higher when more distinct terms match', () => {
    const both = scoreText('discount on a product line', terms);
    const one = scoreText('discount discount discount', terms);
    expect(both).toBeGreaterThan(one);
  });

  it('returns zero when nothing matches', () => {
    expect(scoreText('completely unrelated text', terms)).toBe(0);
  });
});

describe('extractSnippet', () => {
  it('returns whole content when short', () => {
    const content = 'line1\nline2\nline3';
    expect(extractSnippet(content, ['line2'])).toBe(content);
  });

  it('windows around the densest match in long content', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `filler ${i}`);
    lines[120] = 'the discount product lives here';
    const snippet = extractSnippet(lines.join('\n'), ['discount', 'product'], 40);
    expect(snippet).toContain('discount product');
    expect(snippet.split('\n').length).toBeLessThanOrEqual(40);
  });
});
