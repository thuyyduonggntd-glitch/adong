/**
 * 테스트 데이터 생성 스크립트 (대용량 버전)
 *
 * 실행:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-test-data.ts
 *
 * 목표 행 수:
 *   주문접수  ~120건  (PENDING, item timestamps 없음)
 *   주문확인  ~80건   (CONFIRMED, confirmedAt 만, 여러 날짜)
 *   일별입고  ~60건   (arrivedAt = 오늘)
 *   전체입고  ~90건   (일별 60 + 과거 30)
 *   품절/미송 ~8건 표시 + 2건 90일 초과(크론 삭제 테스트용)
 *
 * 사용 상품: DB에서 20개 브랜드 × 상품 실제 데이터 사용
 * 삭제: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/delete-test-data.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const TEST_DOMAIN = '@test.kkumbb.local';

/* 병렬 실행 배치 헬퍼 (DB 연결 과부하 방지) */
async function batch<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

async function cleanExisting() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: TEST_DOMAIN } },
    select: { id: true },
  });
  if (users.length === 0) return;
  const ids = users.map((u) => u.id);
  await prisma.orderItem.deleteMany({ where: { order: { userId: { in: ids } } } });
  await prisma.order.deleteMany({ where: { userId: { in: ids } } });
  await prisma.transaction.deleteMany({ where: { userId: { in: ids } } });
  await prisma.cartItem.deleteMany({ where: { userId: { in: ids } } });
  await prisma.wishlist.deleteMany({ where: { userId: { in: ids } } });
  await prisma.shipping.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`♻️  기존 테스트 데이터 삭제 완료 (사용자 ${users.length}명)`);
}

