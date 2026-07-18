import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const folders = await prisma.folder.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('Folders GET error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { name } = await req.json();
    if (!name) return new NextResponse('Folder name is required', { status: 400 });

    const folder = await prisma.folder.create({
      data: {
        userId,
        name,
      },
    });

    return NextResponse.json(folder);
  } catch (error) {
    console.error('Folders POST error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return new NextResponse('Folder ID is required', { status: 400 });

    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.userId !== userId) {
      return new NextResponse('Not found or unauthorized', { status: 404 });
    }

    await prisma.folder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Folders DELETE error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
