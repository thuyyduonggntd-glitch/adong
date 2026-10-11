import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasOrdersAccess } from '@/lib/adminAccess';

// GET /api/admin/inbound-history
//   ?dateFrom=YYYY-MM-DD  (default: 90 days ago)
//   ?dateTo=YYYY-MM-DD    (default: today)
//   ?brand=X              (optional brand filter)
//
// Returns:
//   { arrivedItems: ArrivedItem[], inbounds: InboundRec[] }

const ITEM_INCLUDE = {
  product: {
    select: {
      id: true, name: true, images: true, brand: true, colors: true,
      colorImages: { select: { color: true, imageUrl: true }, orderBy: { sequence: 'asc' } },
      colorCodes:  { select: { color: true, code: true } },
      productNumber: true, isOnSale: true, saleType: true, saleValue: true,
    },
  },
  order: {
    select: {
      id: true, status: true, userId: true, createdAt: true, note: true,
      user: { select: { name: true, email: true } },
    },
  },
} as const;

const INBOUND_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
  items: {
    include: {
      product: {
        select: {
          id: true, name: true, images: true, brand: true,
          isOnSale: true, saleType: true, saleValue: true,
          sizes: true, colors: true,
          colorImages: { select: { color: true, imageUrl: true }, orderBy: { sequence: 'asc' } },
          colorCodes:  { select: { color: true, code: true } },
          productNumber: true,
        },
      },
    },
  },
} as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasOrdersAccess((session.user as any)?.role, (session.user as any)?.adminZones))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);

  const defaultFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const defaultTo   = new Date();

  const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : defaultFrom;
  const dateTo   = searchParams.get('dateTo')   ? new Date(searchParams.get('dateTo')!)   : defaultTo;
  const brand    = searchParams.get('brand')?.trim() ?? '';

  // Ensure dateTo covers the full day
  dateTo.setHours(23, 59, 59, 999);

  const arrivedWhere: any = {
    arrivedAt:   { gte: dateFrom, lte: dateTo },
    cancelledAt: null,
  };
  if (brand) arrivedWhere.product = { brand: { contains: brand, mode: 'insensitive' } };

  const inboundWhere: any = {
    arrivedAt: { gte: dateFrom, lte: dateTo },
  };
  if (brand) inboundWhere.brand = { contains: brand, mode: 'insensitive' };

  const [arrivedItems, inbounds] = await Promise.all([
    prisma.orderItem.findMany({
      where:   arrivedWhere,
      include: ITEM_INCLUDE,
      orderBy: { arrivedAt: 'desc' },
    }),
    prisma.inbound.findMany({
      where:   inboundWhere,
      include: INBOUND_INCLUDE,
      orderBy: { arrivedAt: 'desc' },
    }),
  ]);

  return NextResponse.json({ arrivedItems, inbounds });
}
