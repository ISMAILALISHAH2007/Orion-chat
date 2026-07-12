import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';
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
  return fetch(url, { signal: controller.signal, cache: 'no-store' })
    .finally(() => clearTimeout(timeout));
}

// === SOURCE 1: Wikipedia API ===
async function searchWikipedia(query: string): Promise<SearchResult[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`;
  try {
    const res = await fetchWithTimeout(url, 4000);
    if (!res.ok) return [];
    const data = await res.json();
    const results: SearchResult[] = [];
    if (data.query && data.query.search) {
      for (const item of data.query.search.slice(0, 3)) {
        results.push({
          title: item.title + ' - Wikipedia',
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
          snippet: item.snippet.replace(/<[^>]*>/g, '').trim()
        });
      }
    }
    return results;
  } catch (err) {
    console.warn('[Search] Wikipedia failed:', err instanceof Error ? err.message : 'Unknown');
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

// === SOURCE 3: DuckDuckGo HTML API (POST method) ===
async function searchDuckDuckGoHTML(query: string): Promise<SearchResult[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: new URLSearchParams({ q: query }),
      cache: 'no-store',
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $('.result').each((i, el) => {
      const title = $(el).find('.result__title a').text().trim();
      const url = $(el).find('.result__url').attr('href')?.trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      if (title && url && results.length < 8) {
        results.push({ title, url, snippet });
      }
    });
    return results;
  } catch (err) {
    console.warn('[Search] DuckDuckGo HTML failed:', err instanceof Error ? err.message : 'Unknown');
    return [];
  }
}

// === SOURCE 4: Yahoo Search API (Ultimate Fallback) ===
async function searchYahoo(query: string): Promise<SearchResult[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://search.yahoo.com/search?p=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      cache: 'no-store',
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $('.compTitle').each((i, el) => {
      const title = $(el).find('h3.title a').text().trim();
      const url = $(el).find('h3.title a').attr('href')?.trim();
      let snippet = $(el).next().find('.compText').text().trim();
      if (!snippet) snippet = $(el).parent().find('.compText').text().trim();
      
      if (title && url && results.length < 8) {
        results.push({ title, url, snippet });
      }
    });
    return results;
  } catch (err) {
    console.warn('[Search] Yahoo Search failed:', err instanceof Error ? err.message : 'Unknown');
    return [];
  }
}

/**
 * Perform a web search with multi-source fallback for high reliability.
 */
export async function performSearch(query: string): Promise<string> {
  if (!query || query.trim().length === 0) {
    return 'Please provide a search query.';
  }

  // If the query is extremely short and conversational, skip web search to prevent Wikipedia/DDG from returning irrelevant song titles or definitions.
  const trimmedQuery = query.trim();
  const isConversationalFollowUp = trimmedQuery.split(' ').length <= 3 && !/who|what|where|when|why|how|price|stock/i.test(trimmedQuery);
  
  if (isConversationalFollowUp) {
    console.log(`[Search] Bypassing search for conversational follow-up: "${trimmedQuery}"`);
    return 'No search performed for follow-up message.';
  }

  console.log(`[Search] Initiating multi-source search for: "${trimmedQuery}"`);
  
  try {
    // 1. DuckDuckGo HTML (POST) - Best for general questions and current events
    const htmlResults = await searchDuckDuckGoHTML(trimmedQuery);
    if (htmlResults.length > 0) {
      console.log(`[Search] DuckDuckGo HTML found ${htmlResults.length} results.`);
      return formatResults(htmlResults);
    }

    // 2. Yahoo Search (Ultimate Fallback) - Excellent alternative if Vercel blocks DDG
    const yahooResults = await searchYahoo(trimmedQuery);
    if (yahooResults.length > 0) {
      console.log(`[Search] Yahoo Search found ${yahooResults.length} results.`);
      return formatResults(yahooResults);
    }

    // 3. DuckDuckGo Instant Answer - Good for quick facts if main search fails
    const instantResults = await searchDuckDuckGoInstant(trimmedQuery);
    if (instantResults.length > 0) {
      console.log(`[Search] DuckDuckGo Instant found ${instantResults.length} results.`);
      return formatResults(instantResults);
    }

    // 4. Wikipedia (Factual/instant) - Last resort because it often returns irrelevant keyword matches (e.g. song titles)
    const wikiResults = await searchWikipedia(trimmedQuery);
    if (wikiResults.length > 0) {
      console.log(`[Search] Wikipedia found ${wikiResults.length} results.`);
      return formatResults(wikiResults);
    }

    return `I couldn't find current web results for "${trimmedQuery}". Please try a different search query or ask me from my existing knowledge.`;
  } catch (err) {
    console.error('[Search] Unexpected error:', err);
    return `I couldn't find current web results for "${trimmedQuery}". Please try a different search query or ask me from my existing knowledge.`;
  }
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query) return NextResponse.json({ error: 'Query is required' }, { status: 400 });

    const results = await performSearch(query);
    return NextResponse.json({ results });
  } catch (err) {
    console.error('[Search Route] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
