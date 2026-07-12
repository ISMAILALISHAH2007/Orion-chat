import { NextResponse } from 'next/server';

/**
 * Free AI Web Search
 * Uses googlethis (Google scraping, no API key needed) + fallback sources.
 * No Paid APIs required.
 */
import { search } from 'googlethis';

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

// === SOURCE 1 (PRIMARY): googlethis — free Google scraping, no API key ===
async function searchGoogleThis(query: string): Promise<SearchResult[]> {
  try {
    const res = await search(query, {
      page: 0,
      safe: false,
      additional_params: {
        hl: 'en',
        num: 8,
      },
    });

    if (!res.results || res.results.length === 0) return [];

    return res.results.slice(0, 8).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.description || '',
    }));
  } catch (err) {
    console.warn('[Search] googlethis failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

// === SOURCE 2: DuckDuckGo HTML (stable HTML scraping, no key needed) ===
async function searchDuckDuckGoHTML(query: string): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ULTRON/1.0)',
        'Accept': 'text/html',
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];

    const html = await res.text();
    const results: SearchResult[] = [];

    // DuckDuckGo HTML results are in <a class="result__a"> tags
    const resultBlocks = html.split('<article class="result ">');
    for (let i = 1; i < resultBlocks.length && i <= 8; i++) {
      const block = resultBlocks[i];
      
      const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const urlMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>/);
      const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      
      if (titleMatch && urlMatch) {
        const title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
        const resultUrl = urlMatch[1].startsWith('http') ? urlMatch[1] : `https://duckduckgo.com${urlMatch[1]}`;
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
        
        if (title && resultUrl) {
          results.push({ title, url: resultUrl, snippet });
        }
      }
    }

    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// === SOURCE 3: DuckDuckGo Instant Answer API (quick facts) ===
async function searchDuckDuckGoInstant(query: string): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ULTRON/1.0' },
      signal: controller.signal,
    });
    if (!res.ok) return [];

    const data = await res.json();
    const results: SearchResult[] = [];

    if (data.AbstractText) {
      results.push({
        title: data.Heading || 'Summary',
        url: data.AbstractURL || 'https://duckduckgo.com',
        snippet: data.AbstractText,
      });
    }

    if (data.Answer && data.AnswerType !== '') {
      results.push({
        title: data.Heading || 'Answer',
        url: data.AbstractURL || 'https://duckduckgo.com',
        snippet: data.Answer,
      });
    }

    if (data.RelatedTopics) {
      for (const topic of (data.RelatedTopics || []).slice(0, 6)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text,
            url: topic.FirstURL,
            snippet: topic.Text,
          });
        }
        if (topic.Topics) {
          for (const sub of topic.Topics.slice(0, 3)) {
            if (sub.Text && sub.FirstURL) {
              results.push({
                title: sub.Text.split(' - ')[0] || sub.Text,
                url: sub.FirstURL,
                snippet: sub.Text,
              });
            }
          }
        }
      }
    }

    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ results: 'Please provide a search query.' });
  }

  const trimmedQuery = query.trim();
  
  // Try all sources in parallel, pick the best results
  const [googleResults, duckResults, instantResults] = await Promise.all([
    searchGoogleThis(trimmedQuery),
    searchDuckDuckGoHTML(trimmedQuery),
    searchDuckDuckGoInstant(trimmedQuery),
  ]);

  // Merge results: prefer googlethis (best quality), fallback to DuckDuckGo
  let bestResults: SearchResult[];
  
  if (googleResults.length > 0) {
    console.log(`[Search] Using googlethis: ${googleResults.length} results`);
    bestResults = googleResults;
  } else if (duckResults.length > 0) {
    console.log(`[Search] Using DuckDuckGo HTML: ${duckResults.length} results`);
    bestResults = duckResults;
  } else if (instantResults.length > 0) {
    console.log(`[Search] Using DuckDuckGo Instant: ${instantResults.length} results`);
    bestResults = instantResults;
  } else {
    console.warn(`[Search] All sources failed for: ${trimmedQuery.substring(0, 50)}`);
    return NextResponse.json({
      results: `I couldn't find current web results for "${trimmedQuery}". Please try a different search query or ask me from my existing knowledge.`
    });
  }

  return NextResponse.json({ results: formatResults(bestResults) });
}
