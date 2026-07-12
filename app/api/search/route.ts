import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';
/**
 * Smart AI Web Search — Powered by Tavily API
 * Includes intelligent intent detection to save credits.
 */

function isSearchQuery(query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  
  // Always skip very short conversational messages unless they mention a year
  if (trimmed.split(' ').length <= 2 && !/2024|2025|2026/.test(trimmed)) {
    return false;
  }
  
  // Explicitly skip casual greetings and small talk (e.g. "tell me", "explain", "detail it")
  const skipRegex = /^(hello|hi|hey|how are you|thanks|thank you|ok|okay|sure|tell me|explain|write|generate|create|detail it|can you|what is this|who are you)/i;
  if (skipRegex.test(trimmed)) return false;
  
  // Explicit triggers for search
  const triggerRegex = /(who|what|where|when|why|how|current|latest|news|weather|price of|stock|2024|2025|2026|update|today|now|search for)/i;
  if (triggerRegex.test(trimmed)) return true;

  // Default fallback: assume it might need search if it's a longer question
  return trimmed.includes('?');
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

  console.log(`[Search] Initiating Tavily search for: "${query}"`);
  
  try {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.error('[Search] Missing TAVILY_API_KEY in environment variables.');
      return 'Search is temporarily unavailable (Missing API Key).';
    }

    // 2. Call Tavily API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'basic',
        include_answer: true,
        include_images: false,
        max_results: 5
      }),
      cache: 'no-store', // Force Vercel to never cache this request
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      console.warn(`[Search] Tavily API failed with status ${res.status}`);
      return 'Search service is currently unresponsive.';
    }

    const data = await res.json();
    
    let resultString = '';
    
    // Prioritize Tavily's AI-generated answer if available
    if (data.answer) {
      resultString += `[Tavily AI Answer]\n${data.answer}\n\n`;
    }
    
    // Include the actual search results
    if (data.results && data.results.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resultString += data.results.map((r: any, i: number) => 
        `[Result ${i + 1}]\nTitle: ${r.title}\nURL: ${r.url}\nSnippet: ${r.content}`
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
