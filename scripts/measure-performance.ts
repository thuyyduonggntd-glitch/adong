/**
 * measure-performance.ts — Đo thời gian truy vấn DB trực tiếp (giả lập API admin)
 *
 * Chạy:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/measure-performance.ts
 *
 * Kết quả: thời gian (ms) của các truy vấn chính mỗi trang admin.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const runs: number[] = [];
  let result!: T;
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    result = await fn();
    runs.push(Date.now() - start);
  }
  const warm = Math.round((runs[1] + runs[2]) / 2);
  const mark = warm < 200 ? '✅' : warm < 500 ? '⚠️ ' : '❌';
  console.log(
    `  ${mark} ${label.padEnd(44)} cold=${String(runs[0]).padStart(4)}ms  warm=${String(runs[1]).padStart(4)}/${String(runs[2]).padStart(4)}ms  avg=${String(warm).padStart(4)}ms`,
  );
  return result;
}

async function main() {
  console.log('=== 어드민 페이지 성능 측정 (DB 쿼리 직접 측정) ===\n');

  const now        = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const cutoff90   = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const defaultFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const PAGE_SIZE  = 50;

  /* ── 상품 관리 ── */
  console.log('📦 상품 관리 (상품 목록 1페이지):');
  await time('product.count (활성)', () => prisma.product.count({ where: { isActive: true } }));
  await time('product.findMany (50건, isActive=true)', () =>
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, price: true, brand: true, images: true, isActive: true, productNumber: true },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
    }),
  );

  /* ── 주문 관리: 초기 로드 ── */
  console.log('\n📋 주문 관리 (초기 로드 - orders-data):');
  await time('orderItem.count (주문접수)', () =>
    prisma.orderItem.count({
      where: { confirmedAt: null, arrivedAt: null, cancelledAt: null, outOfStockAt: null, unshippedAt: null },
    }),
  );
  await time('orderItem.count (주문확인)', () =>
    prisma.orderItem.count({
      where: { confirmedAt: { not: null }, arrivedAt: null, cancelledAt: null, outOfStockAt: null, unshippedAt: null },
    }),
  );
  await time('inbound.findMany (오늘)', () =>
    prisma.inbound.findMany({
      where: { arrivedAt: { gte: todayStart, lte: todayEnd } },
      include: { user: { select: { id: true, name: true } } },
    }),
  );
  await time('orderItem.findMany (오늘 입고)', () =>
    prisma.orderItem.findMany({
      where: { arrivedAt: { gte: todayStart, lte: todayEnd }, cancelledAt: null },
      select: { id: true, quantity: true, price: true, size: true, color: true, arrivedAt: true },
      orderBy: { arrivedAt: 'desc' },
    }),
  );
  await time('orderItem.findMany (품절/미송 90일)', () =>
    prisma.orderItem.findMany({
      where: {
        OR: [
          { outOfStockAt: { not: null, gte: cutoff90 } },
          { unshippedAt: { not: null, gte: cutoff90 } },
        ],
      },
      select: { id: true, quantity: true, price: true, size: true, color: true, outOfStockAt: true, unshippedAt: true },
      orderBy: { outOfStockAt: 'desc' },
    }),
  );

  /* ── 주문접수 탭 ── */
  console.log('\n📋 주문접수 탭:');
  await time('pending-items?mode=summary (쇼핑몰별)', () =>
    prisma.orderItem.findMany({
      where: { confirmedAt: null, arrivedAt: null, cancelledAt: null, outOfStockAt: null, unshippedAt: null },
      select: { id: true, quantity: true, size: true, color: true, product: { select: { id: true, brand: true } } },
    }),
  );
  await time('pending-items?mode=list&page=1 (전체 50건)', () =>
    prisma.orderItem.findMany({
      where: { confirmedAt: null, arrivedAt: null, cancelledAt: null, outOfStockAt: null, unshippedAt: null },
      select: { id: true, quantity: true, price: true, size: true, color: true, confirmedAt: true, product: { select: { id: true, name: true, brand: true } }, order: { select: { id: true, userId: true, status: true, createdAt: true } } },
      orderBy: { order: { createdAt: 'desc' } },
      take: PAGE_SIZE,
    }),
  );

  /* ── 주문확인 탭 ── */
  console.log('\n📋 주문확인 탭:');
  await time('confirmed-items?mode=summary (쇼핑몰별)', () =>
    prisma.orderItem.findMany({
      where: { confirmedAt: { not: null }, arrivedAt: null, cancelledAt: null, outOfStockAt: null, unshippedAt: null },
      select: { id: true, quantity: true, size: true, color: true, product: { select: { id: true, brand: true } } },
    }),
  );
  await time('confirmed-items?mode=list&page=1 (전체 50건)', () =>
    prisma.orderItem.findMany({
      where: { confirmedAt: { not: null }, arrivedAt: null, cancelledAt: null, outOfStockAt: null, unshippedAt: null },
      select: { id: true, quantity: true, price: true, size: true, color: true, confirmedAt: true, product: { select: { id: true, name: true, brand: true } }, order: { select: { id: true, userId: true, status: true, createdAt: true } } },
      orderBy: { confirmedAt: 'desc' },
      take: PAGE_SIZE,
    }),
  );

  /* ── 전체입고 탭 ── */
  console.log('\n📦 전체입고 탭 (날짜 범위 90일):');
  await time('orderItem.findMany (arrivedAt 90일)', () =>
    prisma.orderItem.findMany({
      where: { arrivedAt: { gte: defaultFrom, lte: now }, cancelledAt: null },
      select: { id: true, quantity: true, price: true, size: true, color: true, arrivedAt: true },
      orderBy: { arrivedAt: 'desc' },
    }),
  );
  await time('inbound.findMany (arrivedAt 90일)', () =>
    prisma.inbound.findMany({
      where: { arrivedAt: { gte: defaultFrom, lte: now } },
      include: { user: { select: { id: true, name: true } }, items: { select: { id: true, quantity: true, price: true, size: true, color: true } } },
      orderBy: { arrivedAt: 'desc' },
    }),
  );

  /* ── 회원 관리 ── */
  console.log('\n👤 회원 관리:');
  await time('user.count', () => prisma.user.count());
  await time('user.findMany (50건)', () =>
    prisma.user.findMany({
      select: { id: true, email: true, name: true, shopName: true, role: true, dealerGrade: true, isActive: true, depositAmount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
    }),
  );

  /* ── 거래 내역 ── */
  console.log('\n💰 거래 내역:');
  await time('transaction.count', () => prisma.transaction.count());
  await time('transaction.findMany (50건)', () =>
    prisma.transaction.findMany({
      select: { id: true, type: true, amount: true, description: true, date: true, user: { select: { name: true, email: true } } },
      orderBy: { date: 'desc' },
      take: PAGE_SIZE,
    }),
  );

  /* ── 대시보드 (실제 /api/dashboard/stats 쿼리) ── */
  console.log('\n📊 대시보드 (/api/dashboard/stats 실제 쿼리):');
  await time('order.count (전체)', () => prisma.order.count());
  await time('order.count (PENDING)', () => prisma.order.count({ where: { status: 'PENDING' } }));
  await time('order.aggregate totalAmount', () =>
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { status: { in: ['CONFIRMED', 'SHIPPING', 'DELIVERED'] } } }),
  );
  await time('user.count (USER role)', () => prisma.user.count({ where: { role: 'USER' } }));
  await time('order.findMany recentOrders top10', () =>
    prisma.order.findMany({
      take: 10, orderBy: { createdAt: 'desc' },
      select: { id: true, totalAmount: true, createdAt: true, status: true, user: { select: { name: true } }, items: { select: { product: { select: { name: true } } }, take: 1 } },
    }),
  );
  await time('대시보드 전체 (5 쿼리 병렬)', () =>
    Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.aggregate({ _sum: { totalAmount: true }, where: { status: { in: ['CONFIRMED', 'SHIPPING', 'DELIVERED'] } } }),
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.order.findMany({ take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, totalAmount: true, createdAt: true, status: true } }),
    ]),
  );

  /* ── 기준 요약 ── */
  console.log('\n기준: ✅ <200ms   ⚠️  200~599ms   ❌ ≥600ms');
  console.log('\n=== 측정 완료 ===\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
