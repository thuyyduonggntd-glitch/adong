import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasOrdersAccess } from '@/lib/adminAccess';

// Pending (not-yet-confirmed) order items — powers 주문접수 tab
//
// GET /api/admin/pending-items
//   ?mode=summary            → brand-level totals for 쇼핑몰별 view
//   ?mode=detail&brand=X     → all items for one brand accordion (lazy)
//   ?mode=list&page=1&search=X → paginated flat rows for 전체 view
//   ?mode=ids                → all pending item IDs (for bulk "전체 N건")

const PAGE_SIZE = 50;

const PENDING_WHERE = {
  confirmedAt:  null,
  arrivedAt:    null,
  cancelledAt:  null,
  outOfStockAt: null,
  unshippedAt:  null,
} as const;

const ITEM_SELECT = {
  id: true, quantity: true, price: true, size: true, color: true,
  confirmedAt: true, arrivedAt: true, cancelledAt: true,
  outOfStockAt: true, unshippedAt: true, remark: true,
  cancelLocked: true, isOnSale: true, saleType: true, saleValue: true,
  orderBatchId: true,
  order: {
    select: {
      id: true, userId: true, totalAmount: true, status: true,
      cancelLocked: true, createdAt: true, note: true,
      user: { select: { name: true } },
    },
  },
  product: {
    select: {
      id: true, name: true, images: true, brand: true, colors: true,
      colorImages: { select: { color: true, imageUrl: true }, orderBy: { sequence: 'asc' } },
      isOnSale: true, saleType: true, saleValue: true,
      colorCodes: { select: { color: true, code: true } },
      productNumber: true,
      category: { select: { name: true } },
    },
  },
} as const;

function toFlatRow(it: any) {
  return {
    rowKey:           `${it.order.id}__${it.id}`,
    itemId:           it.id,
    orderId:          it.order.id,
    userId:           it.order.userId,
    userName:         it.order.user.name,
    brand:            it.product?.brand || it.product?.category?.name || '',
    product:          it.product,
    size:             it.size,
    color:            it.color,
    quantity:         it.quantity,
    price:            it.price,
    orderDate:        it.order.createdAt,
    status:           it.order.status,
    itemCancelLocked: it.cancelLocked,
    orderCancelLocked: it.order.cancelLocked,
    confirmedAt:      it.confirmedAt,
    arrivedAt:        it.arrivedAt,
    cancelledAt:      it.cancelledAt,
    outOfStockAt:     it.outOfStockAt,
    unshippedAt:      it.unshippedAt,
    note:             it.order.note,
    orderBatchId:     it.orderBatchId ?? null,
    isOnSale:         it.isOnSale,
    saleType:         it.saleType,
    saleValue:        it.saleValue,
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasOrdersAccess((session.user as any)?.role, (session.user as any)?.adminZones))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode   = searchParams.get('mode') ?? 'summary';
  const brand  = searchParams.get('brand') ?? undefined;
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const search = searchParams.get('search')?.trim() ?? '';

  // ── ids — all pending item IDs for bulk 전체 N건 ──────────────────────────
  if (mode === 'ids') {
    const items = await prisma.orderItem.findMany({
      where: PENDING_WHERE,
      select: { id: true },
    });
    return NextResponse.json({ ids: items.map((it) => it.id) });
  }

  // ── detail — items for one brand (accordion lazy load) ───────────────────
  if (mode === 'detail') {
    if (!brand) return NextResponse.json({ error: 'brand required' }, { status: 400 });
    const items = await prisma.orderItem.findMany({
      where: { ...PENDING_WHERE, product: { brand } },
      select: ITEM_SELECT,
      orderBy: { order: { createdAt: 'asc' } },
    });
    return NextResponse.json(items.map(toFlatRow));
  }

  // ── list — paginated flat rows for 전체 view ─────────────────────────────
  if (mode === 'list') {
    const searchWhere = search ? {
      OR: [
        { order: { user: { name: { contains: search, mode: 'insensitive' as const } } } },
        { product: { name: { contains: search, mode: 'insensitive' as const } } },
        { product: { brand: { contains: search, mode: 'insensitive' as const } } },
      ],
    } : {};
    const where = { ...PENDING_WHERE, ...searchWhere };
    const [total, items] = await Promise.all([
      prisma.orderItem.count({ where }),
      prisma.orderItem.findMany({
        where,
        select: ITEM_SELECT,
        orderBy: { order: { createdAt: 'desc' } },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);
    return NextResponse.json({ total, rows: items.map(toFlatRow) });
  }

  // ── summary — raw SQL GROUP BY, 전체 item 전송 없이 집계 ─────────────────
  const summaryRows = await prisma.$queryRaw<Array<{
    brand: string; mall: string | null; distinctCount: bigint; totalQty: bigint;
  }>>`
    SELECT
      COALESCE(p.brand, cat.name, '')                              AS brand,
      b."mallLocation"                                             AS mall,
      COUNT(DISTINCT (oi."productId" || '|' || oi.color || '|' || oi.size)) AS "distinctCount",
      SUM(oi.quantity)                                             AS "totalQty"
    FROM   "OrderItem"  oi
    JOIN   "Product"    p   ON p.id   = oi."productId"
    LEFT JOIN "Category" cat ON cat.id = p."categoryId"
    LEFT JOIN "Brand"    b   ON b.name = COALESCE(p.brand, cat.name)
    WHERE  oi."confirmedAt"  IS NULL
      AND  oi."arrivedAt"    IS NULL
      AND  oi."cancelledAt"  IS NULL
      AND  oi."outOfStockAt" IS NULL
      AND  oi."unshippedAt"  IS NULL
    GROUP  BY COALESCE(p.brand, cat.name, ''), b."mallLocation"
    ORDER  BY COALESCE(b."mallLocation", 'ㅎ') ASC, COALESCE(p.brand, cat.name, '') ASC
  `;

  return NextResponse.json(summaryRows.map((r) => ({
    brand:         r.brand ?? '',
    mall:          r.mall  ?? '',
    distinctCount: Number(r.distinctCount),
    totalQty:      Number(r.totalQty),
  })));
}
