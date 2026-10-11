import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasOrdersAccess } from '@/lib/adminAccess';

function toKSTDate(d: Date) {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000);
}
function getKstDayRange(d: Date) {
  const start = toKSTDate(d);
  return { start, end: new Date(start.getTime() + 86400000) };
}

// GET /api/admin/invoice-receipts?brand=X — 최근 20건 이력
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasOrdersAccess((session.user as any)?.role, (session.user as any)?.adminZones))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const brand = searchParams.get('brand');
  if (!brand) return NextResponse.json({ error: 'brand required' }, { status: 400 });

  const receipts = await prisma.invoiceReceipt.findMany({
    where: { brand },
    include: {
      items: {
        include: {
          orderItem: {
            select: {
              id: true, size: true, color: true, quantity: true,
              product: {
                select: {
                  id: true, name: true, brand: true, images: true,
                  colorImages: { select: { color: true, imageUrl: true }, orderBy: { sequence: 'asc' } },
                },
              },
              order: { select: { createdAt: true, user: { select: { name: true } } } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json(receipts);
}

// POST /api/admin/invoice-receipts
// Body: { brand, totalQty, checkedQty, receiptNumber?, imageUrl?, rawText?,
//         arrivedItemIds: string[],   // items to mark as arrived
//         partialMap?: {[itemId]: quantity}  // partial arrival quantities (not used v1)
//       }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasOrdersAccess((session.user as any)?.role, (session.user as any)?.adminZones))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { brand, totalQty, checkedQty, receiptNumber, imageUrl, rawText, arrivedItemIds } = body;

  if (!brand || !Array.isArray(arrivedItemIds) || arrivedItemIds.length === 0)
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });

  // 영수증 번호 중복 체크 (같은 브랜드 내)
  if (receiptNumber) {
    const dup = await prisma.invoiceReceipt.findFirst({ where: { brand, receiptNumber } });
    if (dup) return NextResponse.json({ error: `영수증 번호 '${receiptNumber}'는 이미 등록됐습니다.` }, { status: 409 });
  }

  const now = new Date();

  // 입고 처리 (기존 /api/orders/items PATCH 입고 로직 그대로)
  const ARRIVAL_DESC = '주문 상품 입고';

  // 품절 플래그 복구
  const outOfStockItems = await prisma.orderItem.findMany({
    where: { id: { in: arrivedItemIds }, outOfStockAt: { not: null } },
    select: { productId: true, color: true, size: true },
  });
  for (const item of outOfStockItems) {
    await prisma.productVariant.updateMany({
      where: { productId: item.productId, color: item.color, size: item.size },
      data: { isOutOfStock: false },
    });
  }

  // 새로 입고되는 항목만 출금 처리
  const notYetArrived = await prisma.orderItem.findMany({
    where: { id: { in: arrivedItemIds }, arrivedAt: null },
    include: { order: { select: { userId: true } } },
  });

  await prisma.orderItem.updateMany({
    where: { id: { in: arrivedItemIds } },
    data: { arrivedAt: now, cancelledAt: null, outOfStockAt: null, unshippedAt: null },
  });

  // 주문 상태 CONFIRMED 유지
  const allItems = await prisma.orderItem.findMany({ where: { id: { in: arrivedItemIds } }, select: { orderId: true } });
  const orderIds = Array.from(new Set(allItems.map((i) => i.orderId)));
  for (const orderId of orderIds) {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });
  }

  // 출금 거래 생성 (하루 1건 합산)
  const byUser = new Map<string, number>();
  for (const it of notYetArrived) {
    const uid = it.order.userId;
    byUser.set(uid, (byUser.get(uid) ?? 0) + it.price * it.quantity);
  }
  const { start: dayStart, end: dayEnd } = getKstDayRange(now);
  for (const [uid, amount] of Array.from(byUser)) {
    const existing = await prisma.transaction.findFirst({
      where: { userId: uid, type: 'WITHDRAWAL', description: ARRIVAL_DESC, date: { gte: dayStart, lt: dayEnd } },
    });
    if (existing) {
      await prisma.transaction.update({ where: { id: existing.id }, data: { amount: existing.amount + amount } });
    } else {
      await prisma.transaction.create({ data: { userId: uid, type: 'WITHDRAWAL', amount, description: ARRIVAL_DESC, date: now } });
    }
    // balance sync
    const dep = await prisma.transaction.aggregate({ where: { userId: uid, type: 'DEPOSIT'    }, _sum: { amount: true } });
    const wd  = await prisma.transaction.aggregate({ where: { userId: uid, type: 'WITHDRAWAL' }, _sum: { amount: true } });
    await prisma.user.update({ where: { id: uid }, data: { depositAmount: (dep._sum.amount ?? 0) - (wd._sum.amount ?? 0) } });
  }

  // 이력 저장
  const arrivedItemsForSnapshot = await prisma.orderItem.findMany({
    where: { id: { in: arrivedItemIds } },
    select: { id: true, confirmedAt: true },
  });
  const receipt = await prisma.invoiceReceipt.create({
    data: {
      brand, totalQty, checkedQty,
      receiptNumber: receiptNumber || null,
      imageUrl: imageUrl || null,
      rawText: rawText || null,
      items: {
        create: arrivedItemsForSnapshot.map((it) => ({
          orderItemId: it.id,
          confirmedAt: it.confirmedAt,
        })),
      },
    },
  });

  return NextResponse.json({ ok: true, receiptId: receipt.id, arrivedCount: arrivedItemIds.length });
}
