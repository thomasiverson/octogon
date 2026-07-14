// Minimal stand-in for the host-provided `vscode` module so the extension's
// activation wiring can be exercised under Vitest. Only the surface used by
// src/extension.ts is implemented; everything else is intentionally absent.
import { vi } from 'vitest';

export const commands = {
  registerCommand: vi.fn((_id: string, _cb: (...args: unknown[]) => unknown) => ({
    dispose: vi.fn()
  }))
};

export const window = {
  registerTreeDataProvider: vi.fn(() => ({ dispose: vi.fn() })),
  showInformationMessage: vi.fn(() => Promise.resolve(undefined))
};

// Language Model API surface used by ModelRegistry. Tests set the resolved
// value per case; the default returns an empty roster.
export const lm = {
  selectChatModels: vi.fn(async (_opts?: unknown): Promise<unknown[]> => [])
};

export class TreeItem {
  constructor(public label: string = '') {}
}
