import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';
import { translateAndSaveNotice } from '@/lib/translate';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const active = searchParams.get('active');

  if (active === '1') {
    // 로그인한 회원에게만 공지 노출. 팝업에서 한 번 닫은 공지는 계정에 기록되어(NoticeSeen) 다시 뜨지 않음
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json([]);

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    if (!user) return NextResponse.json([]);

    const notices = await prisma.notice.findMany({
      // 가입일 이전에 올라온 공지는 노출하지 않음 — 가입일 이후 공지만 대상
      where: { isActive: true, createdAt: { gte: user.createdAt } },
      orderBy: { createdAt: 'desc' },
      include: { seenBy: { where: { userId }, select: { id: true } } },
    });
    return NextResponse.json(notices.map(({ seenBy, ...n }) => ({ ...n, seen: seenBy.length > 0 })));
  }

  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const notices = await prisma.notice.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  return NextResponse.json(notices);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, content } = await req.json();
  if (!title?.trim() || !content?.trim())
    return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 });

  const notice = await prisma.notice.create({
    data: { type: 'MANUAL', title: title.trim(), content: content.trim() },
  });
  translateAndSaveNotice(notice.id).catch((err) => console.error('[translate] notice create hook failed:', err));
  return NextResponse.json(notice);
}
