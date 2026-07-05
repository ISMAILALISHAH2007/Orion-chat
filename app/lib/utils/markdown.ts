export function parseMarkdown(text: string): string {
  if (!text) return '';

  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  let result = escape(text)
    // Strip internal voice commands
    .replace(/\[VOICE:\s*[^\]]+\]/gi, '')
    // Web Search UI
    .replace(/\[SEARCH:\s*(?:"|')?([^"\]]+)(?:"|')?\]/gi, '<div class="flex items-center gap-2 text-accent my-2 animate-pulse bg-accent/10 w-max px-3 py-1.5 rounded-lg border border-accent/20"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg><span class="text-xs font-medium tracking-wide">Web Searching: $1...</span></div>')
    // Maps Search UI
    .replace(/\[MAPS:\s*(?:"|')?([^"\]]+)(?:"|')?\]/gi, '<div class="flex items-center gap-2 text-accent my-2 animate-pulse bg-accent/10 w-max px-3 py-1.5 rounded-lg border border-accent/20"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-bounce"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg><span class="text-xs font-medium tracking-wide">Locating: $1...</span></div>')
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
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<div class="relative flex items-center justify-center min-h-[200px] w-full max-w-sm rounded-lg bg-surface-2 overflow-hidden my-3"><div class="absolute inset-0 flex items-center justify-center image-loader"><span class="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin"></span></div><img src="$2" alt="$1" class="generated-image z-10 w-full h-auto" onload="this.previousSibling.style.display=\'none\'; this.style.opacity=1" style="opacity: 0; transition: opacity 0.5s" /></div>')
    // Links (ignore preceding !)
    .replace(/(^|[^!])\[([^\]]+)\]\(([^) ]+)(?: "([^"]+)")?\)/g, (match, prefix, text, url, title) => {
      if (title) {
        return `${prefix}<a href="${url}" download="${title}" target="_blank" class="download-button" rel="noopener noreferrer">${text}</a>`;
      }
      return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    })
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
