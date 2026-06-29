const path = require('node:path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'src/**/*.{ts,tsx}')
  ],
  theme: {
    extend: {
      colors: {
        // Map to VS Code theme variables so the UI follows the active theme.
        vscode: {
          bg: 'var(--vscode-editor-background)',
          fg: 'var(--vscode-editor-foreground)',
          'panel-bg': 'var(--vscode-panel-background)',
          border: 'var(--vscode-panel-border, var(--vscode-editorWidget-border))',
          'input-bg': 'var(--vscode-input-background)',
          'input-fg': 'var(--vscode-input-foreground)',
          'input-border': 'var(--vscode-input-border, var(--vscode-contrastBorder))',
          'btn-bg': 'var(--vscode-button-background)',
          'btn-fg': 'var(--vscode-button-foreground)',
          'btn-hover': 'var(--vscode-button-hoverBackground)',
          'btn-sec-bg': 'var(--vscode-button-secondaryBackground)',
          'btn-sec-fg': 'var(--vscode-button-secondaryForeground)',
          badge: 'var(--vscode-badge-background)',
          'badge-fg': 'var(--vscode-badge-foreground)',
          desc: 'var(--vscode-descriptionForeground)',
          link: 'var(--vscode-textLink-foreground)',
          error: 'var(--vscode-errorForeground)',
          'list-hover': 'var(--vscode-list-hoverBackground)',
          'list-active': 'var(--vscode-list-activeSelectionBackground)'
        }
      }
    }
  },
  plugins: []
};
