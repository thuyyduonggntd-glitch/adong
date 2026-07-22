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
  const users = await prisma.user.findMany({
    where: q ? {
      OR: [
        { name:  { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    } : undefined,
    select: {
      id: true, name: true, email: true, phone: true, role: true, isActive: true,
      dealerGrade: true,
      shopName: true, businessNumber: true, shopSiteUrl: true, address: true, country: true,
      shippingName: true, shippingPhone: true,
      depositAmount: true, createdAt: true,
      _count: { select: { orders: true } },
      orders: {
        where: { status: { in: ['CONFIRMED', 'SHIPPING', 'DELIVERED'] } },
        select: { totalAmount: true },
      },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
  });

  const result = users.map((u) => ({
    ...u,
    totalSales: u.orders.reduce((sum, o) => sum + o.totalAmount, 0),
    orders: undefined,
  }));

  return NextResponse.json(result);
}
