import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

    const files = await prisma.document.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(files);
  } catch (error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

    // Assuming a simple FormData upload for MVP
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new NextResponse('No file provided', { status: 400 });
    }

    // In a real app, upload to S3/Vercel Blob and get URL.
    // For now, we simulate success
    const document = await prisma.document.create({
      data: {
        userId: session.user.id,
        title: file.name,
        mimeType: file.type,
        content: 'Simulated extracted content', // You'd extract text here
        fileUrl: 'https://simulated-storage.url/file.pdf'
      },
    });

    return NextResponse.json(document);
  } catch (error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}
