import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = (session.user as any)?.role === 'ADMIN';
  const userId  = (session.user as any)?.id;

  const { searchParams } = new URL(req.url);
  const today = searchParams.get('today');
  const date  = searchParams.get('date');  // YYYY-MM-DD
  const brand = searchParams.get('brand');

  let where: any = {};

  // 일반 회원은 자신에게 연결된 입고만 조회
  if (!isAdmin) where.userId = userId;

  if (today === '1') {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end   = new Date(); end.setHours(23, 59, 59, 999);
    where.arrivedAt = { gte: start, lte: end };
  } else if (date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);
    where.arrivedAt = { gte: start, lte: end };
  }
  if (brand && isAdmin) where.brand = { contains: brand, mode: 'insensitive' };

  const list = await prisma.inbound.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: { include: { product: { select: { id: true, name: true, images: true, brand: true, isOnSale: true, saleType: true, saleValue: true, sizes: true, colors: true } } } },
    },
    orderBy: { arrivedAt: 'desc' },
  });
  return NextResponse.json(list);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { itemIds } = await req.json();
  if (!itemIds?.length) return NextResponse.json({ error: 'itemIds 필요' }, { status: 400 });

  await prisma.inboundItem.updateMany({
    where: { id: { in: itemIds } },
    data: { shippedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { brand, note, arrivedAt, userId, items } = await req.json();
  if (!brand || !items?.length) return NextResponse.json({ error: '브랜드와 항목 필수' }, { status: 400 });

  const inbound = await prisma.inbound.create({
    data: {
      brand,
      note: note || null,
      arrivedAt: arrivedAt ? new Date(arrivedAt) : new Date(),
      userId: userId || null,
      items: {
        create: items.map((i: any) => ({
          productId: i.productId || null,
          name: i.name,
          quantity: Number(i.quantity),
          size: i.size || null,
          color: i.color || null,
        })),
      },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: { include: { product: { select: { id: true, name: true, images: true, brand: true, isOnSale: true, saleType: true, saleValue: true, sizes: true, colors: true } } } },
    },
  });
  return NextResponse.json(inbound);
}
