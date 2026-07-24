import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = hasAdminAccess((session.user as any)?.role);
  const { searchParams } = new URL(req.url);

  if (searchParams.get('unseenCount') === '1') {
    const count = isAdmin
      ? await prisma.qnA.count({ where: { status: 'PENDING' } })
      : await prisma.qnA.count({ where: { userId: (session.user as any).id, answerSeen: false } });
    return NextResponse.json({ count });
  }

  if (searchParams.get('myAnswerUnseenCount') === '1') {
    const count = await prisma.qnA.count({
      where: { userId: (session.user as any).id, answerSeen: false },
    });
    return NextResponse.json({ count });
  }

  const list = await prisma.qnA.findMany({
    where: isAdmin ? undefined : { userId: (session.user as any).id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json(list);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action } = await req.json();
  if (action === 'markAnswersSeen') {
    await prisma.qnA.updateMany({
      where: { userId: (session.user as any).id, answerSeen: false },
      data: { answerSeen: true },
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, content, category, images } = await req.json();
  if (!title || !content) return NextResponse.json({ error: '제목과 내용을 입력하세요.' }, { status: 400 });

  const VALID_CATEGORIES = ['PRODUCT', 'ORDER', 'ARRIVAL', 'PAYMENT', 'DELIVERY', 'OTHER'];
  if (!VALID_CATEGORIES.includes(category)) return NextResponse.json({ error: '문의 유형을 선택하세요.' }, { status: 400 });

  const qna = await prisma.qnA.create({
    data: {
      userId: (session.user as any).id,
      title,
      content,
      category,
      images: images || [],
    },
  });
  return NextResponse.json(qna);
}
