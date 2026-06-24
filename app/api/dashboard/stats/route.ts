import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const toKSTDate = (d: Date) => {
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  };

  const [totalOrders, pendingOrders, totalRevenue, totalUsers, recentOrders, deposits] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: { in: ['CONFIRMED', 'SHIPPING', 'DELIVERED'] } },
    }),
    prisma.user.count({ where: { role: 'USER' } }),
    prisma.order.findMany({
      where: { createdAt: { gte: cutoff } },
      select: { createdAt: true, totalAmount: true, userId: true, user: { select: { name: true, depositAmount: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: cutoff }, type: 'DEPOSIT' },
      select: { date: true, amount: true, description: true, userId: true, user: { select: { name: true, depositAmount: true } } },
      orderBy: { date: 'desc' },
    }),
  ]);

  type DateEntry = { orderCount: number; orderAmount: number; deposit: number; descriptions: string[] };
  type UserEntry = { userName: string; balance: number; byDate: Map<string, DateEntry> };

  const userMap = new Map<string, UserEntry>();

  const getDateEntry = (userId: string, userName: string, balance: number, date: string): DateEntry => {
    if (!userMap.has(userId)) userMap.set(userId, { userName, balance, byDate: new Map() });
    const u = userMap.get(userId)!;
    if (!u.byDate.has(date)) u.byDate.set(date, { orderCount: 0, orderAmount: 0, deposit: 0, descriptions: [] });
    return u.byDate.get(date)!;
  };

  for (const o of recentOrders) {
    const entry = getDateEntry(o.userId, o.user.name, o.user.depositAmount, toKSTDate(o.createdAt));
    entry.orderCount++;
    entry.orderAmount += o.totalAmount;
  }

  for (const t of deposits) {
    const entry = getDateEntry(t.userId, t.user.name, t.user.depositAmount, toKSTDate(t.date));
    entry.deposit += t.amount;
    if (t.description) entry.descriptions.push(t.description);
  }

  const userStats = Array.from(userMap.entries()).map(([userId, data]) => {
    const dailyBreakdown = Array.from(data.byDate.entries())
      .map(([date, d]) => ({ date, ...d }))
      .sort((a, b) => b.date.localeCompare(a.date));
    return {
      userId,
      userName: data.userName,
      balance: data.balance,
      totalOrders: dailyBreakdown.reduce((s, d) => s + d.orderCount, 0),
      totalRevenue: dailyBreakdown.reduce((s, d) => s + d.orderAmount, 0),
      totalDeposit: dailyBreakdown.reduce((s, d) => s + d.deposit, 0),
      dailyBreakdown,
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  return NextResponse.json({
    totalOrders,
    pendingOrders,
    revenue: totalRevenue._sum.totalAmount ?? 0,
    totalUsers,
    userStats,
  });
}
