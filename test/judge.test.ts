import { describe, it, expect } from 'vitest';
import { buildJudgePrompt, parseJudgeResponse } from '../src/scoring/judge';
import { highestRated, clampRating } from '../src/scoring/manual';
import type { ModelResult } from '../src/shared/types';

const ids = ['model-a', 'model-b'];

function makeResult(modelId: string, over: Partial<ModelResult> = {}): ModelResult {
  return {
    modelId,
    output: 'out',
    tokens: { input: 1, output: 1 },
    latencyMs: 100,
    timeToFirstTokenMs: 10,
    ...over
  };
}

describe('buildJudgePrompt', () => {
  it('includes the task, all responses, and a JSON instruction', () => {
    const prompt = buildJudgePrompt({
      prompt: 'Do the thing',
      responses: [
        { modelId: 'model-a', name: 'A', output: 'answer a' },
        { modelId: 'model-b', name: 'B', output: 'answer b' }
      ]
    });
    expect(prompt).toContain('Do the thing');
    expect(prompt).toContain('modelId: model-a');
    expect(prompt).toContain('modelId: model-b');
    expect(prompt).toContain('JSON array');
    expect(prompt).toContain('(none provided)');
  });

  it('embeds a reference answer when provided', () => {
    const prompt = buildJudgePrompt({
      prompt: 'task',
      referenceAnswer: 'the gold answer',
      responses: [{ modelId: 'model-a', name: 'A', output: 'x' }]
    });
    expect(prompt).toContain('the gold answer');
  });
});

describe('parseJudgeResponse', () => {
  it('parses a clean JSON array', () => {
    const text = '[{"modelId":"model-a","score":8,"rationale":"good"},{"modelId":"model-b","score":5,"rationale":"ok"}]';
    const scores = parseJudgeResponse(text, ids);
    expect(scores).toHaveLength(2);
    expect(scores[0]).toMatchObject({ modelId: 'model-a', score: 8, rationale: 'good' });
    expect(scores[1].score).toBe(5);
  });

  it('strips code fences and surrounding prose', () => {
    const text = 'Here are my scores:\n```json\n[{"modelId":"model-a","score":9,"rationale":"great"}]\n```\nThanks!';
    const scores = parseJudgeResponse(text, ['model-a']);
    expect(scores[0]).toMatchObject({ modelId: 'model-a', score: 9 });
  });

  it('handles an object wrapper like {scores:[...]}', () => {
    const text = '{"scores":[{"modelId":"model-a","score":7,"rationale":"fine"}]}';
    const scores = parseJudgeResponse(text, ['model-a']);
    expect(scores[0].score).toBe(7);
  });

  it('clamps out-of-range scores', () => {
    const text = '[{"modelId":"model-a","score":99,"rationale":"x"},{"modelId":"model-b","score":-3,"rationale":"y"}]';
    const scores = parseJudgeResponse(text, ids);
    expect(scores[0].score).toBe(10);
    expect(scores[1].score).toBe(1);
  });

  it('falls back to unscored for unparseable output', () => {
    const scores = parseJudgeResponse('the judge had opinions but no json', ids);
    expect(scores).toHaveLength(2);
    expect(scores.every((s) => s.score === 0)).toBe(true);
    expect(scores[0].rationale).toMatch(/could not be parsed/i);
  });

  it('fills missing models with an unscored entry', () => {
    const text = '[{"modelId":"model-a","score":6,"rationale":"ok"}]';
    const scores = parseJudgeResponse(text, ids);
    expect(scores.find((s) => s.modelId === 'model-b')?.score).toBe(0);
  });
});

describe('manual rating', () => {
  it('clamps ratings to 1–5 and passes through null', () => {
    expect(clampRating(7)).toBe(5);
    expect(clampRating(0)).toBe(1);
    expect(clampRating(3)).toBe(3);
    expect(clampRating(null)).toBeNull();
  });

  it('prefers manual rating over judge for highest-rated', () => {
    const results = [
      makeResult('model-a', { manualRating: 4, judge: { modelId: 'model-a', score: 5, rationale: '' } }),
      makeResult('model-b', { manualRating: 2, judge: { modelId: 'model-b', score: 10, rationale: '' } })
    ];
    expect(highestRated(results)?.modelId).toBe('model-a');
  });

  it('falls back to judge score when no manual ratings', () => {
    const results = [
      makeResult('model-a', { judge: { modelId: 'model-a', score: 6, rationale: '' } }),
      makeResult('model-b', { judge: { modelId: 'model-b', score: 9, rationale: '' } })
    ];
    expect(highestRated(results)?.modelId).toBe('model-b');
  });

  it('returns undefined when nothing is rated or judged', () => {
    expect(highestRated([makeResult('model-a')])).toBeUndefined();
  });
});
