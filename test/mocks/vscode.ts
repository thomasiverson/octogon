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

export class TreeItem {
  constructor(public label: string = '') {}
}
