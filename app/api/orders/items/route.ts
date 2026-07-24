import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';
import { isWithinTimeWindow } from '@/lib/utils';

function isWithinCancelWindow(cancelFrom: string | null, cancelTo: string | null): boolean {
  if (!cancelFrom || !cancelTo) return true;
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const cur = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const [fh, fm] = cancelFrom.split(':').map(Number);
  const [th, tm] = cancelTo.split(':').map(Number);
  const from = fh * 60 + fm;
  const to   = th * 60 + tm;
  return from <= to ? cur >= from && cur <= to : cur >= from || cur <= to;
}

async function syncUserBalance(userId: string) {
  const dep = await prisma.transaction.aggregate({ where: { userId, type: 'DEPOSIT' },    _sum: { amount: true } });
  const wd  = await prisma.transaction.aggregate({ where: { userId, type: 'WITHDRAWAL' }, _sum: { amount: true } });
  await prisma.user.update({ where: { id: userId }, data: { depositAmount: (dep._sum.amount ?? 0) - (wd._sum.amount ?? 0) } });
}

const ARRIVAL_WITHDRAWAL_DESC = '주문 상품 입고';

/** 주어진 시각이 속한 KST 달력일의 [00:00, 24:00) 구간을 UTC 기준으로 반환 */
function getKstDayRange(d: Date): { start: Date; end: Date } {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCHours(0, 0, 0, 0);
  const start = new Date(kst.getTime() - 9 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** 품절 처리로 true가 됐던 색상+사이즈 품절 플래그를, 품절 상태를 벗어나는 항목에 한해 원래대로(false) 복구 */
async function restoreOutOfStockFlags(itemIds: string[]) {
  const items = await prisma.orderItem.findMany({
    where: { id: { in: itemIds }, outOfStockAt: { not: null } },
    select: { id: true, productId: true, color: true, size: true },
  });
  for (const item of items) {
    await prisma.productVariant.updateMany({
      where: { productId: item.productId, color: item.color, size: item.size },
      data: { isOutOfStock: false },
    });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = hasAdminAccess((session.user as any)?.role);
  const userId  = (session.user as any)?.id;
  const body    = await req.json();
  const { itemIds, action, cancelLocked, arrivedAt, remark } = body;

  if (!itemIds?.length) return NextResponse.json({ error: 'itemIds 필요' }, { status: 400 });

  /* ── 취소잠금 설정 (admin) ── */
  if (cancelLocked !== undefined) {
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await prisma.orderItem.updateMany({ where: { id: { in: itemIds } }, data: { cancelLocked } });
    return NextResponse.json({ ok: true, count: itemIds.length });
  }

  /* ── 주문확인 처리 (admin) ── */
  if (action === 'confirm') {
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const now = new Date();
    await prisma.orderItem.updateMany({
      where: { id: { in: itemIds } },
      data: { confirmedAt: now },
    });
    const confirmedItems = await prisma.orderItem.findMany({ where: { id: { in: itemIds } }, select: { orderId: true } });
    const confirmedOrderIds = Array.from(new Set(confirmedItems.map((i) => i.orderId)));
    for (const orderId of confirmedOrderIds) {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });
    }
    return NextResponse.json({ ok: true, count: itemIds.length });
  }

  /* ── 품절 처리 (admin) — 다른 상태 먼저 초기화 + 해당 색상·사이즈를 품절로 표시 ── */
  if (action === 'outOfStock') {
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const now = new Date();

    // 아직 품절 처리되지 않은 항목만 품절 표시 (중복 처리 방지)
    const freshTargets = await prisma.orderItem.findMany({
      where: { id: { in: itemIds }, outOfStockAt: null },
      select: { id: true, productId: true, color: true, size: true },
    });
    for (const item of freshTargets) {
      await prisma.productVariant.updateMany({
        where: { productId: item.productId, color: item.color, size: item.size },
        data: { isOutOfStock: true },
      });
    }

    await prisma.orderItem.updateMany({
      where: { id: { in: itemIds } },
      data: { outOfStockAt: now, arrivedAt: null, cancelledAt: null, unshippedAt: null, remark: remark ?? null },
    });
    // 주문 상태 CONFIRMED 복구 (취소됐던 주문이면)
    const items = await prisma.orderItem.findMany({ where: { id: { in: itemIds } }, select: { orderId: true } });
    const orderIds = Array.from(new Set(items.map((i) => i.orderId)));
    for (const orderId of orderIds) {
      const allItems = await prisma.orderItem.findMany({ where: { orderId } });
      const allCancelled = allItems.every((it) => it.cancelledAt !== null);
      if (!allCancelled) await prisma.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });
    }
    return NextResponse.json({ ok: true, count: itemIds.length });
  }

  /* ── 미송 처리 (admin) — 품절→미송 전환 시 표시했던 품절 플래그만 복구 ── */
  if (action === 'unshipped') {
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await restoreOutOfStockFlags(itemIds);
    const now = new Date();
    await prisma.orderItem.updateMany({
      where: { id: { in: itemIds } },
      data: { unshippedAt: now, arrivedAt: null, cancelledAt: null, outOfStockAt: null, remark: remark ?? null },
    });
    const items = await prisma.orderItem.findMany({ where: { id: { in: itemIds } }, select: { orderId: true } });
    const orderIds = Array.from(new Set(items.map((i) => i.orderId)));
    for (const orderId of orderIds) {
      const allItems = await prisma.orderItem.findMany({ where: { orderId } });
      const allCancelled = allItems.every((it) => it.cancelledAt !== null);
      if (!allCancelled) await prisma.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });
    }
    return NextResponse.json({ ok: true, count: itemIds.length });
  }

  /* ── 비고만 수정 (admin) ── */
  if (action === 'updateRemark') {
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await prisma.orderItem.updateMany({
      where: { id: { in: itemIds } },
      data: { remark: remark ?? null },
    });
    return NextResponse.json({ ok: true });
  }

  /* ── 주문확인으로 되돌리기 (admin) ── */
  if (action === 'revertToConfirmed') {
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 품절 처리로 표시됐던 품절 플래그 복구
    await restoreOutOfStockFlags(itemIds);

    // 기존에 arrivedAt이 있던 항목 → 출금 취소(입금) 처리
    const arrivedItems = await prisma.orderItem.findMany({
      where: { id: { in: itemIds }, arrivedAt: { not: null } },
      include: { order: { select: { userId: true } } },
    });
    if (arrivedItems.length > 0) {
      const byUser = new Map<string, number>();
      for (const it of arrivedItems) {
        const uid = it.order.userId;
        byUser.set(uid, (byUser.get(uid) ?? 0) + it.price * it.quantity);
      }
      for (const [uid, amount] of Array.from(byUser)) {
        await prisma.transaction.create({
          data: { userId: uid, type: 'DEPOSIT', amount, description: '입고 취소 (주문확인으로 되돌리기)', date: new Date() },
        });
        await syncUserBalance(uid);
      }
    }

    // 모든 상태 플래그 초기화 + 주문확인 상태로 복구
    await prisma.orderItem.updateMany({
      where: { id: { in: itemIds } },
      data: { arrivedAt: null, cancelledAt: null, outOfStockAt: null, unshippedAt: null, confirmedAt: new Date() },
    });

    // 관련 주문 상태 CONFIRMED 복구
    const items = await prisma.orderItem.findMany({ where: { id: { in: itemIds } }, select: { orderId: true } });
    const orderIds = Array.from(new Set(items.map((i) => i.orderId)));
    for (const orderId of orderIds) {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });
    }
    return NextResponse.json({ ok: true, count: itemIds.length });
  }

  /* ── 관리자 강제 취소 (admin) ── */
  if (action === 'adminCancel') {
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 품절 처리로 표시됐던 품절 플래그 복구
    await restoreOutOfStockFlags(itemIds);

    // 기존에 arrivedAt이 있던 항목 → 출금 취소(입금) 처리
    const arrivedItems = await prisma.orderItem.findMany({
      where: { id: { in: itemIds }, arrivedAt: { not: null } },
      include: { order: { select: { userId: true } } },
    });
    if (arrivedItems.length > 0) {
      const byUser = new Map<string, number>();
      for (const it of arrivedItems) {
        const uid = it.order.userId;
        byUser.set(uid, (byUser.get(uid) ?? 0) + it.price * it.quantity);
      }
      for (const [uid, amount] of Array.from(byUser)) {
        await prisma.transaction.create({
          data: { userId: uid, type: 'DEPOSIT', amount, description: '관리자 취소 (입고 취소)', date: new Date() },
        });
        await syncUserBalance(uid);
      }
    }

    const now = new Date();
    await prisma.orderItem.updateMany({
      where: { id: { in: itemIds } },
      data: { cancelledAt: now, cancelledByAdmin: true, arrivedAt: null, outOfStockAt: null, unshippedAt: null },
    });

    // 주문 전체 취소 여부 확인
    const items = await prisma.orderItem.findMany({ where: { id: { in: itemIds } }, select: { orderId: true } });
    const orderIds = Array.from(new Set(items.map((i) => i.orderId)));
    for (const orderId of orderIds) {
      const remaining = await prisma.orderItem.findMany({ where: { orderId, cancelledAt: null } });
      if (remaining.length === 0) await prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    }
    return NextResponse.json({ ok: true, count: itemIds.length });
  }

  /* ── 배송 요청 (user or admin) ── */
  if (action === 'requestDelivery') {
    if (!isAdmin) {
      const deliveryPolicy = await prisma.deliveryPolicy.findFirst();
      if (deliveryPolicy?.enabled && !isWithinTimeWindow(deliveryPolicy.fromTime, deliveryPolicy.toTime))
        return NextResponse.json({ error: `배송 요청 가능 시간은 ${deliveryPolicy.fromTime} ~ ${deliveryPolicy.toTime} (서울 기준)입니다.` }, { status: 403 });

      const ownItems = await prisma.orderItem.findMany({
        where: { id: { in: itemIds } },
        include: { order: { select: { userId: true } } },
      });
      for (const item of ownItems) {
        if (item.order.userId !== userId)
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }
    await prisma.orderItem.updateMany({ where: { id: { in: itemIds } }, data: { deliveryRequestedAt: new Date() } });
    return NextResponse.json({ ok: true, count: itemIds.length });
  }

  /* ── 배송 요청 취소 (user or admin) ── */
  if (action === 'cancelDeliveryRequest') {
    if (!isAdmin) {
      const ownItems = await prisma.orderItem.findMany({
        where: { id: { in: itemIds } },
        include: { order: { select: { userId: true } } },
      });
      for (const item of ownItems) {
        if (item.order.userId !== userId)
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }
    await prisma.orderItem.updateMany({ where: { id: { in: itemIds } }, data: { deliveryRequestedAt: null } });
    return NextResponse.json({ ok: true, count: itemIds.length });
  }

  /* ── 아이템 취소 (user) ── */
  if (action === 'cancel') {
    // 비어드민: 정책 검사 먼저 (루프 전 1회)
    if (!isAdmin) {
      const policy = await prisma.cancelPolicy.findFirst();
      if (!policy?.globalEnabled)
        return NextResponse.json({ error: '현재 주문 취소가 비활성화 상태입니다.' }, { status: 403 });
      if (policy.cancelFrom && policy.cancelTo && !isWithinCancelWindow(policy.cancelFrom, policy.cancelTo))
        return NextResponse.json({ error: `취소 가능 시간은 ${policy.cancelFrom} ~ ${policy.cancelTo} (서울 기준)입니다.` }, { status: 403 });
    }

    const items = await prisma.orderItem.findMany({
      where: { id: { in: itemIds } },
      include: { order: true },
    });
    for (const item of items) {
      if (!isAdmin && item.order.userId !== userId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      if (item.cancelLocked)
        return NextResponse.json({ error: '취소 잠긴 상품이 포함되어 있습니다.' }, { status: 403 });
      if (item.cancelledAt)
        return NextResponse.json({ error: '이미 취소된 상품이 포함되어 있습니다.' }, { status: 400 });
      if (item.arrivedAt)
        return NextResponse.json({ error: '입고된 상품은 취소할 수 없습니다.' }, { status: 400 });
      if (!['PENDING', 'CONFIRMED'].includes(item.order.status))
        return NextResponse.json({ error: '취소할 수 없는 상태의 주문입니다.' }, { status: 400 });
    }
    const now = new Date();
    await prisma.orderItem.updateMany({ where: { id: { in: itemIds } }, data: { cancelledAt: now, cancelledByAdmin: false } });
    const affectedOrderIds = Array.from(new Set(items.map((i) => i.orderId)));
    for (const orderId of affectedOrderIds) {
      const remaining = await prisma.orderItem.findMany({ where: { orderId, cancelledAt: null } });
      if (remaining.length === 0) await prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    }
    return NextResponse.json({ ok: true, count: itemIds.length });
  }

  /* ── 입고 처리 (admin) — 다른 상태 초기화 후 arrivedAt 기록 + 자동 출금 ── */
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 품절 처리로 표시됐던 품절 플래그 복구 (실제로 입고되었으므로)
  await restoreOutOfStockFlags(itemIds);

  const date = arrivedAt ? new Date(arrivedAt) : new Date();

  // 기존에 arrivedAt이 없던 항목만 출금 처리 (중복 출금 방지)
  const notYetArrived = await prisma.orderItem.findMany({
    where: { id: { in: itemIds }, arrivedAt: null },
    include: { order: { select: { userId: true } } },
  });

  // 모든 대상 아이템: 다른 상태 초기화 + arrivedAt 설정
  await prisma.orderItem.updateMany({
    where: { id: { in: itemIds } },
    data: { arrivedAt: date, cancelledAt: null, outOfStockAt: null, unshippedAt: null },
  });

  // 관련 주문 상태 복구 (취소됐던 주문이면 CONFIRMED로)
  const allItems = await prisma.orderItem.findMany({ where: { id: { in: itemIds } }, select: { orderId: true } });
  const orderIds = Array.from(new Set(allItems.map((i) => i.orderId)));
  for (const orderId of orderIds) {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });
  }

  // 새로 입고된 항목만 출금 거래 생성 (같은 날짜에 이미 입고 출금 거래가 있으면 금액만 합산)
  const byUser = new Map<string, number>();
  for (const item of notYetArrived) {
    const uid = item.order.userId;
    byUser.set(uid, (byUser.get(uid) ?? 0) + item.price * item.quantity);
  }
  const { start: dayStart, end: dayEnd } = getKstDayRange(date);
  for (const [uid, amount] of Array.from(byUser)) {
    const existing = await prisma.transaction.findFirst({
      where: { userId: uid, type: 'WITHDRAWAL', description: ARRIVAL_WITHDRAWAL_DESC, date: { gte: dayStart, lt: dayEnd } },
    });
    if (existing) {
      await prisma.transaction.update({ where: { id: existing.id }, data: { amount: existing.amount + amount } });
    } else {
      await prisma.transaction.create({
        data: { userId: uid, type: 'WITHDRAWAL', amount, description: ARRIVAL_WITHDRAWAL_DESC, date },
      });
    }
    await syncUserBalance(uid);
  }

  return NextResponse.json({ ok: true, count: itemIds.length });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const arrivedToday  = searchParams.get('arrivedToday');
  const allArrived    = searchParams.get('allArrived');
  const date          = searchParams.get('date');
  const cancelled     = searchParams.get('cancelled');
  const cancelledToday = searchParams.get('cancelledToday');
  const outOfStockOrUnshipped = searchParams.get('outOfStockOrUnshipped');

  const isAdmin = hasAdminAccess((session.user as any)?.role);
  const userId  = (session.user as any)?.id;

  // 오늘(KST 자정) 취소 카운트
  if (cancelledToday === '1') {
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    nowKst.setUTCHours(0, 0, 0, 0);
    const kstMidnightUtc = new Date(nowKst.getTime() - 9 * 60 * 60 * 1000);
    const count = await prisma.orderItem.count({
      where: { cancelledAt: { gte: kstMidnightUtc } },
    });
    return NextResponse.json({ count });
  }

  // 3개월 기준일
  const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // 품절/미송 상품 조회 (90일 이내만)
  if (outOfStockOrUnshipped === '1') {
    const where: any = {
      OR: [
        { outOfStockAt: { not: null, gte: cutoff90 } },
        { unshippedAt:  { not: null, gte: cutoff90 } },
      ],
    };
    if (!isAdmin) where.order = { userId };
    // 3개월 지난 레코드 DB에서 삭제 (어드민/회원 모두 동일 기준)
    await prisma.orderItem.deleteMany({
      where: {
        OR: [
          { outOfStockAt: { lt: cutoff90 } },
          { unshippedAt:  { lt: cutoff90 } },
        ],
        cancelledAt: null,
        arrivedAt:   null,
      },
    });
    const items = await prisma.orderItem.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, images: true, brand: true, colors: true, colorImages: { select: { color: true, imageUrl: true } }, colorCodes: { select: { color: true, sequence: true } }, productNumber: true, isOnSale: true, saleType: true, saleValue: true } },
        order:   { select: { id: true, status: true, userId: true, createdAt: true, note: true, user: { select: { name: true, email: true } } } },
      },
      orderBy: { order: { createdAt: 'desc' } },
    });
    return NextResponse.json(items);
  }

  // 취소 상품 조회 (90일 이내만)
  if (cancelled === '1') {
    const where: any = { cancelledAt: { not: null, gte: cutoff90 } };
    if (!isAdmin) where.order = { userId };
    // 3개월 지난 취소 레코드 DB에서 삭제 (어드민/회원 모두 동일 기준)
    await prisma.orderItem.deleteMany({ where: { cancelledAt: { lt: cutoff90 } } });
    const items = await prisma.orderItem.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, images: true, brand: true, colors: true, colorImages: { select: { color: true, imageUrl: true } }, colorCodes: { select: { color: true, sequence: true } }, productNumber: true, isOnSale: true, saleType: true, saleValue: true } },
        order:   { select: { id: true, status: true, userId: true, createdAt: true, note: true, user: { select: { name: true, email: true } } } },
      },
      orderBy: { cancelledAt: 'desc' },
    });
    return NextResponse.json(items);
  }

  let arrivedFilter: any;
  if (arrivedToday === '1') {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end   = new Date(); end.setHours(23, 59, 59, 999);
    arrivedFilter = { gte: start, lte: end };
  } else if (date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);
    arrivedFilter = { gte: start, lte: end };
  } else {
    arrivedFilter = { not: null };
  }

  const where: any = { arrivedAt: arrivedFilter, cancelledAt: null };
  if (!isAdmin) where.order = { userId };

  const items = await prisma.orderItem.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, images: true, brand: true, colors: true, colorCodes: { select: { color: true, sequence: true } }, productNumber: true, isOnSale: true, saleType: true, saleValue: true } },
      order:   { select: { id: true, status: true, userId: true, createdAt: true, note: true, user: { select: { name: true, email: true } } } },
    },
    orderBy: { arrivedAt: 'desc' },
  });

  return NextResponse.json(items);
}
