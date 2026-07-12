import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return new NextResponse('Gemini API Key missing', { status: 500 });
    }

    return NextResponse.json({ token: key });
  } catch (error) {
    console.error('Error fetching voice token:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
