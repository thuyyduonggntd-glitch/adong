import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';

async function syncUserBalance(userId: string) {
  const dep = await prisma.transaction.aggregate({ where: { userId, type: 'DEPOSIT' },    _sum: { amount: true } });
  const wd  = await prisma.transaction.aggregate({ where: { userId, type: 'WITHDRAWAL' }, _sum: { amount: true } });
  await prisma.user.update({ where: { id: userId }, data: { depositAmount: (dep._sum.amount ?? 0) - (wd._sum.amount ?? 0) } });
}

/**
 * 이미 입고된(arrivedAt 있는) 주문 상품의 단가를 수정.
 * 입고 시 이미 출금(WITHDRAWAL) 거래가 기록돼 있으므로, 기존 거래를 직접 고치지 않고
 * 가격 차액만큼 조정 거래(차액 출금/입금)를 새로 남겨 회원 잔액을 맞춘다.
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { updates } = await req.json();
  if (!Array.isArray(updates) || updates.length === 0)
    return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 });

  const results = [];
  for (const { id, price } of updates) {
    if (!id || typeof price !== 'number' || price < 0) continue;

    const item = await prisma.orderItem.findUnique({
      where: { id },
      include: { order: { select: { userId: true } } },
    });
    if (!item || !item.arrivedAt) continue;

    const oldPrice = item.price;
    if (oldPrice === price) { results.push({ id, price }); continue; }

    const delta = (price - oldPrice) * item.quantity;
    if (delta !== 0) {
      await prisma.transaction.create({
        data: {
          userId: item.order.userId,
          type: delta > 0 ? 'WITHDRAWAL' : 'DEPOSIT',
          amount: Math.abs(delta),
          description: `가격 수정 조정 (주문상품 #${id.slice(-6).toUpperCase()})`,
          date: new Date(),
        },
      });
      await syncUserBalance(item.order.userId);
    }

    await prisma.orderItem.update({ where: { id }, data: { price } });
    results.push({ id, price });
  }

  return NextResponse.json({ ok: true, updated: results });
}
