import { NextResponse } from 'next/server';
import { generatePreviewHtml } from '@/app/lib/utils/preview';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code') || '';
  const lang = searchParams.get('lang') || 'text';

  if (!code) {
    return new NextResponse('No code provided', { status: 400 });
  }

  const decoded = decodeURIComponent(code);
  const html = generatePreviewHtml(decoded, lang);

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https:;",
    },
  });
}
