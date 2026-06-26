import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

    const keys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ apiKeys: keys });
  } catch (error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}
