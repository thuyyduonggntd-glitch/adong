import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasOrdersAccess } from '@/lib/adminAccess';

// 관리자 주문관리 화면이 마운트 시 꼭 필요한 최소 데이터만 반환.
// pendingOrders/confirmedOrders → 탭별 API(pending-items, confirmed-items)로 분리.
// allInbounds/allArrivedOrderItems → 전체입고 탭 첫 진입 시 inbound-history API로 lazy 로드.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !hasOrdersAccess((session.user as any)?.role, (session.user as any)?.adminZones)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const itemInclude = {
    product: { select: { id: true, name: true, images: true, brand: true, colors: true, colorImages: { select: { color: true, imageUrl: true }, orderBy: { sequence: 'asc' } }, colorCodes: { select: { color: true, code: true } }, productNumber: true, isOnSale: true, saleType: true, saleValue: true } },
    order:   { select: { id: true, status: true, userId: true, createdAt: true, note: true, user: { select: { name: true, email: true } } } },
  } as const;

  const inboundInclude = {
    user:  { select: { id: true, name: true, email: true } },
    items: { include: { product: { select: { id: true, name: true, images: true, brand: true, isOnSale: true, saleType: true, saleValue: true, sizes: true, colors: true, colorImages: { select: { color: true, imageUrl: true }, orderBy: { sequence: 'asc' } }, colorCodes: { select: { color: true, code: true } }, productNumber: true } } } },
  } as const;

  const [
    pendingCount,
    confirmedCount,
    todayInbounds,
    todayArrivedItems,
    cancelPolicy,
    outOfStockUnshippedItems,
  ] = await Promise.all([
    prisma.orderItem.count({
      where: { confirmedAt: null, arrivedAt: null, cancelledAt: null, outOfStockAt: null, unshippedAt: null },
    }),
    prisma.orderItem.count({
      where: { confirmedAt: { not: null }, arrivedAt: null, cancelledAt: null, outOfStockAt: null, unshippedAt: null },
    }),
    prisma.inbound.findMany({ where: { arrivedAt: { gte: todayStart, lte: todayEnd } }, include: inboundInclude, orderBy: { arrivedAt: 'desc' } }),
    prisma.orderItem.findMany({ where: { arrivedAt: { gte: todayStart, lte: todayEnd }, cancelledAt: null }, include: itemInclude, orderBy: { arrivedAt: 'desc' } }),
    prisma.cancelPolicy.findFirst(),
    prisma.orderItem.findMany({
      where: {
        OR: [
          { outOfStockAt: { not: null, gte: cutoff90 } },
          { unshippedAt:  { not: null, gte: cutoff90 } },
        ],
      },
      include: itemInclude,
      orderBy: { order: { createdAt: 'desc' } },
    }),
  ]);

  return NextResponse.json({
    pendingCount,
    confirmedCount,
    todayInbounds,
    todayArrivedItems,
    cancelPolicy: cancelPolicy ?? { globalEnabled: false, timeLimit: null, cancelFrom: null, cancelTo: null },
    outOfStockUnshippedItems,
  });
}
