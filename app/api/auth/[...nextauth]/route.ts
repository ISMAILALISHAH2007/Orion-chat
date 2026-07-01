import NextAuth from 'next-auth';
import { authOptions } from '@/app/lib/auth';

// Dynamically set NEXTAUTH_URL on Vercel to match the exact deployment host
if (process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
