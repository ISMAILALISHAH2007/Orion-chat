import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

    const memories = await prisma.memory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(memories);
  } catch (_error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

    const body = await req.json();
    if (!body.content) return new NextResponse('Missing content', { status: 400 });

    const memory = await prisma.memory.create({
      data: {
        userId: session.user.id,
        content: body.content,
        // vector embedding logic would go here
      },
    });

    return NextResponse.json(memory);
  } catch (_error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}
