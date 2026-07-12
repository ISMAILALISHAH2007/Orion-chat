import { NextResponse } from 'next/server';

/**
 * Free AI Web Search — Resilient multi-source fallback
 * Uses DuckDuckGo (primary) + fallback sources.
 * No API keys required.
 */

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function formatResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No search results found for your query. Please try rephrasing it.';
  }
  return results.map((r, i) =>
    `[Result ${i + 1}]\nTitle: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`
  ).join('\n\n---\n\n');
}

function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timeout));
}

// === SOURCE 1: DuckDuckGo HTML (most reliable, no API key) ===
async function searchDuckDuckGoHTML(query: string): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) return [];
    const html = await res.text();
    const results: SearchResult[] = [];

    // DuckDuckGo HTML results — parse <a class="result__a"> with fallback patterns
    const resultBlocks = html.split('<article class="result ');
    for (let i = 1; i < resultBlocks.length && i <= 8; i++) {
      const block = resultBlocks[i];
      if (!block) continue;

      // Title
      const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      // URL  
      const urlMatch = block.match(/class="result__a"[^>]*href="([^"]+)"/);
      // Snippet
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      // Alternative snippet
      const altSnippet = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/span>/);

      if (titleMatch && urlMatch) {
        const title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
        let resultUrl = urlMatch[1];
        if (!resultUrl.startsWith('http')) {
          resultUrl = `https://duckduckgo.com${resultUrl}`;
        }
        const snippet = snippetMatch
          ? snippetMatch[1].replace(/<[^>]*>/g, '').trim()
          : altSnippet
            ? altSnippet[1].replace(/<[^>]*>/g, '').trim()
            : '';
        if (title && resultUrl) {
          results.push({ title, url: resultUrl, snippet });
        }
      }
    }

    return results;
  } catch (err) {
    console.warn('[Search] DuckDuckGo HTML failed:', err instanceof Error ? err.message : 'Unknown');
    return [];
  }
}

// === SOURCE 2: DuckDuckGo Instant Answer API (quick facts) ===
async function searchDuckDuckGoInstant(query: string): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  try {
    const res = await fetchWithTimeout(url, 5000);
    if (!res.ok) return [];
    const data = await res.json();
    const results: SearchResult[] = [];

    if (data.AbstractText) {
      results.push({ title: data.Heading || 'Summary', url: data.AbstractURL || 'https://duckduckgo.com', snippet: data.AbstractText });
    }
    if (data.Answer && data.AnswerType) {
      results.push({ title: data.Heading || 'Answer', url: data.AbstractURL || 'https://duckduckgo.com', snippet: data.Answer });
    }
    if (data.RelatedTopics) {
      for (const topic of (data.RelatedTopics || []).slice(0, 8)) {
        if (topic.Text && topic.FirstURL) {
          results.push({ title: topic.Text.split(' - ')[0], url: topic.FirstURL, snippet: topic.Text });
        }
        if (topic.Topics) {
          for (const sub of topic.Topics.slice(0, 3)) {
            if (sub.Text && sub.FirstURL) {
              results.push({ title: sub.Text.split(' - ')[0], url: sub.FirstURL, snippet: sub.Text });
            }
          }
        }
      }
    }
    return results;
  } catch (err) {
    console.warn('[Search] DuckDuckGo Instant failed:', err instanceof Error ? err.message : 'Unknown');
    return [];
  }
}

// === SOURCE 3: DuckDuckGo Lite API (lightweight fallback) ===
async function searchDuckDuckGoLite(query: string): Promise<SearchResult[]> {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) return [];
    const html = await res.text();
    const results: SearchResult[] = [];

    // Parse DDG Lite results — simpler HTML structure
    const rows = html.split('<tr class="result">');
    for (let i = 1; i < rows.length && i <= 8; i++) {
      const row = rows[i];
      if (!row) continue;

      const linkMatch = row.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = row.match(/<td class="result-snippet">([\s\S]*?)<\/td>/);

      if (linkMatch) {
        const url = linkMatch[1];
        const title = linkMatch[2].replace(/<[^>]*>/g, '').trim();
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
        if (title && url) {
          results.push({ title, url, snippet });
        }
      }
    }
    return results;
  } catch (err) {
    console.warn('[Search] DuckDuckGo Lite failed:', err instanceof Error ? err.message : 'Unknown');
    return [];
  }
}

export async function performSearch(query: string): Promise<string> {
  if (!query || query.trim().length === 0) {
    return 'Please provide a search query.';
  }

  const trimmedQuery = query.trim();

  try {
    // Try all sources in parallel with individual timeouts
    const [ddgResults, instantResults, liteResults] = await Promise.all([
      searchDuckDuckGoHTML(trimmedQuery),
      searchDuckDuckGoInstant(trimmedQuery),
      searchDuckDuckGoLite(trimmedQuery),
    ]);

    // Merge: prefer HTML (richest), fallback to Instant, then Lite
    let bestResults: SearchResult[];

    if (ddgResults.length >= 3) {
      bestResults = ddgResults.slice(0, 8);
    } else if (instantResults.length > 0) {
      bestResults = instantResults;
    } else if (liteResults.length > 0) {
      bestResults = liteResults;
    } else {
      // Last resort: combine whatever we got
      const combined = [...ddgResults, ...instantResults, ...liteResults];
      if (combined.length > 0) {
        bestResults = combined;
      } else {
        return `I couldn't find current web results for "${trimmedQuery}". Please try a different search query or ask me from my existing knowledge.`;
      }
    }

    return formatResults(bestResults);
  } catch (err) {
    // Global catch — never crash
    console.error('[Search] Unexpected error:', err);
    return `I couldn't find current web results for "${trimmedQuery}". Please try a different search query or ask me from my existing knowledge.`;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const results = await performSearch(query || '');
  return NextResponse.json({ results });
}
