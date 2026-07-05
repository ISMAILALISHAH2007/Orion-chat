import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const name = searchParams.get('name') || 'download.png';

  if (!url) {
    return new NextResponse('Missing URL', { status: 400 });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch image');
    }

    const headers = new Headers(response.headers);
    headers.set('Content-Disposition', `attachment; filename="${name}"`);
    
    // Ensure we don't accidentally cache the download attachment across users if it's dynamic
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return new NextResponse('Error downloading file', { status: 500 });
  }
}
