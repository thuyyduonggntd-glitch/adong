/**
 * seed-test-data.ts — Tạo ~1000 sản phẩm thử + ~1200 OrderItem thử rải 30 ngày
 *
 * Chạy:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-test-data.ts
 *
 * Yêu cầu: có ít nhất 1 tài khoản ADMIN trong DB.
 * Xóa:  npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/delete-test-data.ts
 *
 * Đặc điểm:
 *   - Sản phẩm thử: isActive=false, name bắt đầu "[TEST]", productNumber bắt đầu "TEST-",
 *     remark='__TEST_DATA__' → ẩn khỏi trang bán hàng, không ảnh hưởng TOP 10.
 *   - Tài khoản thử: email kết thúc @test.kkumbb.local
 *   - KHÔNG gửi thông báo, KHÔNG upload ảnh mới (tái dùng URL ảnh thật của brand đó)
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEST_DOMAIN  = '@test.kkumbb.local';
const TEST_MARKER  = '__TEST_DATA__';
const USER_COUNT   = 17;
const PRODUCTS_PER_BRAND_MIN = 30;
const PRODUCTS_PER_BRAND_MAX = 45;
const DAYS         = 30;          // rải đơn 30 ngày
const ITEMS_PER_DAY_MIN = 30;
const ITEMS_PER_DAY_MAX = 50;
const TODAY_ARRIVALS = 50;        // số item arrivedAt=hôm nay (일별입고)

/* ── helpers ──────────────────────────────────────────────────────────────── */
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
/** N ngày trước, giờ ngẫu nhiên trong [hMin, hMax] */
function dAgo(n: number, hMin = 9, hMax = 19): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(rand(hMin, hMax), rand(0, 59), rand(0, 59), 0);
  return d;
}
function todayAt(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}
async function runBatch<T>(
  items: T[],
  size: number,
  fn: (item: T, idx: number) => Promise<unknown>,
) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map((item, j) => fn(item, i + j)));
  }
}

/* ── Phase 0: xóa dữ liệu thử cũ ────────────────────────────────────────── */
async function cleanExisting() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: TEST_DOMAIN } },
    select: { id: true },
  });
  const products = await prisma.product.findMany({
    where: { remark: TEST_MARKER },
    select: { id: true },
  });

  if (users.length === 0 && products.length === 0) return;

  const userIds    = users.map((u) => u.id);
  const productIds = products.map((p) => p.id);

  if (userIds.length > 0) {
    await prisma.invoiceReceiptItem.deleteMany({
      where: { orderItem: { order: { userId: { in: userIds } } } },
    });
    await prisma.orderItem.deleteMany({
      where: { order: { userId: { in: userIds } } },
    });
    // 빈 발주 차수 정리
    await prisma.orderBatch.deleteMany({ where: { items: { none: {} } } });
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.transaction.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.cartItem.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.wishlist.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.shipping.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  if (productIds.length > 0) {
    await prisma.productVariant.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.productColorImage.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.productColorCode.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.productPrice.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.cartItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.wishlist.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  }
  console.log(
    `♻️  기존 테스트 데이터 삭제: 사용자 ${users.length}명, 상품 ${products.length}개`,
  );
}

/* ── Phase 1: lấy template từ brand thật ────────────────────────────────── */
type BrandTpl = {
  brand: string;
  images: string[];
  sizes: string[];
  colors: string[];
  basePrice: number;
};

async function getBrandTemplates(): Promise<BrandTpl[]> {
  const brands = await prisma.brand.findMany({ select: { name: true }, orderBy: { name: 'asc' } });
  const templates: BrandTpl[] = [];

  for (const { name } of brands) {
    const p = await prisma.product.findFirst({
      where: { brand: name, isActive: true, images: { isEmpty: false } },
      select: { images: true, sizes: true, colors: true, price: true },
    });
    if (p && p.sizes.length > 0 && p.colors.length > 0) {
      templates.push({
        brand:     name,
        images:    p.images.slice(0, 2),        // 최대 2장만 재사용
        sizes:     p.sizes.slice(0, 5),
        colors:    p.colors.slice(0, 4),
        basePrice: p.price,
      });
    }
    if (templates.length >= 28) break;
  }
  return templates;
}

