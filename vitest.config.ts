import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node'
  },
  resolve: {
    alias: {
      // Extension code imports the host-provided 'vscode' module; map it to a
      // lightweight mock so activation can be smoke-tested under Vitest.
      vscode: fileURLToPath(new URL('./test/mocks/vscode.ts', import.meta.url))
    }
  }
});
