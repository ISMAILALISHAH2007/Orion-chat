import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  if (!query) {
    return new NextResponse('Missing query', { status: 400 });
  }

  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from DuckDuckGo');
    }

    const html = await response.text();
    
    // Extract search result snippets
    const snippets: string[] = [];
    const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    
    while ((match = regex.exec(html)) !== null && snippets.length < 5) {
      // Clean HTML tags from the snippet
      const cleanText = match[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .trim();
      
      if (cleanText) {
        snippets.push(cleanText);
      }
    }

    // Fallback if no snippets found
    if (snippets.length === 0) {
      return NextResponse.json({ results: 'No results found or search blocked.' });
    }

    return NextResponse.json({
      results: snippets.join('\n\n')
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ results: 'Failed to perform web search due to an error.' }, { status: 500 });
  }
}
