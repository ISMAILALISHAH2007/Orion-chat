import { NextResponse } from 'next/server';
import google from 'googlethis';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  if (!query) {
    return new NextResponse('Missing query', { status: 400 });
  }

  try {
    const options = {
      page: 0, 
      safe: false, 
      parse_ads: false, 
      additional_params: { 
        hl: 'en' 
      }
    };
    
    const response = await google.search(query, options);
    
    if (!response.results || response.results.length === 0) {
      return NextResponse.json({ results: 'No results found.' });
    }

    const snippets = response.results.slice(0, 5).map((r: any) => `${r.title}\n${r.description}`);

    return NextResponse.json({
      results: snippets.join('\n\n')
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ results: 'Failed to perform web search due to an error.' }, { status: 500 });
  }
}
