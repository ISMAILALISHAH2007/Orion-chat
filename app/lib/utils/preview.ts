/**
 * Shared code preview template generators.
 * Used by both MessageBubble.tsx (client-side document.write) and code-preview/route.ts (server-side).
 */

// Escape </script> and </style> to prevent premature tag closure in inline templates
export function escapeScriptTags(code: string): string {
  return code
    .replace(/<\/script>/gi, '<\\/script>')
    .replace(/<\/style>/gi, '<\\/style>');
}

export function generatePreviewHtml(code: string, lang: string): string {
  const decoded = escapeScriptTags(code);
  const language = lang.toLowerCase();
  const title = `ULTRON Code Preview — ${language}`;

  if (['html', 'jsx', 'tsx'].includes(language)) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif}*{box-sizing:border-box}</style></head><body>${decoded}</body></html>`;
  }

  if (['javascript', 'js'].includes(language)) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#1a1a2e;color:#e0e0e0;padding:20px}#output{background:#16213e;border-radius:12px;padding:16px;margin-top:16px;border:1px solid #2a2a4a;white-space:pre-wrap;font-family:monospace;font-size:13px;line-height:1.6}.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.badge{background:#4f46e5;color:#fff;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600}.run-btn{background:#22c55e;color:#fff;border:none;padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:.2s}.run-btn:hover{background:#16a34a}</style></head><body><div class="header"><span class="badge">JavaScript Runner</span><button class="run-btn" onclick="runCode()">▶ Run</button></div><div id="output">Waiting...</div><script>const originalLog=console.log;const output=document.getElementById('output');const logs=[];console.log=function(...args){logs.push(args.map(a=>typeof a==='object'?JSON.stringify(a,null,2):String(a)).join(' '));output.textContent=logs.join('\\n')};console.error=function(...args){logs.push('❌ '+args.map(a=>String(a)).join(' '));output.textContent=logs.join('\\n')};function runCode(){logs.length=0;output.textContent='Running...';try{${decoded}}catch(e){logs.push('❌ Error: '+e.message);output.textContent=logs.join('\\n')}}runCode();</script></body></html>`;
  }

  if (['css', 'svg'].includes(language)) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.preview-box{background:#fff;border-radius:16px;padding:40px;max-width:800px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)}${decoded}</style></head><body><div class="preview-box"><div style="text-align:center;color:#64748b;font-size:14px">CSS Preview</div><div style="margin-top:20px;padding:20px;border:2px dashed #e2e8f0;border-radius:12px;text-align:center;color:#334155"><h1 style="margin:0 0 8px">Hello, ULTRON!</h1><p>Your CSS styles applied above</p><button style="padding:10px 24px;border:none;border-radius:8px;font-weight:600;cursor:pointer;background:#4f46e5;color:#fff">Styled Button</button></div></div></body></html>`;
  }

  // Fallback: show formatted code (TypeScript, TSX, or other)
  const displayCode = decoded.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f172a;color:#e2e8f0;padding:20px}.badge{display:inline-block;background:#3178c6;color:#fff;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;margin-bottom:12px}pre{background:#1e293b;border-radius:12px;padding:20px;overflow-x:auto;font-family:monospace;font-size:13px;line-height:1.6}</style></head><body><span class="badge">${language}</span><pre>${displayCode}</pre></body></html>`;
}

// Language categories for preview button visibility
export const PREVIEW_LANGUAGES = ['html', 'javascript', 'js', 'typescript', 'ts', 'css', 'svg', 'jsx', 'tsx'];
