import { JudgeScore } from '../shared/types';

export interface JudgeResponseItem {
  modelId: string;
  name: string;
  output: string;
}

export interface JudgeInput {
  prompt: string;
  referenceAnswer?: string;
  responses: JudgeResponseItem[];
}

/**
 * Build a single batched judge prompt that ranks ALL responses in one call
 * (fewer tokens/credits than one call per response). The judge must return a
 * JSON array keyed by the exact modelId values.
 */
export function buildJudgePrompt(input: JudgeInput): string {
  const reference = input.referenceAnswer?.trim()
    ? input.referenceAnswer.trim()
    : '(none provided)';

  const responseBlocks = input.responses
    .map(
      (r) =>
        `## modelId: ${r.modelId}  (${r.name})\n${r.output.trim() || '(empty response)'}`
    )
    .join('\n\n');

  return [
    'You are an impartial evaluator comparing AI model responses to a user task.',
    '',
    '# Task',
    input.prompt.trim(),
    '',
    '# Reference answer',
    reference,
    '',
    '# Responses',
    responseBlocks,
    '',
    '# Instructions',
    'Score each response from 1 (poor) to 10 (excellent) considering correctness, completeness, and clarity.',
    'If a reference answer is provided (not "(none provided)"), judge primarily by alignment with it.',
    'Return ONLY a JSON array — no prose, no markdown, no code fences — in exactly this shape:',
    '[{"modelId":"<id>","score":<integer 1-10>,"rationale":"<one or two sentences>"}]',
    'Include exactly one object per response, using the exact modelId values shown above.'
  ].join('\n');
}

function clampScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(10, Math.round(n)));
}

/** Pull the most plausible JSON array out of a possibly-noisy judge response. */
function extractJsonArray(text: string): unknown[] | undefined {
  let cleaned = text.trim();
  // Strip code fences if present.
  cleaned = cleaned.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

  // Try a direct parse first.
  const tryParse = (s: string): unknown[] | undefined => {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') {
        for (const key of ['scores', 'results', 'evaluations', 'ratings']) {
          const v = (parsed as Record<string, unknown>)[key];
          if (Array.isArray(v)) return v;
        }
      }
    } catch {
      // fall through
    }
    return undefined;
  };

  const direct = tryParse(cleaned);
  if (direct) return direct;

  // Otherwise grab the substring between the first '[' and the last ']'.
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start !== -1 && end > start) {
    return tryParse(cleaned.slice(start, end + 1));
  }
  return undefined;
}

/**
 * Parse a judge response into one JudgeScore per modelId. Robust to code fences
 * and stray prose. Unscored models get score 0 with an explanatory rationale so
 * the UI can show "unscored" rather than failing.
 */
export function parseJudgeResponse(text: string, modelIds: string[]): JudgeScore[] {
  const items = extractJsonArray(text);
  const byId = new Map<string, JudgeScore>();

  if (items) {
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const obj = raw as Record<string, unknown>;
      const id = typeof obj.modelId === 'string' ? obj.modelId : undefined;
      if (!id || !modelIds.includes(id)) continue;
      byId.set(id, {
        modelId: id,
        score: clampScore(obj.score),
        rationale: typeof obj.rationale === 'string' ? obj.rationale : ''
      });
    }
  }

  return modelIds.map(
    (id) =>
      byId.get(id) ?? {
        modelId: id,
        score: 0,
        rationale: items ? 'No score returned for this model.' : 'Judge output could not be parsed.'
      }
  );
}
