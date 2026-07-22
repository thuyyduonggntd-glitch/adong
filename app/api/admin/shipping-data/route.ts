import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';

// 관리자 배송관리 화면(/admin/shipping)이 마운트 시 4개 API를 따로 호출하던 것을 하나로 합친 엔드포인트.
// /api/admin/orders-data, /api/home/orders-data 와 동일한 이유로 적용.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const itemInclude = {
    product: { select: { id: true, name: true, images: true, brand: true, colors: true, productNumber: true, isOnSale: true, saleType: true, saleValue: true } },
    order: { select: { id: true, status: true, userId: true, createdAt: true, note: true, user: { select: { name: true, email: true } } } },
  } as const;

  const [allArrivedItems, shippings, inbounds, deliveryPolicy] = await Promise.all([
    prisma.orderItem.findMany({ where: { arrivedAt: { not: null }, cancelledAt: null }, include: itemInclude, orderBy: { arrivedAt: 'desc' } }),
    prisma.shipping.findMany({
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
    prisma.inbound.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, name: true, images: true, brand: true, isOnSale: true, saleType: true, saleValue: true, sizes: true, colors: true, productNumber: true } } } },
      },
      orderBy: { arrivedAt: 'desc' },
    }),
    prisma.deliveryPolicy.findFirst(),
  ]);

  return NextResponse.json({
    allArrivedItems,
    shippings,
    inbounds,
    deliveryPolicy: deliveryPolicy ?? { fromTime: null, toTime: null, enabled: false },
  });
}
