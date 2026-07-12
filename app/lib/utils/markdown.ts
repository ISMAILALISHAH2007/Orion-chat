import { PREVIEW_LANGUAGES } from './preview';

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
    // Generating Image UI
    .replace(/\[GENERATING_IMAGE:\s*(.*?)\]/gi, '<div class="relative flex items-center justify-center min-h-[200px] w-full max-w-sm rounded-lg bg-surface-2 overflow-hidden my-3 border border-accent/20"><div class="absolute inset-0 flex items-center justify-center"><div class="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin"></div></div><div class="absolute bottom-4 text-xs font-medium text-accent animate-pulse tracking-wide text-center w-full">Creating Image...</div></div>')
    // Generating Video UI
    .replace(/\[GENERATING_VIDEO:\s*(.*?)\]/gi, '<div class="relative flex items-center justify-center min-h-[200px] w-full max-w-sm rounded-lg bg-black/80 overflow-hidden my-3 border border-accent/30 shadow-lg"><div class="absolute inset-0 flex items-center justify-center"><div class="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin"></div></div><div class="absolute bottom-4 text-xs font-bold text-accent animate-pulse tracking-widest text-center w-full uppercase">Rendering Video...</div></div>')
    // Fenced code blocks -> styled block with header + copy + preview buttons
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, (_m, lang, code) => {
      const language = (lang || 'text').toLowerCase();
      const clean = code.replace(/\n$/, '');
      const escaped = clean
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      return (
        `<div class="code-block">` +
        `<div class="code-block-header">` +
        `<span class="code-lang">${language}</span>` +
        `<div class="flex items-center gap-1.5">` +
        (PREVIEW_LANGUAGES.includes(language) 
          ? `<button type="button" class="code-preview" data-lang="${language}" data-code="${escaped}" aria-label="Preview code" title="Run in preview">▶ Preview</button>`
          : '') +
        `<button type="button" class="code-copy" aria-label="Copy code">Copy</button>` +
        `</div>` +
        `</div>` +
        `<pre><code>${clean}</code></pre>` +
        `</div>`
      );
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<div class="relative flex items-center justify-center min-h-[200px] w-full max-w-sm rounded-lg bg-surface-2 overflow-hidden my-3"><div class="absolute inset-0 flex items-center justify-center image-loader"><span class="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin"></span></div><img src="$2" alt="$1" class="generated-image z-10 w-full h-auto" onload="this.previousSibling.style.display=\'none\'; this.style.opacity=1" style="opacity: 0; transition: opacity 0.5s" /></div>')
    // Images with error handling
    .replace(/\[IMAGE:\s*([^\]]+)\]/gi, '<div class="relative flex items-center justify-center min-h-[200px] w-full max-w-sm rounded-lg bg-surface-2 overflow-hidden my-3 shadow-lg"><div class="absolute inset-0 flex items-center justify-center image-loader"><span class="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin"></span></div><img src="$1" alt="Generated Image" class="generated-image z-10 w-full h-auto cursor-pointer" onload="this.previousSibling.style.display=\'none\'; this.style.opacity=1" onerror="this.previousSibling.innerHTML=\'<span class=\\\'text-xs text-red-400\\\'>Image unavailable</span>\'; this.style.display=\'none\'" style="opacity: 0; transition: opacity 0.5s" /></div>')
    // Videos with error handling
    .replace(/\[VIDEO:\s*([^\]]+)\]/gi, '<div class="relative flex items-center justify-center min-h-[200px] w-full max-w-sm rounded-lg bg-black overflow-hidden my-3 group shadow-xl"><div class="absolute inset-0 flex items-center justify-center image-loader" id="vloader-${Date.now()}"><span class="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin"></span></div><video src="$1" class="generated-video z-10 w-full h-auto" controls autoplay loop playsinline onloadeddata="this.previousSibling.style.display=\'none\'; this.style.opacity=1" onerror="this.previousSibling.innerHTML=\'<span class=\\\'text-xs text-red-400\\\'>Video unavailable</span>\'; this.style.display=\'none\'" style="opacity: 0; transition: opacity 0.5s"></video><div class="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-md text-[10px] font-bold text-white/90 rounded border border-white/10 z-20 pointer-events-none tracking-widest uppercase transition-opacity">✨ ULTRON AI</div></div>')
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
