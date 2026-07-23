import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 회원 주문내역 화면(/home/orders)이 마운트 시 8개 API를 따로 호출하던 것을 하나로 합친 엔드포인트.
// 서로 다른 API 라우트를 동시에 여러 개 호출하면 서버리스 환경에서 각각 별도로 콜드스타트/커넥션을
// 맺어야 해서 오히려 느려진다 — 하나의 요청 안에서 Promise.all로 처리하면 그 비용을 한 번만 낸다.
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // 기존 각 라우트(GET /api/orders/items?...)가 하던 90일 지난 레코드 정리도 동일하게 유지
  await Promise.all([
    prisma.orderItem.deleteMany({
      where: {
        OR: [
          { outOfStockAt: { lt: cutoff90 } },
          { unshippedAt: { lt: cutoff90 } },
        ],
        cancelledAt: null,
        arrivedAt: null,
      },
    }),
    prisma.orderItem.deleteMany({ where: { cancelledAt: { lt: cutoff90 } } }),
  ]);

  const itemInclude = {
    product: { select: { id: true, name: true, images: true, brand: true, colors: true, colorImages: { select: { color: true, imageUrl: true } }, productNumber: true, isOnSale: true, saleType: true, saleValue: true } },
    order: { select: { id: true, status: true, userId: true, createdAt: true, note: true, user: { select: { name: true, email: true } } } },
  } as const;

  const [orders, ousuItems, cancelPolicy, deliveryPolicy, cancelledItems, allArrivedItems, inbound, shipping] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      include: { items: { include: { product: { include: { colorImages: { select: { color: true, imageUrl: true } } } } } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.orderItem.findMany({
      where: {
        order: { userId },
        OR: [
          { outOfStockAt: { not: null, gte: cutoff90 } },
          { unshippedAt: { not: null, gte: cutoff90 } },
        ],
      },
      include: itemInclude,
      orderBy: { order: { createdAt: 'desc' } },
    }),
    prisma.cancelPolicy.findFirst(),
    prisma.deliveryPolicy.findFirst(),
    prisma.orderItem.findMany({
      where: { order: { userId }, cancelledAt: { not: null, gte: cutoff90 } },
      include: itemInclude,
      orderBy: { cancelledAt: 'desc' },
    }),
    prisma.orderItem.findMany({
      where: { order: { userId }, arrivedAt: { not: null }, cancelledAt: null },
      include: itemInclude,
      orderBy: { arrivedAt: 'desc' },
    }),
    prisma.inbound.findMany({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, name: true, images: true, brand: true, isOnSale: true, saleType: true, saleValue: true, sizes: true, colors: true, colorImages: { select: { color: true, imageUrl: true } }, productNumber: true } } } },
      },
      orderBy: { arrivedAt: 'desc' },
    }),
    prisma.shipping.findMany({
      where: { userId },
      include: {
        order: {
          select: {
            id: true, totalAmount: true, status: true, createdAt: true,
            items: {
              select: {
                id: true, quantity: true, price: true, size: true, color: true, arrivedAt: true,
                isOnSale: true, saleType: true, saleValue: true,
                product: { select: { name: true, brand: true, images: true, productNumber: true } },
              },
            },
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return NextResponse.json({
    orders,
    ousuItems,
    cancelPolicy: cancelPolicy ?? { globalEnabled: false, timeLimit: null, cancelFrom: null, cancelTo: null },
    deliveryPolicy: deliveryPolicy ?? { fromTime: null, toTime: null, enabled: false },
    cancelledItems,
    allArrivedItems,
    inbound,
    shipping,
  });
}
