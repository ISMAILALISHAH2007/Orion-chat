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
        category: body.category || 'General',
        tags: body.tags || '',
      },
    });

    return NextResponse.json(memory);
  } catch (_error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return new NextResponse('Missing ID', { status: 400 });

    const memory = await prisma.memory.findUnique({ where: { id } });
    if (!memory || memory.userId !== session.user.id) {
      return new NextResponse('Not found or unauthorized', { status: 404 });
    }

    await prisma.memory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (_error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

    const body = await req.json();
    const { id, content, category, tags } = body;
    if (!id || !content) return new NextResponse('Missing ID or content', { status: 400 });

    const memory = await prisma.memory.findUnique({ where: { id } });
    if (!memory || memory.userId !== session.user.id) {
      return new NextResponse('Not found or unauthorized', { status: 404 });
    }

    const updated = await prisma.memory.update({
      where: { id },
      data: { content, category, tags },
    });

    return NextResponse.json(updated);
  } catch (_error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}