async function main() {
  console.log('=== 테스트 데이터 생성 (대용량) ===\n');

  // ── 0. 기존 테스트 데이터 삭제 ──────────────────────────────────────────
  await cleanExisting();

  // ── 1. 실제 상품 수집 (20개 브랜드, 각 1개) ─────────────────────────────
  const brandRows = await prisma.product.findMany({
    where: { isActive: true, brand: { not: null } },
    select: { brand: true },
    distinct: ['brand'],
    take: 25,
    orderBy: { brand: 'asc' },
  });

  type Prod = { id: string; brand: string | null; price: number; sizes: string[]; colors: string[] };
  const products: Prod[] = [];
  for (const { brand } of brandRows) {
    const p = await prisma.product.findFirst({
      where: { isActive: true, brand: brand! },
      select: { id: true, brand: true, price: true, sizes: true, colors: true },
    });
    if (p && p.sizes.length > 0 && p.colors.length > 0) products.push(p);
    if (products.length >= 20) break;
  }
  const brandCount = Array.from(new Set(products.map((p) => p.brand))).length;
  console.log(`✅ 실제 상품 ${products.length}개 수집 (${brandCount}개 브랜드)`);

  const pickProd = (i: number): Prod => products[i % products.length];

  // ── 2. 테스트 사용자 생성 (5명) ─────────────────────────────────────────
  const pwHash = await bcrypt.hash('TestPass123!', 10);
  const users = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      prisma.user.create({
        data: {
          email: `test-0${i + 1}${TEST_DOMAIN}`,
          name: `[TEST] 테스트회원0${i + 1}`,
          password: pwHash,
          shopName: `[TEST]샵0${i + 1}`,
          isActive: true,
        },
      })
    )
  );
  console.log(`✅ 테스트 사용자 ${users.length}명 생성`);

  const pickUser = (i: number) => users[i % users.length];

  const now     = new Date();
  const todayS  = new Date(now); todayS.setHours(9, 0, 0, 0);
  const dAgo    = (d: number, h = 10) => new Date(now.getTime() - d * 86400000 - (h * 3600000));
  const confirmed2dAgo = dAgo(2);

  // ── 3. 주문접수 (60 주문 × 2 items = 120건) ──────────────────────────────
  {
    const indices = Array.from({ length: 60 }, (_, i) => i);
    await batch(indices, 10, async (i) => {
      const p1 = pickProd(i * 2);
      const p2 = pickProd(i * 2 + 1);
      await prisma.order.create({
        data: {
          userId: pickUser(i).id,
          totalAmount: p1.price + p2.price,
          status: 'PENDING',
          note: `[TEST] 주문접수 #${i + 1}`,
          items: {
            create: [
              { productId: p1.id, quantity: 1, price: p1.price, size: p1.sizes[0], color: p1.colors[0] },
              { productId: p2.id, quantity: 1, price: p2.price, size: p2.sizes[0], color: p2.colors[0] },
            ],
          },
        },
      });
    });
    console.log('✅ 주문접수 60 주문 (120 items) 생성');
  }

  // ── 4. 주문확인 (40 주문 × 2 items = 80건, 여러 날짜) ────────────────────
  {
    const indices = Array.from({ length: 40 }, (_, i) => i);
    await batch(indices, 10, async (i) => {
      const p1 = pickProd(i * 2 + 3);
      const p2 = pickProd(i * 2 + 4);
      const confirmedAt = dAgo(i % 7 + 1);   // 1~7일 전으로 분산
      await prisma.order.create({
        data: {
          userId: pickUser(i + 1).id,
          totalAmount: p1.price + p2.price,
          status: 'CONFIRMED',
          note: `[TEST] 주문확인 #${i + 1}`,
          items: {
            create: [
              { productId: p1.id, quantity: 1, price: p1.price, size: p1.sizes[0], color: p1.colors[0], confirmedAt },
              { productId: p2.id, quantity: 1, price: p2.price, size: p2.sizes[0], color: p2.colors[0], confirmedAt },
            ],
          },
        },
      });
    });
    console.log('✅ 주문확인 40 주문 (80 items) 생성');
  }

  // ── 5. 일별입고 (30 주문 × 2 items = 60건, arrivedAt=오늘) ───────────────
  {
    const indices = Array.from({ length: 30 }, (_, i) => i);
    await batch(indices, 10, async (i) => {
      const p1 = pickProd(i * 2 + 1);
      const p2 = pickProd(i * 2 + 5);
      const arrivedAt = new Date(todayS.getTime() + i * 60000); // 오늘 09:00~
      await prisma.order.create({
        data: {
          userId: pickUser(i + 2).id,
          totalAmount: p1.price + p2.price,
          status: 'CONFIRMED',
          note: `[TEST] 일별입고 #${i + 1}`,
          items: {
            create: [
              { productId: p1.id, quantity: 1, price: p1.price, size: p1.sizes[0], color: p1.colors[0], confirmedAt: confirmed2dAgo, arrivedAt },
              { productId: p2.id, quantity: 1, price: p2.price, size: p2.sizes[0], color: p2.colors[0], confirmedAt: confirmed2dAgo, arrivedAt },
            ],
          },
        },
      });
    });
    console.log('✅ 일별입고 30 주문 (60 items) 생성');
  }

  // ── 6. 전체입고 추가 (15 주문 × 2 items = 30건, arrivedAt=3~14일 전) ─────
  {
    const indices = Array.from({ length: 15 }, (_, i) => i);
    await batch(indices, 8, async (i) => {
      const p1 = pickProd(i * 3 + 2);
      const p2 = pickProd(i * 3 + 7);
      const arrivedAt = dAgo(3 + i, 14); // 3~17일 전
      await prisma.order.create({
        data: {
          userId: pickUser(i + 3).id,
          totalAmount: p1.price + p2.price,
          status: 'CONFIRMED',
          note: `[TEST] 전체입고(과거) #${i + 1}`,
          items: {
            create: [
              { productId: p1.id, quantity: 1, price: p1.price, size: p1.sizes[0], color: p1.colors[0], confirmedAt: dAgo(20), arrivedAt },
              { productId: p2.id, quantity: 1, price: p2.price, size: p2.sizes[0], color: p2.colors[0], confirmedAt: dAgo(20), arrivedAt },
            ],
          },
        },
      });
    });
    console.log('✅ 전체입고(과거) 15 주문 (30 items) 생성');
  }

  // ── 7. 품절/미송 ─────────────────────────────────────────────────────────
  // a) 품절 4건 + 미송 4건 (30일 전, 탭에 표시됨)
  {
    const indices = Array.from({ length: 4 }, (_, i) => i);
    await batch(indices, 4, async (i) => {
      const p = pickProd(i + 6);
      await prisma.order.create({
        data: {
          userId: pickUser(i).id,
          totalAmount: p.price,
          status: 'CONFIRMED',
          note: `[TEST] 품절 #${i + 1}`,
          items: { create: [{ productId: p.id, quantity: 1, price: p.price, size: p.sizes[0], color: p.colors[0], confirmedAt: dAgo(35), outOfStockAt: dAgo(30) }] },
        },
      });
    });
    await batch(indices, 4, async (i) => {
      const p = pickProd(i + 9);
      await prisma.order.create({
        data: {
          userId: pickUser(i + 1).id,
          totalAmount: p.price,
          status: 'CONFIRMED',
          note: `[TEST] 미송 #${i + 1}`,
          items: { create: [{ productId: p.id, quantity: 1, price: p.price, size: p.sizes[0], color: p.colors[0], confirmedAt: dAgo(35), unshippedAt: dAgo(30) }] },
        },
      });
    });
    console.log('✅ 품절 4건 + 미송 4건 생성 (탭 표시용)');
  }

  // b) 90일 초과 2건 (탭에 표시 안 됨, 크론 삭제 테스트용)
  {
    const p1 = pickProd(12);
    const p2 = pickProd(13);
    await prisma.order.create({
      data: {
        userId: users[4].id, totalAmount: p1.price, status: 'CONFIRMED', note: '[TEST] 품절(91일전) 크론테스트',
        items: { create: [{ productId: p1.id, quantity: 1, price: p1.price, size: p1.sizes[0], color: p1.colors[0], confirmedAt: dAgo(95), outOfStockAt: dAgo(91) }] },
      },
    });
    await prisma.order.create({
      data: {
        userId: users[4].id, totalAmount: p2.price, status: 'CONFIRMED', note: '[TEST] 미송(92일전) 크론테스트',
        items: { create: [{ productId: p2.id, quantity: 1, price: p2.price, size: p2.sizes[0], color: p2.colors[0], confirmedAt: dAgo(96), unshippedAt: dAgo(92) }] },
      },
    });
    console.log('✅ 품절/미송 90일 초과 2건 생성 (크론 삭제 테스트용, 탭 표시 안 됨)');
  }

  // ── 요약 ──────────────────────────────────────────────────────────────────
  console.log('\n=== 생성 완료 ===');
  console.log('탭별 예상 행 수:');
  console.log('  주문접수  : 120건 (PENDING 60주문 × 2)');
  console.log('  주문확인  :  80건 (CONFIRMED 40주문 × 2, confirmedAt만, 1~7일 전)');
  console.log('  일별입고  :  60건 (arrivedAt=오늘 30주문 × 2)');
  console.log('  전체입고  :  90건 (일별 60 + 과거 30)');
  console.log('  품절/미송 :   8건 표시 (30일 전 품절4 + 미송4)');
  console.log('              + 2건 숨김 (91~92일 전, 크론 실행 시 삭제 대상)');
  console.log('\n👉 확인: https://kkumbb.com/admin/orders  (또는 로컬 localhost:3000/admin/orders)');
  console.log('삭제: npx ts-node --compiler-options \'{"module":"CommonJS"}\' scripts/delete-test-data.ts\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
