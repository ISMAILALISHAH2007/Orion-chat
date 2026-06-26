export function parseMarkdown(text: string): string {
  if (!text) return '';

  let result = text
    // Escape HTML first (prevent XSS)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

    // Code blocks (before inline code)
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px 16px;overflow-x:auto;font-size:0.85rem;margin:8px 0;"><code>${code.trim()}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, `<code style="background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:2px 6px;font-size:0.85em;">$1</code>`)
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3 style="font-size:1rem;margin-top:12px;margin-bottom:4px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:1.1rem;margin-top:14px;margin-bottom:6px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:1.25rem;margin-top:16px;margin-bottom:8px;">$1</h1>')
    // Unordered lists
    .replace(/^[\*\-] (.+)$/gm, '<li style="margin-left:16px;list-style:disc;">$1</li>')
    // Ordered lists (basic)
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;list-style:decimal;">$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:12px 0;">')
    // Newlines
    .replace(/\n/g, '<br />');

  return result;
}
