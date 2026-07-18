import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';
/**
 * Smart AI Web Search — Powered by Serper.dev API
 * Includes intelligent intent detection to save credits.
 */

function isSearchQuery(query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  
  // ONLY trigger web search for highly dynamic, local, or specific lookup requests.
  // General knowledge questions ("who is", "what is") will be answered by the AI directly.
  const strictLookupRegex = /(contact|hospital|phone number|address|near me|location|news|weather|stock|price of|restaurant|store|clinic|directions|latest update)/i;
  
  return strictLookupRegex.test(trimmed);
}

export async function performSearch(query: string): Promise<string> {
  if (!query || query.trim().length === 0) {
    return 'Please provide a search query.';
  }

  // 1. Smart Intent Detection to save API credits
  if (!isSearchQuery(query)) {
    console.log(`[Search] Bypassing search for conversational query: "${query}"`);
    return 'No search performed for this query to save credits. Answer from existing knowledge.';
  }

  console.log(`[Search] Initiating Serper search for: "${query}"`);
  
  try {
    const apiKey = process.env.SERPER_API_KEY || process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.error('[Search] Missing SERPER_API_KEY in environment variables.');
      return 'Search is temporarily unavailable (Missing API Key).';
    }

    // 2. Call Serper.dev API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    // Fallback to Tavily if Serper key isn't provided but Tavily is
    if (apiKey === process.env.TAVILY_API_KEY && process.env.TAVILY_API_KEY) {
       // Old Tavily logic
       const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, query: query, search_depth: 'basic', include_answer: true, max_results: 5 }),
        cache: 'no-store', signal: controller.signal
      }).finally(() => clearTimeout(timeout));
      if (!res.ok) return 'Search service is currently unresponsive.';
      const data = await res.json();
      let resultString = '';
      if (data.answer) resultString += `[AI Answer]\n${data.answer}\n\n`;
      if (data.results && data.results.length > 0) {
        resultString += data.results.map((r: { title: string; url: string; content: string }, i: number) => `[Result ${i + 1}]\nTitle: ${r.title}\nURL: ${r.url}\nSnippet: ${r.content}`).join('\n\n---\n\n');
      }
      return resultString || `I couldn't find current web results for "${query}".`;
    }

    // New Serper Logic
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: query }),
      cache: 'no-store', // Force Vercel to never cache this request
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      console.warn(`[Search] Serper API failed with status ${res.status}`);
      return 'Search service is currently unresponsive.';
    }

    const data = await res.json();
    
    let resultString = '';
    
    // Prioritize Serper's direct answer box if Google generated one
    if (data.answerBox && data.answerBox.snippet) {
      resultString += `[Direct Answer]\n${data.answerBox.snippet}\n\n`;
    } else if (data.knowledgeGraph && data.knowledgeGraph.description) {
      resultString += `[Knowledge Graph]\n${data.knowledgeGraph.description}\n\n`;
    }
    
    // Include the top organic search results
    if (data.organic && data.organic.length > 0) {
      resultString += data.organic.slice(0, 5).map((r: { title: string; link: string; snippet: string }, i: number) => 
        `[Result ${i + 1}]\nTitle: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet}`
      ).join('\n\n---\n\n');
    }

    if (!resultString) {
      return `I couldn't find current web results for "${query}".`;
    }

    return resultString;
  } catch (err) {
    console.error('[Search] Unexpected error:', err);
    return `Search failed due to an internal error.`;
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
