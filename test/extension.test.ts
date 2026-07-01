import { describe, it, expect, beforeEach, vi } from 'vitest';
import { commands, window } from './mocks/vscode';

// Replace the heavy panel/controller graphs so activation can be tested in
// isolation. vi.hoisted keeps the spies available inside the hoisted factories.
const { createOrShow, controllerCtor } = vi.hoisted(() => ({
  createOrShow: vi.fn(() => ({
    reveal: vi.fn(),
    onDidDispose: vi.fn(() => ({ dispose: vi.fn() }))
  })),
  controllerCtor: vi.fn(() => ({ dispose: vi.fn(), clearHistory: vi.fn() }))
}));

vi.mock('../src/webview/panel', () => ({ ComparePanel: { createOrShow } }));
vi.mock('../src/controller', () => ({ OctogonController: controllerCtor }));

// eslint-disable-next-line import/first
import { activate, deactivate } from '../src/extension';

function fakeContext(): any {
  return { subscriptions: [] as Array<{ dispose(): void }>, extensionUri: { fsPath: '/ext' } };
}

describe('extension activation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers both commands and the launch view', () => {
    const ctx = fakeContext();
    activate(ctx);

    const ids = commands.registerCommand.mock.calls.map((c) => c[0]);
    expect(ids).toContain('octogon.open');
    expect(ids).toContain('octogon.clearHistory');
    expect(window.registerTreeDataProvider).toHaveBeenCalledWith('octogon.launch', expect.anything());
    expect(ctx.subscriptions.length).toBe(5);
  });

  it('the octogon.open command opens the panel and creates the controller', () => {
    const ctx = fakeContext();
    activate(ctx);

    const open = commands.registerCommand.mock.calls.find((c) => c[0] === 'octogon.open');
    (open?.[1] as () => void)();

    expect(createOrShow).toHaveBeenCalled();
    expect(controllerCtor).toHaveBeenCalled();
  });

  it('deactivate is a no-op that does not throw', () => {
    expect(() => deactivate()).not.toThrow();
  });
});
