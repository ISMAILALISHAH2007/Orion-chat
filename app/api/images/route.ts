import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/db';
import { buildPollinationsImageUrl } from '@/app/lib/images/pollinations';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

    const images = await prisma.image.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(images);
  } catch (error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

    const { prompt } = await req.json();
    if (!prompt) return new NextResponse('Missing prompt', { status: 400 });

    const imageUrl = buildPollinationsImageUrl(prompt);

    const image = await prisma.image.create({
      data: {
        userId: session.user.id,
        prompt,
        imageUrl,
      },
    });

    return NextResponse.json(image);
  } catch (error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('imageId');

    if (!id) return new NextResponse('Missing image ID', { status: 400 });

    await prisma.image.deleteMany({
      where: {
        id,
        userId: session.user.id,
      },
    });

    return new NextResponse('OK');
  } catch (error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}