import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This is the Next.js 16 "proxy" (formerly "middleware")
// Use JWT cookie to check if user is logged in
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that don't require auth
  const publicPaths = ['/sign-in', '/sign-up', '/api/auth'];
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p));

  if (isPublicPath) {
    return NextResponse.next();
  }

  // Check for next-auth session cookie (JWT strategy)
  const sessionToken =
    request.cookies.get('next-auth.session-token') ||
    request.cookies.get('__Secure-next-auth.session-token');

  if (!sessionToken) {
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
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$).*)',
  ],
};
