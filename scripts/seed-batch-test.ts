/**
 * seed-batch-test.ts
 * Tạo 50 đơn xác nhận chia 2 lần phát lệnh (발주 차수) để test filter
 *
 * Thực hiện:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-batch-test.ts
 *
 * Kết quả:
 *   - 5 brand từ DB (có sản phẩm active nhất)
 *   - 50 đơn CONFIRMED, chia đều:
 *       Lần 1 (차수 1): 25 đơn — confirmedAt = 3 giờ trước
 *       Lần 2 (차수 2): 25 đơn — confirmedAt = 30 phút trước
 *   - Mỗi lần tạo 1 OrderBatch record
 *   - Dùng lại test users hiện có (@test.kkumbb.local), tự tạo nếu chưa có
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const TEST_DOMAIN = '@test.kkumbb.local';

async function main() {
  console.log('=== seed-batch-test: tạo 2 lần phát lệnh ===\n');

  // ── 1. Lấy ADMIN user để gán vào OrderBatch ────────────────────────────────
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, name: true },
  });
  if (!adminUser) { console.error('❌ Không tìm thấy ADMIN user'); process.exit(1); }
  console.log(`✅ Admin: ${adminUser.name}`);

  // ── 2. Lấy 5 brand có nhiều sản phẩm active nhất ──────────────────────────
  const brandAgg = await prisma.product.groupBy({
    by: ['brand'],
    where: { isActive: true, brand: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });
  const topBrands = brandAgg.slice(0, 5).map((b) => b.brand!);
  console.log(`✅ 5 brand: ${topBrands.join(', ')}`);

  // ── 3. Mỗi brand lấy 2 sản phẩm (ưu tiên sản phẩm chưa có trong confirmed) ─
  type Prod = { id: string; brand: string; price: number; sizes: string[]; colors: string[] };
  const products: Prod[] = [];
  for (const brand of topBrands) {
    const prods = await prisma.product.findMany({
      where: { isActive: true, brand, sizes: { isEmpty: false }, colors: { isEmpty: false } },
      select: { id: true, brand: true, price: true, sizes: true, colors: true },
      take: 4,
    });
    const valid = prods.filter((p) => p.brand && p.sizes.length > 0 && p.colors.length > 0) as Prod[];
    products.push(...valid.slice(0, 4));
  }
  console.log(`✅ ${products.length}개 상품 수집 (${topBrands.length}개 브랜드)`);
  if (products.length === 0) { console.error('❌ 사용 가능한 상품 없음'); process.exit(1); }
  const pick = (i: number) => products[i % products.length];

  // ── 4. 테스트 사용자 확보 (기존 재사용 or 신규 생성) ────────────────────────
  let testUsers = await prisma.user.findMany({
    where: { email: { endsWith: TEST_DOMAIN } },
    select: { id: true, name: true },
    take: 5,
  });
  if (testUsers.length === 0) {
    const pwHash = await bcrypt.hash('TestPass123!', 10);
    testUsers = await Promise.all(
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
    console.log(`✅ 테스트 사용자 ${testUsers.length}명 신규 생성`);
  } else {
    console.log(`✅ 테스트 사용자 ${testUsers.length}명 재사용`);
  }
  const pickUser = (i: number) => testUsers[i % testUsers.length];

  const now = new Date();
  const ago = (ms: number) => new Date(now.getTime() - ms);

  // ── 5. 1차 발주: 25개 주문 confirmedAt = 3시간 전 ─────────────────────────
  const batch1Time = ago(3 * 60 * 60 * 1000);
  const batch1 = await prisma.orderBatch.create({
    data: { adminId: adminUser.id, itemCount: 0, createdAt: batch1Time },
  });

  let batch1Count = 0;
  for (let i = 0; i < 25; i++) {
    const p1 = pick(i * 2);
    const p2 = pick(i * 2 + 1);
    const orderCreatedAt = ago((i % 5 + 3) * 86400000);
    await prisma.order.create({
      data: {
        userId: pickUser(i).id,
        totalAmount: p1.price * 1 + p2.price * 1,
        status: 'CONFIRMED',
        createdAt: orderCreatedAt,
        items: {
          create: [
            {
              productId: p1.id, quantity: 1, price: p1.price,
              size: p1.sizes[i % p1.sizes.length],
              color: p1.colors[i % p1.colors.length],
              confirmedAt: batch1Time, orderBatchId: batch1.id,
            },
            {
              productId: p2.id, quantity: 1, price: p2.price,
              size: p2.sizes[i % p2.sizes.length],
              color: p2.colors[i % p2.colors.length],
              confirmedAt: batch1Time, orderBatchId: batch1.id,
            },
          ],
        },
      },
    });
    batch1Count += 2;
  }
  await prisma.orderBatch.update({ where: { id: batch1.id }, data: { itemCount: batch1Count } });
  const b1kst = new Date(batch1Time.getTime() + 9 * 3600000);
  const b1label = `${String(b1kst.getUTCMonth()+1).padStart(2,'0')}/${String(b1kst.getUTCDate()).padStart(2,'0')} 1차 (${String(b1kst.getUTCHours()).padStart(2,'0')}:${String(b1kst.getUTCMinutes()).padStart(2,'0')}) · ${batch1Count}건`;
  console.log(`✅ 1차 발주 완료: ${b1label}`);

  // ── 6. 2차 발주: 25개 주문 confirmedAt = 30분 전 ──────────────────────────
  const batch2Time = ago(30 * 60 * 1000);
  const batch2 = await prisma.orderBatch.create({
    data: { adminId: adminUser.id, itemCount: 0, createdAt: batch2Time },
  });

  let batch2Count = 0;
  for (let i = 0; i < 25; i++) {
    const p1 = pick(i * 2 + 3);
    const p2 = pick(i * 2 + 4);
    const orderCreatedAt = ago((i % 3 + 1) * 86400000);
    await prisma.order.create({
      data: {
        userId: pickUser(i + 1).id,
        totalAmount: p1.price * 1 + p2.price * 1,
        status: 'CONFIRMED',
        createdAt: orderCreatedAt,
        items: {
          create: [
            {
              productId: p1.id, quantity: 1, price: p1.price,
              size: p1.sizes[i % p1.sizes.length],
              color: p1.colors[i % p1.colors.length],
              confirmedAt: batch2Time, orderBatchId: batch2.id,
            },
            {
              productId: p2.id, quantity: 1, price: p2.price,
              size: p2.sizes[i % p2.sizes.length],
              color: p2.colors[i % p2.colors.length],
              confirmedAt: batch2Time, orderBatchId: batch2.id,
            },
          ],
        },
      },
    });
    batch2Count += 2;
  }
  await prisma.orderBatch.update({ where: { id: batch2.id }, data: { itemCount: batch2Count } });
  const b2kst = new Date(batch2Time.getTime() + 9 * 3600000);
  const b2label = `${String(b2kst.getUTCMonth()+1).padStart(2,'0')}/${String(b2kst.getUTCDate()).padStart(2,'0')} 2차 (${String(b2kst.getUTCHours()).padStart(2,'0')}:${String(b2kst.getUTCMinutes()).padStart(2,'0')}) · ${batch2Count}건`;
  console.log(`✅ 2차 발주 완료: ${b2label}`);

  console.log('\n=== 완료 ===');
  console.log(`주문확인 탭 > 쇼핑몰별 > dropdown에서 확인:`);
  console.log(`  전체 대기  → 전체 ${batch1Count + batch2Count}건 모두 표시`);
  console.log(`  ${b1label}`);
  console.log(`  ${b2label}`);
  console.log(`각 차수를 선택하면 해당 차수에 속한 상품만 표시됩니다.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
