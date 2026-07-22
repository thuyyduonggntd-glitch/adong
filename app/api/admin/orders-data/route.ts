import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';

// 관리자 주문관리 화면(/admin/orders)이 마운트/새로고침 시 8개(또는 7개) API를 따로 호출하던 것을
// 하나로 합친 엔드포인트. /api/home/orders-data 와 동일한 이유(서로 다른 라우트를 동시에 여러 개
// 호출하면 서버리스 환경에서 각각 콜드스타트/커넥션을 새로 맺어 오히려 느려짐)로 적용.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  // 기존 GET /api/orders/items?outOfStockOrUnshipped=1 이 하던 90일 지난 레코드 정리 동일 유지
  await prisma.orderItem.deleteMany({
    where: {
      OR: [
        { outOfStockAt: { lt: cutoff90 } },
        { unshippedAt: { lt: cutoff90 } },
      ],
      cancelledAt: null,
      arrivedAt: null,
    },
  });

  const orderSelect = {
    id: true, userId: true, totalAmount: true, status: true, cancelLocked: true, createdAt: true, note: true,
    user: { select: { name: true } },
    items: {
      select: {
        id: true, quantity: true, price: true, size: true, color: true,
        confirmedAt: true, arrivedAt: true, cancelledAt: true,
        outOfStockAt: true, unshippedAt: true, remark: true, cancelLocked: true,
        isOnSale: true, saleType: true, saleValue: true,
        product: {
          select: {
            id: true, name: true, images: true, brand: true, colors: true,
            isOnSale: true, saleType: true, saleValue: true, productNumber: true,
            category: { select: { name: true } },
          },
        },
      },
    },
  } as const;

  const itemInclude = {
    product: { select: { id: true, name: true, images: true, brand: true, colors: true, productNumber: true, isOnSale: true, saleType: true, saleValue: true } },
    order: { select: { id: true, status: true, userId: true, createdAt: true, note: true, user: { select: { name: true, email: true } } } },
  } as const;

  const inboundInclude = {
    user: { select: { id: true, name: true, email: true } },
    items: { include: { product: { select: { id: true, name: true, images: true, brand: true, isOnSale: true, saleType: true, saleValue: true, sizes: true, colors: true, productNumber: true } } } },
  } as const;

  const [
    pendingOrders,
    confirmedOrders,
    todayInbounds,
    allInbounds,
    todayArrivedItems,
    cancelPolicy,
    outOfStockUnshippedItems,
    allArrivedOrderItems,
  ] = await Promise.all([
    prisma.order.findMany({ where: { status: 'PENDING' }, select: orderSelect, orderBy: { createdAt: 'desc' } }),
    prisma.order.findMany({ where: { status: 'CONFIRMED' }, select: orderSelect, orderBy: { createdAt: 'desc' } }),
    prisma.inbound.findMany({ where: { arrivedAt: { gte: todayStart, lte: todayEnd } }, include: inboundInclude, orderBy: { arrivedAt: 'desc' } }),
    prisma.inbound.findMany({ include: inboundInclude, orderBy: { arrivedAt: 'desc' } }),
    prisma.orderItem.findMany({ where: { arrivedAt: { gte: todayStart, lte: todayEnd }, cancelledAt: null }, include: itemInclude, orderBy: { arrivedAt: 'desc' } }),
    prisma.cancelPolicy.findFirst(),
    prisma.orderItem.findMany({
      where: {
        OR: [
          { outOfStockAt: { not: null, gte: cutoff90 } },
          { unshippedAt: { not: null, gte: cutoff90 } },
        ],
      },
      include: itemInclude,
      orderBy: { order: { createdAt: 'desc' } },
    }),
    prisma.orderItem.findMany({ where: { arrivedAt: { not: null }, cancelledAt: null }, include: itemInclude, orderBy: { arrivedAt: 'desc' } }),
  ]);

  return NextResponse.json({
    pendingOrders,
    confirmedOrders,
    todayInbounds,
    allInbounds,
    todayArrivedItems,
    cancelPolicy: cancelPolicy ?? { globalEnabled: false, timeLimit: null, cancelFrom: null, cancelTo: null },
    outOfStockUnshippedItems,
    allArrivedOrderItems,
  });
}
