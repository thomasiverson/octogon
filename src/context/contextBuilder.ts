import * as vscode from 'vscode';
import { ContextPiece } from './assemble';

export { assembleContext, ContextPiece, BuiltContext, CountModel } from './assemble';

/** Active editor document + non-empty selection, selection prioritized first. */
export async function collectActivePieces(): Promise<ContextPiece[]> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== 'file') {
    return [];
  }
  const doc = editor.document;
  const rel = vscode.workspace.asRelativePath(doc.uri);
  const pieces: ContextPiece[] = [];

  const sel = editor.selection;
  if (sel && !sel.isEmpty) {
    pieces.push({
      ref: { path: `${rel} (selection)`, source: 'selection', tokens: 0 },
      header: `// Active selection — ${rel} (lines ${sel.start.line + 1}-${sel.end.line + 1})`,
      body: doc.getText(sel)
    });
  }

  pieces.push({
    ref: { path: rel, source: 'active', tokens: 0 },
    header: `// Active file — ${rel}`,
    body: doc.getText()
  });
  return pieces;
}

/** Read manually attached files (absolute paths). Unreadable files are skipped. */
export async function collectAttachedPieces(paths: string[]): Promise<ContextPiece[]> {
  const pieces: ContextPiece[] = [];
  for (const p of paths) {
    try {
      const uri = vscode.Uri.file(p);
      const bytes = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(bytes).toString('utf8');
      const rel = vscode.workspace.asRelativePath(uri);
      pieces.push({
        ref: { path: rel, source: 'attached', tokens: 0 },
        header: `// Attached file — ${rel}`,
        body: text
      });
    } catch {
      // Skip files we cannot read.
    }
  }
  return pieces;
}
