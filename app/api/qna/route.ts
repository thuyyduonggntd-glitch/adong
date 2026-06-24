import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = (session.user as any)?.role === 'ADMIN';
  const list = await prisma.qnA.findMany({
    where: isAdmin ? undefined : { userId: (session.user as any).id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, content, images } = await req.json();
  if (!title || !content) return NextResponse.json({ error: '제목과 내용을 입력하세요.' }, { status: 400 });

  const qna = await prisma.qnA.create({
    data: {
      userId: (session.user as any).id,
      title,
      content,
      images: images || [],
    },
  });
  return NextResponse.json(qna);
}
