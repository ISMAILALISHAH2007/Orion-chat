import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // Add rate limiting logic here if needed or headers
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Public paths that do NOT require authentication
        if (
          pathname.startsWith('/api/auth') ||
          pathname === '/sign-in' ||
          pathname === '/sign-up' ||
          pathname === '/' // assuming landing page is public
        ) {
          return true;
        }

        // Protect dashboard and secure api routes
        if (pathname.startsWith('/dashboard') || pathname.startsWith('/api')) {
          return !!token;
        }

        return true;
      },
    },
    pages: {
      signIn: '/sign-in',
    },
  }
);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

