import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin, hasNoticeFaqAccess } from '@/lib/adminAccess';
import { translateAndSaveNotice } from '@/lib/translate';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const active = searchParams.get('active');

  if (active === '1') {
    // 로그인한 회원에게만 공지 노출 — 결과는 사용자별로 다르므로 공유 캐시 금지
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json([]);

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    if (!user) return NextResponse.json([]);

    const now = new Date();

    // 전체 대상 공지: 가입일 이후 + 활성 + 일정 내
    const allNotices = await prisma.notice.findMany({
      where: {
        isActive: true,
        createdAt: { gte: user.createdAt },
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
      },
      orderBy: { createdAt: 'desc' },
      include: { seenBy: { where: { userId }, select: { id: true } } },
    });

    // 수신 대상 필터링 (서버 사이드 — 다른 사람의 공지는 절대 노출하지 않음)
    const visible = allNotices.filter((n) => {
      if (n.recipientType === 'all') return true;
      return n.recipientIds.includes(userId);
    });

    return NextResponse.json(visible.map(({ seenBy, ...n }) => ({ ...n, seen: seenBy.length > 0 })));
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const zones = (session?.user as any)?.adminZones;
  if (!session || !hasNoticeFaqAccess(role, zones))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // 관리자용: 공지 목록 + 읽음 수
  const notices = await prisma.notice.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { _count: { select: { seenBy: true } } },
  });
  return NextResponse.json(notices.map(({ _count, ...n }) => ({ ...n, seenCount: _count.seenBy })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const zones = (session?.user as any)?.adminZones;
  if (!session || !hasNoticeFaqAccess(role, zones))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, content, recipientType, recipientIds, recipientCountries, scheduledAt, expiresAt } = await req.json();
  if (!title?.trim() || !content?.trim())
    return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 });

  const rType: string = recipientType ?? 'all';
  let rIds: string[] = [];
  let rCountries: string[] = [];

  if (rType === 'selected') {
    rIds = Array.isArray(recipientIds) ? recipientIds : [];
  } else if (rType === 'country') {
    rCountries = Array.isArray(recipientCountries) ? recipientCountries : [];
    // 국가별: 현재 해당 국가 회원 IDs를 스냅샷으로 저장 (이후 가입 회원은 수신 제외)
    const users = await prisma.user.findMany({
      where: { country: { in: rCountries }, isActive: true, role: 'USER' },
      select: { id: true },
    });
    rIds = users.map((u) => u.id);
  }

  const notice = await prisma.notice.create({
    data: {
      type: 'MANUAL',
      title: title.trim(),
      content: content.trim(),
      recipientType: rType,
      recipientIds: rIds,
      recipientCountries: rCountries,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      expiresAt:   expiresAt   ? new Date(expiresAt)   : null,
    },
  });
  translateAndSaveNotice(notice.id).catch((err) => console.error('[translate] notice create hook failed:', err));
  return NextResponse.json(notice);
}
