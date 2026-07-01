import NextAuth from 'next-auth';
import { authOptions } from '@/app/lib/auth';

// Dynamically set NEXTAUTH_URL on Vercel to match the exact deployment host
if (process.env.VERCEL_URL) {
  if (process.env.VERCEL_ENV === 'production') {
    process.env.NEXTAUTH_URL = 'https://ultron-w527.vercel.app';
  } else {
    process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
  }
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
