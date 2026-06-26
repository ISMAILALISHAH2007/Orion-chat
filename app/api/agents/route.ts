import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const agents = await prisma.agent.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(agents);
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

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Agents API POST Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
