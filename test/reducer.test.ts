import { describe, it, expect } from 'vitest';
import { runReducer, type Columns } from '../webview/src/state';
import type { ModelResult } from '../src/shared/types';

function result(modelId: string, over: Partial<ModelResult> = {}): ModelResult {
  return {
    modelId,
    output: 'done',
    tokens: { input: 10, output: 5 },
    latencyMs: 100,
    timeToFirstTokenMs: 10,
    ...over
  };
}

describe('runReducer (webview state / message protocol)', () => {
  it('initializes idle columns on start', () => {
    const state = runReducer({}, { type: 'start', modelIds: ['a', 'b'] });
    expect(Object.keys(state)).toEqual(['a', 'b']);
    expect(state.a.status).toBe('idle');
  });

  it('appends fragments and marks streaming', () => {
    let state: Columns = runReducer({}, { type: 'start', modelIds: ['a'] });
    state = runReducer(state, { type: 'fragment', modelId: 'a', text: 'Hel' });
    state = runReducer(state, { type: 'fragment', modelId: 'a', text: 'lo' });
    expect(state.a.text).toBe('Hello');
    expect(state.a.status).toBe('streaming');
  });

  it('stores results on modelDone', () => {
    let state: Columns = runReducer({}, { type: 'start', modelIds: ['a'] });
    state = runReducer(state, { type: 'modelDone', modelId: 'a', result: result('a') });
    expect(state.a.status).toBe('done');
    expect(state.a.result?.output).toBe('done');
  });

  it('captures errors on modelError', () => {
    let state: Columns = runReducer({}, { type: 'start', modelIds: ['a'] });
    state = runReducer(state, { type: 'modelError', modelId: 'a', message: 'boom', code: 'off_topic' });
    expect(state.a.status).toBe('error');
    expect(state.a.error).toEqual({ message: 'boom', code: 'off_topic' });
  });

  it('applies rating, judge, and verify only to columns with results', () => {
    let state: Columns = runReducer({}, { type: 'start', modelIds: ['a'] });
    state = runReducer(state, { type: 'rate', modelId: 'a', rating: 4 });
    expect(state.a.result).toBeUndefined(); // no result yet → ignored

    state = runReducer(state, { type: 'modelDone', modelId: 'a', result: result('a') });
    state = runReducer(state, { type: 'rate', modelId: 'a', rating: 4 });
    expect(state.a.result?.manualRating).toBe(4);

    state = runReducer(state, {
      type: 'judge',
      scores: [{ modelId: 'a', score: 9, rationale: 'great' }]
    });
    expect(state.a.result?.judge?.score).toBe(9);

    state = runReducer(state, {
      type: 'verify',
      modelId: 'a',
      result: { modelId: 'a', passed: true, exitCode: 0, command: 'npm test', log: 'ok' }
    });
    expect(state.a.result?.verify?.passed).toBe(true);
  });

  it('loads and resets columns', () => {
    const loaded: Columns = { a: { modelId: 'a', status: 'done', text: 'x', result: result('a') } };
    let state = runReducer({}, { type: 'load', columns: loaded });
    expect(state.a.text).toBe('x');
    state = runReducer(state, { type: 'reset' });
    expect(state).toEqual({});
  });
});
