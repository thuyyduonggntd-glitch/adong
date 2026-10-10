import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasOrdersAccess } from '@/lib/adminAccess';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasOrdersAccess((session.user as any)?.role, (session.user as any)?.adminZones))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const newToday = searchParams.get('newToday');

  if (newToday === '1') {
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    nowKst.setUTCHours(0, 0, 0, 0);
    const kstMidnightUtc = new Date(nowKst.getTime() - 9 * 60 * 60 * 1000);
    const count = await prisma.user.count({
      where: { createdAt: { gte: kstMidnightUtc }, role: 'USER' },
    });
    return NextResponse.json({ count });
  }

  const q = searchParams.get('q');
  const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));

  const userWhere = q ? {
    OR: [
      { name:  { contains: q, mode: 'insensitive' as const } },
      { email: { contains: q, mode: 'insensitive' as const } },
    ],
  } : {};

  const USER_SELECT = {
    id: true, name: true, email: true, phone: true, role: true, isActive: true,
    dealerGrade: true,
    shopName: true, businessNumber: true, shopSiteUrl: true, address: true, country: true,
    shippingName: true, shippingPhone: true,
    depositAmount: true, createdAt: true,
    _count: { select: { orders: true } },
  } as const;

  // Paginated users + total count + deposit sum — all in parallel
  const [users, total, depositAgg, misuAgg] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: USER_SELECT,
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where: userWhere }),
    prisma.user.aggregate({
      where: { ...userWhere, role: 'USER' },
      _sum: { depositAmount: true },
    }),
    prisma.user.aggregate({
      where: { ...userWhere, role: 'USER', depositAmount: { lt: 0 } },
      _sum: { depositAmount: true },
    }),
  ]);

  // Per-page user sales + total sales (across all matching) in parallel
  const pageUserIds = users.map((u) => u.id);
  const confirmedStatuses = ['CONFIRMED', 'SHIPPING', 'DELIVERED'] as ('CONFIRMED' | 'SHIPPING' | 'DELIVERED')[];
  const [salesByUser, totalSalesAgg] = await Promise.all([
    prisma.order.groupBy({
      by: ['userId'],
      where: { userId: { in: pageUserIds }, status: { in: confirmedStatuses } },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { ...(q ? { user: userWhere } : {}), status: { in: confirmedStatuses } },
      _sum: { totalAmount: true },
    }),
  ]);

  const salesMap = new Map(salesByUser.map((s) => [s.userId, Number(s._sum?.totalAmount ?? 0)]));
  const result = users.map((u) => ({ ...u, totalSales: salesMap.get(u.id) ?? 0 }));

  return NextResponse.json({
    users: result,
    total,
    totalSales:   Number(totalSalesAgg._sum?.totalAmount ?? 0),
    totalDeposit: Number(depositAgg._sum?.depositAmount ?? 0),
    totalMisu:    -Number(misuAgg._sum?.depositAmount ?? 0), // sum of overdue: negate because depositAmount is negative
  });
}
