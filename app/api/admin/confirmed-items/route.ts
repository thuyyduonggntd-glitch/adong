import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasOrdersAccess } from '@/lib/adminAccess';

// Confirmed-but-not-yet-arrived items — server-side data for
// 쇼핑몰별 view, 카톡 메시지, 영수증 대조
//
// GET /api/admin/confirmed-items
//   ?mode=summary              → brand-level totals for the mall view header
//   ?mode=detail&brand=X       → all items for one brand (for accordion body, kakaotalk, invoice)
//   &batch=all | <batchId>     → filter by batch (default: all)
//   &scope=waiting | all       → 'waiting'=확인대기만, 'all'=모든확인(영수증 전체 대상)

const ITEM_SELECT = {
  id: true, quantity: true, price: true, size: true, color: true,
  confirmedAt: true, orderBatchId: true,
  order: {
    select: {
      id: true, createdAt: true, note: true,
      user: { select: { name: true } },
    },
  },
  product: {
    select: {
      id: true, name: true, images: true, brand: true, productNumber: true,
      colorCodes: { select: { color: true, code: true } },
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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasOrdersAccess((session.user as any)?.role, (session.user as any)?.adminZones))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode  = searchParams.get('mode')  ?? 'summary';
  const batch = searchParams.get('batch') ?? 'all';
  const brand = searchParams.get('brand') ?? undefined;

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

  // ── summary (쇼핑몰별 뷰 헤더용) ───────────────────────────────────────────
  const where = buildWhere(batch, 'waiting');
  const items = await prisma.orderItem.findMany({
    where,
    select: {
      id: true, quantity: true, size: true, color: true, orderBatchId: true,
      product: { select: { id: true, brand: true } },
    },
  });

  // brand → mall map from Brand table
  const brandRows = await prisma.brand.findMany({ select: { name: true, mallLocation: true } });
  const mallMap: Record<string, string> = {};
  brandRows.forEach((b) => { if (b.mallLocation) mallMap[b.name] = b.mallLocation; });

  // aggregate per brand
  const byBrand = new Map<string, { mall: string; distinctKeys: Set<string>; totalQty: number }>();
  for (const it of items) {
    const b = it.product?.brand ?? '';
    if (!b) continue;
    if (!byBrand.has(b)) byBrand.set(b, { mall: mallMap[b] ?? '', distinctKeys: new Set(), totalQty: 0 });
    const entry = byBrand.get(b)!;
    entry.distinctKeys.add(`${it.product?.id}::${it.color}::${it.size}`);
    entry.totalQty += it.quantity;
  }

  const summary = Array.from(byBrand.entries()).map(([brand, d]) => ({
    brand,
    mall: d.mall,
    distinctCount: d.distinctKeys.size,
    totalQty: d.totalQty,
  })).sort((a, b) => (a.mall || 'ㅎ').localeCompare(b.mall || 'ㅎ', 'ko') || a.brand.localeCompare(b.brand, 'ko'));

  return NextResponse.json(summary);
}
