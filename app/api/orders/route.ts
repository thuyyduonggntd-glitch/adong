import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calcFinalPrice } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = new URL(req.url).searchParams.get('admin');
  const isAdmin = (session.user as any)?.role === 'ADMIN';

  if (admin === '1' && isAdmin) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    const orders = await prisma.order.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: {
          include: {
            product: {
              select: {
                id: true, name: true, images: true, brand: true, colors: true,
                isOnSale: true, saleType: true, saleValue: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(orders);
  }

  const orders = await prisma.order.findMany({
    where: { userId: (session.user as any).id },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(orders);
}

// 어드민 일괄 상태 변경 + 취소잠금 설정
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderIds, status, cancelLocked } = await req.json();
  if (!orderIds?.length) return NextResponse.json({ error: 'orderIds 필요' }, { status: 400 });

  if (status !== undefined) {
    await prisma.order.updateMany({ where: { id: { in: orderIds } }, data: { status } });
  }
  if (cancelLocked !== undefined) {
    await prisma.order.updateMany({ where: { id: { in: orderIds } }, data: { cancelLocked } });
  }
  return NextResponse.json({ ok: true, count: orderIds.length });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { items, shippingName, shippingPhone, shippingAddress, note } = await req.json();
  const userId = (session.user as any).id;
  const grade  = (session.user as any)?.dealerGrade ?? 'REGULAR';

  // 서버에서 등급 + 세일 가격 직접 계산 (클라이언트 가격 미신뢰)
  const productIds = (items as any[]).map((i) => i.productId);
  const products   = await prisma.product.findMany({
    where:   { id: { in: productIds } },
    include: { prices: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const orderItems = (items as any[]).map((i) => {
    const product    = productMap.get(i.productId);
    const gradePrice = product?.prices.find((p) => p.grade === grade);
    const basePrice  = gradePrice
      ? Number(gradePrice.price)
      : product ? Number(product.price) : Number(i.price ?? 0);
    const finalPrice = product
      ? calcFinalPrice(basePrice, product.isOnSale, product.saleType, product.saleValue)
      : basePrice;
    return { productId: i.productId, quantity: Number(i.quantity), price: finalPrice, size: i.size, color: i.color };
  });

  const totalAmount = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const order = await prisma.order.create({
    data: {
      userId,
      totalAmount,
      shippingName:    shippingName    || null,
      shippingPhone:   shippingPhone   || null,
      shippingAddress: shippingAddress || null,
      note:            note            || null,
      items: { create: orderItems },
    },
  });
  return NextResponse.json(order);
}
