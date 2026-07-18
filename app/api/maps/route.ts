import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`, {
      headers: {
        'User-Agent': 'ORION-AI/1.0',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      throw new Error(`OpenStreetMap API returned ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || data.length === 0) {
      return NextResponse.json({ results: `No location found for "${query}".` });
    }

    const formattedResults = data.map((item: { display_name: string; type: string; lat: string; lon: string }, i: number) => 
      `${i + 1}. ${item.display_name} (Type: ${item.type}, Lat: ${item.lat}, Lon: ${item.lon})`
    ).join('\n');

    return NextResponse.json({ results: formattedResults });
  } catch (error) {
    console.error('Maps API error:', error);
    return NextResponse.json({ error: 'Failed to fetch map data' }, { status: 500 });
  }
}
