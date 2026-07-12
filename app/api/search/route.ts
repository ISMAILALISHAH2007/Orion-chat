import { NextResponse } from 'next/server';

// Search result with title, URL, and snippet for maximum accuracy
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// Format results in a clear, structured way for the AI to parse
function formatResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No search results found for this query.';
  }
  
  return results.map((r, i) => 
    `[Result ${i + 1}]
Title: ${r.title}
URL: ${r.url}
Snippet: ${r.snippet}`
  ).join('\n\n---\n\n');
}

// Fallback free search API using DuckDuckGo (no API key needed)
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ULTRON/1.0)' },
      signal: controller.signal,
    });
    
    if (!res.ok) throw new Error(`DuckDuckGo returned ${res.status}`);
    
    const data = await res.json();
    const results: SearchResult[] = [];
    
    // Include Abstract/Source for instant answers
    if (data.AbstractText && data.AbstractURL) {
      results.push({
        title: data.Heading || 'Summary',
        url: data.AbstractURL,
        snippet: data.AbstractText
      });
    }
    if (data.Answer && data.AnswerType !== '') {
      results.push({
        title: data.Heading || 'Answer',
        url: data.AbstractURL || 'https://duckduckgo.com',
        snippet: data.Answer
      });
    }
    
    // Parse RelatedTopics for additional search results
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, 8).forEach((topic: any) => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text,
            url: topic.FirstURL,
            snippet: topic.Text
          });
        }
        if (topic.Topics && Array.isArray(topic.Topics)) {
          topic.Topics.slice(0, 3).forEach((sub: any) => {
            if (sub.Text && sub.FirstURL) {
              results.push({
                title: sub.Text.split(' - ')[0] || sub.Text,
                url: sub.FirstURL,
                snippet: sub.Text
              });
            }
          });
        }
      });
    }
    
    return results;
  } finally {
    clearTimeout(timeout);
  }
}

// Secondary fallback using DuckDuckGo HTML results (more complete)
async function searchHTMLFallback(query: string): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal,
    });
    
    if (!res.ok) throw new Error(`Fallback returned ${res.status}`);
    
    const html = await res.text();
    const results: SearchResult[] = [];
    
    // Improved regex to extract title, URL, and snippet from DuckDuckGo HTML
    const resultBlocks = html.match(/<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div\s*>\s*<\/div>\s*<\/div>/g);
    if (resultBlocks) {
      for (const block of resultBlocks.slice(0, 8)) {
        const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
        
        if (titleMatch) {
          const title = titleMatch[2].replace(/<[^>]*>/g, '').trim();
          const linkUrl = titleMatch[1].startsWith('http') ? titleMatch[1] : `https://duckduckgo.com${titleMatch[1]}`;
          const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
          
          if (title) {
            results.push({ title, url: linkUrl, snippet });
          }
        }
      }
    }
    
    // Fallback to simpler regex if block method fails
    if (results.length === 0) {
      const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      let match;
      while ((match = resultRegex.exec(html)) !== null && results.length < 8) {
        const url = match[1].startsWith('http') ? match[1] : `https://duckduckgo.com${match[1]}`;
        const title = match[2].replace(/<[^>]*>/g, '').trim();
        const snippet = match[3].replace(/<[^>]*>/g, '').trim();
        if (title) {
          results.push({ title, url, snippet: snippet || 'No description available.' });
        }
      }
    }
    
    return results;
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

  // Primary: use SerpAPI if available
  const serpApiKey = process.env.SERPAPI_API_KEY;
  if (serpApiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      
      const res = await fetch(
        `https://serpapi.com/search?api_key=${serpApiKey}&q=${encodeURIComponent(trimmedQuery)}&engine=google&num=8`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const results: SearchResult[] = [];
        
        if (data.organic_results) {
          data.organic_results.slice(0, 8).forEach((r: any) => {
            if (r.title && r.snippet) {
              results.push({
                title: r.title,
                url: r.link || 'https://google.com',
                snippet: r.snippet
              });
            }
          });
        }
        
        if (results.length > 0) {
          return NextResponse.json({ results: formatResults(results) });
        }
      }
    } catch (e) {
      console.warn('SerpAPI failed, falling back:', e);
    }
  }

  // Fallback 1: DuckDuckGo Instant Answer API
  try {
    const results = await searchDuckDuckGo(trimmedQuery);
    if (results.length > 0) {
      return NextResponse.json({ results: formatResults(results) });
    }
  } catch (e) {
    console.warn('DuckDuckGo API fallback failed:', e);
  }

  // Fallback 2: DuckDuckGo HTML scraping (most complete results)
  try {
    const results = await searchHTMLFallback(trimmedQuery);
    if (results.length > 0) {
      return NextResponse.json({ results: formatResults(results) });
    }
    return NextResponse.json({ 
      results: 'No search results found for your query. Please try rephrasing or ask me a question from my existing knowledge.'
    });
  } catch (error) {
    console.error('All search methods failed:', error);
    return NextResponse.json({ 
      results: 'Web search is currently unavailable. Please try again later or ask me a question from my existing knowledge.'
    }, { status: 200 });
  }
}
