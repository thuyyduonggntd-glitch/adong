import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasNoticeFaqAccess, isAdmin } from '@/lib/adminAccess';

const PAGE_SIZE = 100;

// GET /api/notices/[id]/readers?tab=confirmed|pending&page=1
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const zones = (session?.user as any)?.adminZones;
  if (!session || !hasNoticeFaqAccess(role, zones))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const adminOnly = isAdmin(role);
  const { searchParams } = new URL(req.url);
  const tab  = searchParams.get('tab') ?? 'confirmed';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

  const notice = await prisma.notice.findUnique({
    where: { id: params.id },
    select: { recipientType: true, recipientIds: true },
  });
  if (!notice) return NextResponse.json({ error: '없음' }, { status: 404 });

  // 대상 IDs 계산
  let targetIds: string[] | null = null; // null = 전체 회원
  if (notice.recipientType !== 'all') {
    targetIds = notice.recipientIds;
  }

  if (tab === 'confirmed') {
    const where = targetIds
      ? { noticeId: params.id, userId: { in: targetIds } }
      : { noticeId: params.id };

    const [total, rows] = await prisma.$transaction([
      prisma.noticeSeen.count({ where }),
      prisma.noticeSeen.findMany({
        where,
        orderBy: { seenAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: adminOnly ? { user: { select: { name: true, shopName: true } } } : undefined,
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
      rows: rows.map((r) => ({
        userId: r.userId,
        seenAt: r.seenAt,
        ...(adminOnly ? { name: (r as any).user?.name, shopName: (r as any).user?.shopName } : {}),
      })),
    });
  }

  // tab === 'pending'
  if (targetIds === null) {
    // 전체 회원: 미확인 = 활성 USER 중 NoticeSeen 없는 사람
    const seenIds = (await prisma.noticeSeen.findMany({
      where: { noticeId: params.id },
      select: { userId: true },
    })).map((r) => r.userId);

    const where = { role: 'USER' as const, isActive: true, id: { notIn: seenIds } };
    const [total, rows] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { id: true, name: adminOnly, shopName: adminOnly },
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
      rows: rows.map((u) => ({
        userId: u.id,
        ...(adminOnly ? { name: (u as any).name, shopName: (u as any).shopName } : {}),
      })),
    });
  }

  // selected / country: 미확인 = recipientIds에 있지만 NoticeSeen에 없는 사람
  const seenIds = new Set(
    (await prisma.noticeSeen.findMany({
      where: { noticeId: params.id, userId: { in: targetIds } },
      select: { userId: true },
    })).map((r) => r.userId)
  );
  const pendingIds = targetIds.filter((id) => !seenIds.has(id));
  const total = pendingIds.length;
  const pageIds = pendingIds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  let rows: { userId: string; name?: string; shopName?: string }[] = [];
  if (adminOnly && pageIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: pageIds } },
      select: { id: true, name: true, shopName: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    rows = pageIds.map((id) => ({ userId: id, name: userMap[id]?.name ?? undefined, shopName: userMap[id]?.shopName ?? undefined }));
  } else {
    rows = pageIds.map((id) => ({ userId: id }));
  }

  return NextResponse.json({ total, page, totalPages: Math.ceil(total / PAGE_SIZE), rows });
}
