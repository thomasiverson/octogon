import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownProps {
  content: string;
}

/**
 * Render model output as Markdown. react-markdown builds a React element tree
 * (no innerHTML) and escapes raw HTML by default, so it's safe under the webview
 * CSP and against injection in untrusted model output.
 */
export function Markdown({ content }: MarkdownProps) {
  return (
    <div className="markdown-body text-xs">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
