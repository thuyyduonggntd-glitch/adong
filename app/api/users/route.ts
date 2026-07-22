import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  const where = q ? {
    OR: [
      { name:  { contains: q, mode: 'insensitive' as const } },
      { email: { contains: q, mode: 'insensitive' as const } },
    ],
  } : undefined;

  // 회원별 매출 합계는 주문을 전부 끌어와 JS에서 더하는 대신 DB에서 groupBy로 집계한다.
  const [users, salesByUser] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, phone: true, role: true, isActive: true,
        dealerGrade: true,
        shopName: true, businessNumber: true, shopSiteUrl: true, address: true, country: true,
        shippingName: true, shippingPhone: true,
        depositAmount: true, createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.order.groupBy({
      by: ['userId'],
      where: { status: { in: ['CONFIRMED', 'SHIPPING', 'DELIVERED'] } },
      _sum: { totalAmount: true },
    }),
  ]);

  const salesMap = new Map(salesByUser.map((s) => [s.userId, s._sum.totalAmount ?? 0]));
  const result = users.map((u) => ({ ...u, totalSales: salesMap.get(u.id) ?? 0 }));

  return NextResponse.json(result);
}
