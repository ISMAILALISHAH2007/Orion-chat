import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Simple in-memory LRU-like cache for rate limiting
// Note: Since proxy/middleware runs on Edge/Serverless, memory state might reset per instance.
// For production, consider using Redis (Upstash) or Vercel KV.
const rateLimitCache = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_MAX = 50; // max requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate Limiting for API routes
  if (pathname.startsWith('/api')) {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const now = Date.now();
    
    if (!rateLimitCache.has(ip)) {
      rateLimitCache.set(ip, { count: 1, timestamp: now });
    } else {
      const data = rateLimitCache.get(ip)!;
      if (now - data.timestamp > RATE_LIMIT_WINDOW_MS) {
        // Reset window
        rateLimitCache.set(ip, { count: 1, timestamp: now });
      } else {
        if (data.count >= RATE_LIMIT_MAX) {
          return new NextResponse(
            JSON.stringify({ error: 'Too many requests, please try again later.' }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
          );
        }
        data.count++;
      }
    }
  }

  // 2. Public paths that don't require auth
  const publicPaths = ['/sign-in', '/sign-up', '/forgot-password', '/api/auth'];
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p));
  const isRoot = pathname === '/';

  if (isPublicPath || isRoot) {
    return NextResponse.next();
  }

  // 3. Authentication Check (for /dashboard and /api)
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  
  if (!token) {
    // If it's an API route without a token, return 401
    if (pathname.startsWith('/api')) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized access.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Otherwise redirect to sign-in
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets like images (.png, .jpg, .svg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\\\.png$|.*\\\\.jpg$|.*\\\\.svg$|.*\\\\.ico$).*)',
  ],
};