/* ── Phase 2: 테스트 상품 생성 ────────────────────────────────────────────── */
async function createTestProducts(templates: BrandTpl[]) {
  const rows: any[] = [];
  for (const tpl of templates) {
    const count = rand(PRODUCTS_PER_BRAND_MIN, PRODUCTS_PER_BRAND_MAX);
    const brandKey = tpl.brand.replace(/\s+/g, '').toUpperCase().slice(0, 6);
    for (let i = 0; i < count; i++) {
      const price = Math.max(5000, Math.round((tpl.basePrice + rand(-20, 30) * 1000) / 1000) * 1000);
      rows.push({
        name:          `[TEST] ${tpl.brand} 상품 ${String(i + 1).padStart(3, '0')}`,
        description:   '[TEST] 자동 생성된 테스트 상품입니다. 고객 화면에 표시되지 않습니다.',
        price,
        images:        tpl.images,
        brand:         tpl.brand,
        productNumber: `TEST-${brandKey}-${String(i + 1).padStart(3, '0')}`,
        sizes:         tpl.sizes.slice(0, rand(2, Math.min(4, tpl.sizes.length))),
        colors:        tpl.colors.slice(0, rand(1, Math.min(3, tpl.colors.length))),
        isActive:      false,     // 고객 화면에 표시 안 됨
        remark:        TEST_MARKER,
      });
    }
  }

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await prisma.product.createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: true });
    process.stdout.write(`\r  상품 생성: ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  process.stdout.write('\n');

  const rawProds = await prisma.product.findMany({
    where: { remark: TEST_MARKER },
    select: { id: true, brand: true, sizes: true, colors: true, price: true },
  });
  return rawProds.map((p) => ({ ...p, brand: p.brand ?? '' }));
}

/* ── Phase 3: 테스트 사용자 생성 ──────────────────────────────────────────── */
async function createTestUsers() {
  const pwHash = await bcrypt.hash('TestPass123!', 10);
  const grades: any[] = ['REGULAR', 'REGULAR', 'REGULAR', 'SILVER', 'SILVER', 'GOLD'];
  return Promise.all(
    Array.from({ length: USER_COUNT }, (_, i) => {
      const n = String(i + 1).padStart(2, '0');
      return prisma.user.create({
        data: {
          email:       `test-${n}${TEST_DOMAIN}`,
          name:        `[TEST]회원${n}`,
          password:    pwHash,
          shopName:    `[TEST]샵${n}`,
          isActive:    true,
          dealerGrade: grades[i % grades.length],
        },
        select: { id: true },
      });
    }),
  );
}

/* ── Phase 4: 주문 생성 ───────────────────────────────────────────────────── */
type Prod = { id: string; brand: string; sizes: string[]; colors: string[]; price: number };
type User = { id: string };

async function createOrders(products: Prod[], users: User[], adminId: string) {
  // 영수증 대조 테스트용: 일부 상품은 여러 고객이 여러 날 주문
  // → products의 앞 50개를 "반복 주문용"으로 지정
  const HOT_POOL = products.slice(0, Math.min(50, products.length));
  const pickProd = (seed: number): Prod => {
    if (Math.random() < 0.35) return HOT_POOL[seed % HOT_POOL.length]; // 35% 확률로 hot pool
    return products[seed % products.length];
  };

  // confirmed item IDs per batch window (2일 단위)
  const batchWindows = new Map<number, string[]>();

  let seedN = 0;
  let statPending = 0, statConfirmed = 0, statArrived = 0, statOusu = 0;

  /* ── 30일치 주문 ── */
  for (let day = DAYS; day >= 1; day--) {
    const targetItems = rand(ITEMS_PER_DAY_MIN, ITEMS_PER_DAY_MAX);
    const ordersCount  = Math.ceil(targetItems / 2);
    const tasks: (() => Promise<void>)[] = [];

    for (let o = 0; o < ordersCount; o++) {
      const user = users[seedN % users.length];
      const p1   = pickProd(seedN);
      const p2   = pickProd(seedN + 11);
      seedN++;

      const createdAt = dAgo(day, 9, 21);
      const items: any[] = [];

      /* 상태 결정 */
      const r = Math.random();
      let orderStatus: 'PENDING' | 'CONFIRMED' = 'PENDING';
      let batchWindow: number | null = null;

      if (day >= 13) {
        // 오래된 주문 대부분 입고됨
        if (r < 0.80) {
          // 입고됨
          const confirmedAt = dAgo(day + rand(1, 3), 9, 17);
          const arrivedAt   = dAgo(day - rand(0, 1), 9, 18);
          orderStatus = 'CONFIRMED';
          for (let k = 0; k < 2; k++) {
            const p = k === 0 ? p1 : p2;
            items.push({ productId: p.id, quantity: rand(1, 3), price: p.price, size: pick(p.sizes), color: pick(p.colors), confirmedAt, arrivedAt });
          }
          statArrived += 2;
        } else if (r < 0.92) {
          // 품절/미송
          const confirmedAt = dAgo(day + 2, 9, 15);
          const ousuAt      = dAgo(day - 1, 10, 16);
          const isOOS       = Math.random() < 0.55;
          orderStatus = 'CONFIRMED';
          const p = p1;
          items.push({
            productId: p.id, quantity: 1, price: p.price, size: pick(p.sizes), color: pick(p.colors),
            confirmedAt,
            ...(isOOS ? { outOfStockAt: ousuAt, remark: '[TEST] 품절' } : { unshippedAt: ousuAt, remark: '[TEST] 미송' }),
          });
          statOusu++;
        } else {
          // 아직 주문접수 (소수)
          orderStatus = 'PENDING';
          for (let k = 0; k < 2; k++) {
            const p = k === 0 ? p1 : p2;
            items.push({ productId: p.id, quantity: 1, price: p.price, size: pick(p.sizes), color: pick(p.colors) });
          }
          statPending += 2;
        }
      } else if (day >= 6) {
        // 중간 주문: 일부 확인, 일부 접수
        if (r < 0.65) {
          // 주문확인
          const confirmedAt = dAgo(day - rand(0, 1), 9, 17);
          orderStatus = 'CONFIRMED';
          batchWindow = Math.floor((day - 6) / 2);
          for (let k = 0; k < 2; k++) {
            const p = k === 0 ? p1 : p2;
            items.push({ productId: p.id, quantity: rand(1, 2), price: p.price, size: pick(p.sizes), color: pick(p.colors), confirmedAt });
          }
          statConfirmed += 2;
        } else {
          // 주문접수
          orderStatus = 'PENDING';
          for (let k = 0; k < 2; k++) {
            const p = k === 0 ? p1 : p2;
            items.push({ productId: p.id, quantity: 1, price: p.price, size: pick(p.sizes), color: pick(p.colors) });
          }
          statPending += 2;
        }
      } else {
        // 최근 주문: 거의 다 접수
        if (r < 0.15 && day >= 3) {
          // 소수 주문확인
          const confirmedAt = dAgo(1, 9, 17);
          orderStatus = 'CONFIRMED';
          batchWindow = 0;
          for (let k = 0; k < 2; k++) {
            const p = k === 0 ? p1 : p2;
            items.push({ productId: p.id, quantity: 1, price: p.price, size: pick(p.sizes), color: pick(p.colors), confirmedAt });
          }
          statConfirmed += 2;
        } else {
          orderStatus = 'PENDING';
          for (let k = 0; k < 2; k++) {
            const p = k === 0 ? p1 : p2;
            items.push({ productId: p.id, quantity: 1, price: p.price, size: pick(p.sizes), color: pick(p.colors) });
          }
          statPending += 2;
        }
      }

      const capturedWindow = batchWindow;
      tasks.push(async () => {
        const totalAmount = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
        const order = await prisma.order.create({
          data: {
            userId: user.id,
            totalAmount,
            status: orderStatus,
            note: `[TEST] ${day}일전`,
            createdAt,
            items: { create: items },
          },
          include: { items: { select: { id: true } } },
        });
        if (capturedWindow !== null && capturedWindow >= 0) {
          const list = batchWindows.get(capturedWindow) ?? [];
          order.items.forEach((it) => list.push(it.id));
          batchWindows.set(capturedWindow, list);
        }
      });
    }

    await runBatch(tasks, 6, (fn) => fn());
    process.stdout.write(`\r  주문 생성: ${DAYS - day + 1}/${DAYS}일 완료`);
  }

  /* ── 오늘 입고 (일별입고용) ── */
  const todayTasks: (() => Promise<void>)[] = [];
  for (let i = 0; i < Math.ceil(TODAY_ARRIVALS / 2); i++) {
    const user = users[seedN % users.length];
    const p1   = pickProd(seedN);
    const p2   = pickProd(seedN + 5);
    seedN++;
    const confirmedAt = dAgo(rand(3, 5), 9, 17);
    const arrivedAt   = todayAt(9 + Math.floor(i / 8), (i % 8) * 7);
    todayTasks.push(async () => {
      await prisma.order.create({
        data: {
          userId: user.id,
          totalAmount: p1.price + p2.price,
          status: 'CONFIRMED',
          note: '[TEST] 일별입고(오늘)',
          items: {
            create: [
              { productId: p1.id, quantity: rand(1, 3), price: p1.price, size: pick(p1.sizes), color: pick(p1.colors), confirmedAt, arrivedAt },
              { productId: p2.id, quantity: rand(1, 2), price: p2.price, size: pick(p2.sizes), color: pick(p2.colors), confirmedAt, arrivedAt },
            ],
          },
        },
      });
      statArrived += 2;
    });
  }
  await runBatch(todayTasks, 6, (fn) => fn());
  process.stdout.write('\n');

  /* ── 발주 차수 (OrderBatch) 생성 ── */
  if (batchWindows.size > 0) {
    let batchCount = 0;
    const windowEntries = Array.from(batchWindows.entries());
    for (const entry of windowEntries) {
      const [win, itemIds] = entry;
      if (itemIds.length === 0) continue;
      const batchCreatedAt = dAgo(6 + win * 2, 10, 16);
      await prisma.orderBatch.create({
        data: {
          adminId:  adminId,
          itemCount: itemIds.length,
          createdAt: batchCreatedAt,
          items: { connect: itemIds.map((itemId: string) => ({ id: itemId })) },
        },
      });
      batchCount++;
    }
    console.log(`  ✅ 발주 차수 ${batchCount}개 생성`);
  }

  return { statPending, statConfirmed, statArrived, statOusu };
}

/* ── main ─────────────────────────────────────────────────────────────────── */
async function main() {
  console.log('=== 테스트 데이터 대용량 생성 시작 ===\n');

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, email: true },
  });
  if (!admin) {
    console.error('❌ ADMIN 사용자를 찾을 수 없습니다. 먼저 관리자 계정을 생성해 주세요.');
    process.exit(1);
  }
  console.log(`🔑 관리자 계정 확인: ${admin.email}`);

  // 0. 기존 테스트 데이터 삭제
  await cleanExisting();

  // 1. 브랜드 템플릿
  process.stdout.write('\n🏷️  브랜드 정보 수집 중...');
  const templates = await getBrandTemplates();
  process.stdout.write(` ${templates.length}개 브랜드 확인\n`);
  console.log(`   ${templates.map((t) => t.brand).join(', ')}\n`);

  // 2. 테스트 상품
  console.log('📦 테스트 상품 생성 중...');
  const products = await createTestProducts(templates);
  console.log(`  ✅ 테스트 상품 ${products.length}개 생성 (isActive=false)\n`);

  // 3. 테스트 사용자
  process.stdout.write(`👤 테스트 사용자 ${USER_COUNT}명 생성 중...`);
  const users = await createTestUsers();
  process.stdout.write(` 완료\n\n`);

  // 4. 주문 생성
  console.log(`📋 주문 생성 중 (${DAYS}일치 + 오늘 입고)...`);
  const stats = await createOrders(products, users, admin.id);

  // 5. DB에서 최종 집계
  const TEST_USER_WHERE = { email: { endsWith: TEST_DOMAIN } };
  const [
    totalProds,
    totalUsers,
    totalOrders,
    totalItems,
    dbPending,
    dbConfirmed,
    dbArrived,
    dbOusu,
    dbBatches,
  ] = await Promise.all([
    prisma.product.count({ where: { remark: TEST_MARKER } }),
    prisma.user.count({ where: TEST_USER_WHERE }),
    prisma.order.count({ where: { user: TEST_USER_WHERE } }),
    prisma.orderItem.count({ where: { order: { user: TEST_USER_WHERE } } }),
    prisma.orderItem.count({
      where: {
        confirmedAt: null, arrivedAt: null, cancelledAt: null,
        outOfStockAt: null, unshippedAt: null,
        order: { user: TEST_USER_WHERE },
      },
    }),
    prisma.orderItem.count({
      where: {
        confirmedAt: { not: null }, arrivedAt: null, cancelledAt: null,
        outOfStockAt: null, unshippedAt: null,
        order: { user: TEST_USER_WHERE },
      },
    }),
    prisma.orderItem.count({
      where: { arrivedAt: { not: null }, cancelledAt: null, order: { user: TEST_USER_WHERE } },
    }),
    prisma.orderItem.count({
      where: {
        OR: [{ outOfStockAt: { not: null } }, { unshippedAt: { not: null } }],
        order: { user: TEST_USER_WHERE },
      },
    }),
    prisma.orderBatch.count(),
  ]);

  console.log('\n╔═══════════════════════════════════╗');
  console.log('║      생성 완료 요약               ║');
  console.log('╠═══════════════════════════════════╣');
  console.log(`║  테스트 상품   : ${String(totalProds).padStart(5)}개            ║`);
  console.log(`║  테스트 사용자 : ${String(totalUsers).padStart(5)}명            ║`);
  console.log(`║  주문          : ${String(totalOrders).padStart(5)}건            ║`);
  console.log(`║  주문 아이템   : ${String(totalItems).padStart(5)}건            ║`);
  console.log(`║    └ 주문접수  : ${String(dbPending).padStart(5)}건            ║`);
  console.log(`║    └ 주문확인  : ${String(dbConfirmed).padStart(5)}건            ║`);
  console.log(`║    └ 입고됨    : ${String(dbArrived).padStart(5)}건            ║`);
  console.log(`║    └ 품절/미송 : ${String(dbOusu).padStart(5)}건            ║`);
  console.log(`║  발주 차수     : ${String(dbBatches).padStart(5)}개 (전체)     ║`);
  console.log('╚═══════════════════════════════════╝');
  console.log('\n✅ 완료. 로컬: http://localhost:3003/admin/orders');
  console.log('삭제: npx ts-node --compiler-options \'{"module":"CommonJS"}\' scripts/delete-test-data.ts\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
