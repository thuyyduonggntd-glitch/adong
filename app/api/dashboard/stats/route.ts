import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [totalOrders, pendingOrders, totalRevenue, totalUsers, recentOrders] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: { in: ['CONFIRMED', 'SHIPPING', 'DELIVERED'] } },
    }),
    prisma.user.count({ where: { role: 'USER' } }),
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, totalAmount: true, createdAt: true, status: true,
        user: { select: { name: true } },
        items: { select: { product: { select: { name: true } } }, take: 1 },
      },
    }),
  ]);

  return NextResponse.json({
    totalOrders,
    pendingOrders,
    revenue: totalRevenue._sum?.totalAmount ?? 0,
    totalUsers,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      userName: o.user?.name ?? '-',
      firstItem: o.items[0]?.product?.name ?? '-',
      totalAmount: o.totalAmount,
      status: o.status,
      createdAt: o.createdAt,
    })),
  });
}
