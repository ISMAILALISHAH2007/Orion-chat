import NextAuth from 'next-auth';
import { authOptions } from '@/app/lib/auth';

const authHandler = NextAuth(authOptions);

// NextAuth returns a ResponseInternal which we forward to its handler.
// We accept the (req, res) signature NextAuth 4 expects.
const handler = (req: Request, res: unknown) => {
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host');
  if (host) {
    process.env.NEXTAUTH_URL = `${protocol}://${host}`;
  }
  return authHandler(req, res as Parameters<typeof authHandler>[1]);
};

export { handler as GET, handler as POST };
