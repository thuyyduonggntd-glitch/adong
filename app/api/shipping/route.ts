import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = hasAdminAccess((session.user as any)?.role);
  const userId = isAdmin ? (new URL(req.url).searchParams.get('userId') || undefined) : (session.user as any).id;

  const list = await prisma.shipping.findMany({
    where: userId ? { userId } : undefined,
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
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderId, trackingNumber, carrier, note, shippedAt } = await req.json();
  if (!orderId) return NextResponse.json({ error: 'orderId 필요' }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const shipping = await prisma.shipping.upsert({
    where: { orderId },
    update: {
      trackingNumber: trackingNumber || null,
      carrier: carrier || null,
      note: note || null,
      shippedAt: shippedAt ? new Date(shippedAt) : null,
    },
    create: {
      orderId,
      userId: order.userId,
      trackingNumber: trackingNumber || null,
      carrier: carrier || null,
      note: note || null,
      shippedAt: shippedAt ? new Date(shippedAt) : null,
    },
  });

  await prisma.order.update({ where: { id: orderId }, data: { status: 'DELIVERED' } });

  return NextResponse.json(shipping);
}
