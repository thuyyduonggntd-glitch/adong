import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasOrdersAccess } from '@/lib/adminAccess';

// Confirmed-but-not-yet-arrived items — server-side data for
// 쇼핑몰별 view, 카톡 메시지, 영수증 대조, 전체 list
//
// GET /api/admin/confirmed-items
//   ?mode=summary              → brand-level totals for the mall view header
//   ?mode=detail&brand=X       → all items for one brand (for accordion body, kakaotalk, invoice)
//   ?mode=list&page=1&search=X → paginated flat rows for 전체 view
//   ?mode=ids                  → all confirmed item IDs for bulk 전체 N건
//   &batch=all | <batchId>     → filter by batch (default: all)
//   &scope=waiting | all       → 'waiting'=확인대기만, 'all'=모든확인(영수증 전체 대상)

const PAGE_SIZE = 50;

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
      id: true, name: true, images: true, brand: true, productNumber: true, colors: true,
      colorCodes:  { select: { color: true, code: true } },
      colorImages: { select: { color: true, imageUrl: true }, orderBy: { sequence: 'asc' } },
      category:    { select: { name: true } },
    },
  },
} as const;

function buildWhere(batch: string | null, scope: string, brand?: string) {
  const base: any = {
    confirmedAt: { not: null },
    arrivedAt:   null,
    cancelledAt: null,
    outOfStockAt: null,
    unshippedAt:  null,
  };
  if (batch && batch !== 'all') base.orderBatchId = batch;
  if (brand) base.product = { brand };
  return base;
}

function toFlatRow(it: any) {
  return {
    rowKey:            `${it.order.id}__${it.id}`,
    itemId:            it.id,
    orderId:           it.order.id,
    userId:            it.order.userId,
    userName:          it.order.user.name,
    brand:             it.product?.brand || it.product?.category?.name || '',
    product:           it.product,
    size:              it.size,
    color:             it.color,
    quantity:          it.quantity,
    price:             it.price,
    orderDate:         it.order.createdAt,
    status:            it.order.status,
    itemCancelLocked:  it.cancelLocked,
    orderCancelLocked: it.order.cancelLocked,
    confirmedAt:       it.confirmedAt,
    arrivedAt:         it.arrivedAt,
    cancelledAt:       it.cancelledAt,
    outOfStockAt:      it.outOfStockAt,
    unshippedAt:       it.unshippedAt,
    note:              it.order.note,
    orderBatchId:      it.orderBatchId ?? null,
    isOnSale:          it.isOnSale,
    saleType:          it.saleType,
    saleValue:         it.saleValue,
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasOrdersAccess((session.user as any)?.role, (session.user as any)?.adminZones))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode   = searchParams.get('mode')   ?? 'summary';
  const batch  = searchParams.get('batch')  ?? 'all';
  const brand  = searchParams.get('brand')  ?? undefined;
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const search = searchParams.get('search')?.trim() ?? '';

  // ── ids — all confirmed item IDs for bulk 전체 N건 ─────────────────────
  if (mode === 'ids') {
    const items = await prisma.orderItem.findMany({
      where: buildWhere(batch, 'waiting'),
      select: { id: true },
    });
    return NextResponse.json({ ids: items.map((it) => it.id) });
  }

  // ── list — paginated flat rows for 전체 view ───────────────────────────
  if (mode === 'list') {
    const searchWhere = search ? {
      OR: [
        { order: { user: { name: { contains: search, mode: 'insensitive' as const } } } },
        { product: { name: { contains: search, mode: 'insensitive' as const } } },
        { product: { brand: { contains: search, mode: 'insensitive' as const } } },
      ],
    } : {};
    const where = { ...buildWhere(batch, 'waiting'), ...searchWhere };
    const [total, items] = await Promise.all([
      prisma.orderItem.count({ where }),
      prisma.orderItem.findMany({
        where,
        select: ITEM_SELECT,
        orderBy: { confirmedAt: 'desc' },
        skip:   (page - 1) * PAGE_SIZE,
        take:   PAGE_SIZE,
      }),
    ]);
    return NextResponse.json({ total, rows: items.map(toFlatRow) });
  }

  // ── brand detail (카톡 복사 / 영수증 대조 상세) ──────────────────────────
  if (mode === 'detail') {
    if (!brand) return NextResponse.json({ error: 'brand required' }, { status: 400 });
    const items = await prisma.orderItem.findMany({
      where: buildWhere(batch, 'waiting', brand),
      select: ITEM_SELECT,
      orderBy: { order: { createdAt: 'asc' } },
    });
    return NextResponse.json(items.map((it) => ({
      itemId:       it.id,
      orderId:      it.order.id,
      userName:     it.order.user.name,
      brand:        it.product?.brand ?? '',
      productId:    it.product?.id ?? '',
      productName:  it.product?.name ?? '',
      productNumber: it.product?.productNumber ?? null,
      colorCodes:   it.product?.colorCodes ?? [],
      colorImages:  (it.product as any)?.colorImages ?? [],
      images:       it.product?.images ?? [],
      size:         it.size,
      color:        it.color,
      quantity:     it.quantity,
      price:        it.price,
      confirmedAt:  it.confirmedAt,
      orderBatchId: it.orderBatchId,
      orderDate:    it.order.createdAt,
      note:         it.order.note,
    })));
  }

  // ── summary (쇼핑몰별 뷰 헤더용) — raw SQL GROUP BY, 전체 item 전송 없이 집계 ──
  const batchClause = batch && batch !== 'all'
    ? Prisma.sql`AND oi."orderBatchId" = ${batch}`
    : Prisma.empty;

  const summaryRows = await prisma.$queryRaw<Array<{
    brand: string; mall: string | null; distinctCount: bigint; totalQty: bigint;
  }>>`
    SELECT
      p.brand,
      b."mallLocation"                                             AS mall,
      COUNT(DISTINCT (oi."productId" || '|' || oi.color || '|' || oi.size)) AS "distinctCount",
      SUM(oi.quantity)                                             AS "totalQty"
    FROM   "OrderItem" oi
    JOIN   "Product"   p  ON p.id   = oi."productId"
    LEFT JOIN "Brand"  b  ON b.name = p.brand
    WHERE  oi."confirmedAt"  IS NOT NULL
      AND  oi."arrivedAt"    IS NULL
      AND  oi."cancelledAt"  IS NULL
      AND  oi."outOfStockAt" IS NULL
      AND  oi."unshippedAt"  IS NULL
      ${batchClause}
    GROUP  BY p.brand, b."mallLocation"
    ORDER  BY COALESCE(b."mallLocation", 'ㅎ') ASC, p.brand ASC
  `;

  return NextResponse.json(summaryRows.map((r) => ({
    brand:         r.brand ?? '',
    mall:          r.mall  ?? '',
    distinctCount: Number(r.distinctCount),
    totalQty:      Number(r.totalQty),
  })));
}
