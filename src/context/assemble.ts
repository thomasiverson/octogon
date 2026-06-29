import { ContextInfo, ContextRef } from '../shared/types';

/** A single candidate block of context, before token budgeting. */
export interface ContextPiece {
  ref: ContextRef;
  /** A short header line identifying the source, e.g. "// Active file — src/x.ts". */
  header: string;
  body: string;
}

export interface BuiltContext {
  block: string;
  info: ContextInfo;
}

/** Minimal model surface needed for budgeting (kept vscode-free for testing). */
export interface CountModel {
  countTokens(text: string): Thenable<number> | number;
  maxInputTokens: number;
}

const EMPTY_INFO: ContextInfo = { refs: [], totalTokens: 0, trimmed: false, budget: 0 };

/** Binary-ish shrink of text until it fits within maxTokens for the given model. */
async function trimToTokens(model: CountModel, text: string, maxTokens: number): Promise<string> {
  if (maxTokens <= 0) return '';
  // Proportional first guess (~4 chars/token), then shrink until it fits.
  let result = text.slice(0, Math.min(text.length, maxTokens * 4));
  while (result.length > 0 && (await model.countTokens(result)) > maxTokens) {
    result = result.slice(0, Math.floor(result.length * 0.8));
  }
  return result;
}

/**
 * Assemble context pieces into one block, token-budgeted to fit the given model.
 * The model passed should be the SMALLEST selected model's window so the same
 * context is fair (fits) for every model in the run.
 */
export async function assembleContext(
  pieces: ContextPiece[],
  model: CountModel,
  prompt: string,
  reserveTokens: number
): Promise<BuiltContext> {
  if (pieces.length === 0) {
    return { block: '', info: { ...EMPTY_INFO } };
  }

  const promptTokens = await model.countTokens(prompt);
  const budget = Math.max(0, model.maxInputTokens - promptTokens - reserveTokens);

  const parts: string[] = [];
  const refs: ContextRef[] = [];
  let used = 0;
  let trimmed = false;

  for (const piece of pieces) {
    const text = `${piece.header}\n${piece.body}`;
    const tokens = await model.countTokens(text);

    if (used + tokens <= budget) {
      parts.push(text);
      refs.push({ ...piece.ref, tokens });
      used += tokens;
      continue;
    }

    // Doesn't fit whole — try to include a trimmed prefix, then stop.
    const remaining = budget - used;
    if (remaining > 64) {
      const head = await trimToTokens(model, text, remaining - 16);
      if (head.length > 0) {
        const withMarker = `${head}\n// …trimmed to fit token budget…`;
        const t = await model.countTokens(withMarker);
        parts.push(withMarker);
        refs.push({ ...piece.ref, tokens: t });
        used += t;
      }
    }
    trimmed = true;
    break;
  }

  const block = parts.length > 0 ? `# Repository context\n\n${parts.join('\n\n')}` : '';
  return { block, info: { refs, totalTokens: used, trimmed, budget } };
}
