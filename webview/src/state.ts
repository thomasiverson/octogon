import type { JudgeScore, ModelResult, VerifyResult } from '../../src/shared/types';

export type ColumnStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface ColumnState {
  modelId: string;
  status: ColumnStatus;
  text: string;
  result?: ModelResult;
  error?: { message: string; code?: string };
}

export type Columns = Record<string, ColumnState>;

export type RunAction =
  | { type: 'start'; modelIds: string[] }
  | { type: 'modelStart'; modelId: string }
  | { type: 'fragment'; modelId: string; text: string }
  | { type: 'modelDone'; modelId: string; result: ModelResult }
  | { type: 'modelError'; modelId: string; message: string; code?: string }
  | { type: 'setResult'; modelId: string; result: ModelResult }
  | { type: 'rate'; modelId: string; rating: number | null }
  | { type: 'judge'; scores: JudgeScore[] }
  | { type: 'verify'; modelId: string; result: VerifyResult }
  | { type: 'load'; columns: Columns }
  | { type: 'reset' };

function ensure(state: Columns, modelId: string, fallback: ColumnStatus): ColumnState {
  return state[modelId] ?? { modelId, status: fallback, text: '' };
}

export function runReducer(state: Columns, action: RunAction): Columns {
  switch (action.type) {
    case 'reset':
      return {};
    case 'load':
      return action.columns;
    case 'start': {
      const next: Columns = {};
      for (const id of action.modelIds) {
        next[id] = { modelId: id, status: 'idle', text: '' };
      }
      return next;
    }
    case 'modelStart': {
      const col = ensure(state, action.modelId, 'idle');
      return { ...state, [action.modelId]: { ...col, status: 'streaming' } };
    }
    case 'fragment': {
      const col = ensure(state, action.modelId, 'streaming');
      return {
        ...state,
        [action.modelId]: { ...col, status: 'streaming', text: col.text + action.text }
      };
    }
    case 'modelDone': {
      const col = ensure(state, action.modelId, 'streaming');
      return {
        ...state,
        [action.modelId]: {
          ...col,
          status: action.result.error ? 'error' : 'done',
          result: action.result,
          text: action.result.output || col.text,
          error: action.result.error
        }
      };
    }
    case 'setResult': {
      const col = ensure(state, action.modelId, 'done');
      return { ...state, [action.modelId]: { ...col, result: action.result } };
    }
    case 'rate': {
      const col = state[action.modelId];
      if (!col?.result) return state;
      return {
        ...state,
        [action.modelId]: { ...col, result: { ...col.result, manualRating: action.rating } }
      };
    }
    case 'judge': {
      const next: Columns = { ...state };
      for (const score of action.scores) {
        const col = next[score.modelId];
        if (col?.result) {
          next[score.modelId] = { ...col, result: { ...col.result, judge: score } };
        }
      }
      return next;
    }
    case 'verify': {
      const col = state[action.modelId];
      if (!col?.result) return state;
      return {
        ...state,
        [action.modelId]: { ...col, result: { ...col.result, verify: action.result } }
      };
    }
    case 'modelError': {
      const col = ensure(state, action.modelId, 'streaming');
      return {
        ...state,
        [action.modelId]: {
          ...col,
          status: 'error',
          error: { message: action.message, code: action.code }
        }
      };
    }
    default:
      return state;
  }
}
