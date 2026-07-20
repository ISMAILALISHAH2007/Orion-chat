import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const where: Record<string, unknown> = { userId: session.user.id };
    if (search.trim()) {
      where.prompt = { contains: search.trim(), mode: 'insensitive' };
    }

    const [images, total] = await Promise.all([
      prisma.image.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.image.count({ where: where as any }),
    ]);

    return NextResponse.json({ images, total, limit, offset });
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

    const image = await prisma.image.findUnique({ where: { id } });
    if (!image || image.userId !== session.user.id) {
      return new NextResponse('Not found or unauthorized', { status: 404 });
    }

    await prisma.image.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (_error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}
