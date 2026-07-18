import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      // Return messages for a specific session
      const chatSession = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: { messages: { orderBy: { createdAt: 'asc' } } }
      });

      if (!chatSession || chatSession.userId !== userId) {
        return new NextResponse('Not found or unauthorized', { status: 404 });
      }

      return NextResponse.json({ messages: chatSession.messages, mode: chatSession.mode });
    } else {
      // Return list of all sessions for this user
      const sessions = await prisma.chatSession.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          mode: true,
          updatedAt: true,
          pinned: true,
          folderId: true,
        }
      });
      return NextResponse.json({ sessions });
    }
  } catch (error) {
    console.error('Chat history API error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return new NextResponse('Session ID is required', { status: 400 });
    }

    const chatSession = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    });

    if (!chatSession || chatSession.userId !== userId) {
      return new NextResponse('Not found or unauthorized', { status: 404 });
    }

    await prisma.chatSession.delete({
      where: { id: sessionId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Chat delete API error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) return new NextResponse('Session ID is required', { status: 400 });

    const body = await req.json();
    const { title, pinned, folderId } = body;

    const chatSession = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    });

    if (!chatSession || chatSession.userId !== userId) {
      return new NextResponse('Not found or unauthorized', { status: 404 });
    }

    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        ...(title !== undefined && { title }),
        ...(pinned !== undefined && { pinned }),
        ...(folderId !== undefined && { folderId: folderId || null }),
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Chat patch API error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
