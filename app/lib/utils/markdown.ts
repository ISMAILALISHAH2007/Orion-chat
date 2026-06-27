export function parseMarkdown(text: string): string {
  if (!text) return '';

  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  let result = escape(text)
    // Fenced code blocks -> styled block with header + copy button
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, (_m, lang, code) => {
      const language = (lang || 'text').toLowerCase();
      const clean = code.replace(/\n$/, '');
      return (
        `<div class="code-block">` +
        `<div class="code-block-header">` +
        `<span class="code-lang">${language}</span>` +
        `<button type="button" class="code-copy" aria-label="Copy code">Copy</button>` +
        `</div>` +
        `<pre><code>${clean}</code></pre>` +
        `</div>`
      );
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Bold / italic
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Lists
    .replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr />');

  // Collapse newlines, but not inside code blocks/pre
  const parts = result.split(/(<pre>[\s\S]*?<\/pre>)/g);
  result = parts
    .map((part) => (part.startsWith('<pre>') ? part : part.replace(/\n/g, '<br />')))
    .join('');

  return result;
}
