import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAccess';

// 아이디별 현황 (최근 60일) — 회원 관리 페이지용
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin((session.user as any)?.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const toKSTDate = (d: Date) => {
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  };

  const [recentOrders, deposits] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: cutoff } },
      select: { createdAt: true, totalAmount: true, userId: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: cutoff }, type: 'DEPOSIT' },
      select: { date: true, amount: true, description: true, userId: true },
      orderBy: { date: 'desc' },
    }),
  ]);

  const involvedUserIds = Array.from(new Set([...recentOrders.map((o) => o.userId), ...deposits.map((t) => t.userId)]));
  const involvedUsers = involvedUserIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: involvedUserIds } }, select: { id: true, name: true, depositAmount: true } })
    : [];
  const userInfoMap = new Map(involvedUsers.map((u) => [u.id, u]));

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
    const info = userInfoMap.get(o.userId);
    if (!info) continue;
    const entry = getDateEntry(o.userId, info.name, info.depositAmount, toKSTDate(o.createdAt));
    entry.orderCount++;
    entry.orderAmount += o.totalAmount;
  }

  for (const t of deposits) {
    const info = userInfoMap.get(t.userId);
    if (!info) continue;
    const entry = getDateEntry(t.userId, info.name, info.depositAmount, toKSTDate(t.date));
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

  return NextResponse.json(userStats);
}
