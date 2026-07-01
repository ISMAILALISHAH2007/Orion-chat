import NextAuth from 'next-auth';
import { authOptions } from '@/app/lib/auth';

const authHandler = NextAuth(authOptions);

const handler = (req: Request, res: any) => {
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host');
  if (host) {
    process.env.NEXTAUTH_URL = `${protocol}://${host}`;
  }
  return authHandler(req, res);
};

export { handler as GET, handler as POST };
