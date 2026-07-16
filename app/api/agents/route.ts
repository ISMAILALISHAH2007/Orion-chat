import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/db';

export async function GET() {
  try {
    console.log('[Agents API] GET request received');
    const session = await getServerSession(authOptions);
    console.log('[Agents API] Session retrieval finished, user ID:', session?.user?.id);
    if (!session?.user?.id) {
      console.log('[Agents API] Unauthorized GET request');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('[Agents API] Fetching agents from DB...');
    const agents = await prisma.agent.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });
    console.log('[Agents API] Agents fetched successfully, count:', agents.length);

    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Agents API GET Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { name, description, systemPrompt, model } = body;

    if (!name || !systemPrompt) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    const agent = await prisma.agent.create({
      data: {
        userId: session.user.id,
        name,
        description,
        systemPrompt,
        model: model || 'gpt-4o',
      },
    });

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Agents API POST Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
