/**
 * 테스트 데이터 생성 스크립트
 *
 * 실행 방법:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-test-data.ts
 *
 * - 이메일 도메인 @test.kkumbb.local 으로 식별
 * - 삭제는 scripts/delete-test-data.ts 사용
 * - 실제 운영 데이터를 건드리지 않음
 *
 * 생성 내용 (주문 관리 5개 탭 검증용):
 *   Tab 주문접수   ← PENDING 주문, 아이템 timestamps 없음
 *   Tab 주문확인   ← CONFIRMED 주문, 아이템 confirmedAt 만 있음
 *   Tab 일별입고   ← 아이템 arrivedAt = 오늘
 *   Tab 전체입고   ← 아이템 arrivedAt = 7일 전
 *   Tab 품절/미송  ← 아이템 outOfStockAt / unshippedAt = 30일 전
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEST_DOMAIN = '@test.kkumbb.local';

async function main() {
  console.log('=== 테스트 데이터 생성 시작 ===\n');

  // ── 1. 기존 테스트 데이터 유무 확인 ────────────────────────────────────
  const existing = await prisma.user.findMany({
    where: { email: { endsWith: TEST_DOMAIN } },
    select: { email: true },
  });
  if (existing.length > 0) {
    console.log(`⚠️  이미 테스트 데이터가 존재합니다 (${existing.length}명):`);
    existing.forEach((u) => console.log('   -', u.email));
    console.log('\n삭제 후 다시 실행하려면: npx ts-node --compiler-options \'{"module":"CommonJS"}\' scripts/delete-test-data.ts\n');
    process.exit(1);
  }

  // ── 2. 테스트 상품 생성 (없으면 신규, 있으면 재사용) ────────────────────
  const TEST_PRODUCT_NUMBER = 'TEST-KKUMBB-001';
  let product = await prisma.product.findFirst({ where: { productNumber: TEST_PRODUCT_NUMBER } });
  if (!product) {
    product = await prisma.product.create({
      data: {
        name: '[TEST] 테스트 상품',
        description: '주문 관리 탭 검증용 테스트 상품. 삭제 스크립트로 함께 삭제됩니다.',
        price: 100000,
        wholesalePrice: 50000,
        images: [],
        brand: 'TEST브랜드',
        productNumber: TEST_PRODUCT_NUMBER,
        isActive: false,
        sizes: ['M'],
        colors: ['BLACK'],
      },
    });
    console.log('✅ 테스트 상품 생성:', product.id);
  } else {
    console.log('♻️  테스트 상품 재사용:', product.id);
  }

  // ── 3. 테스트 사용자 생성 ───────────────────────────────────────────────
  const pwHash = await bcrypt.hash('TestPass123!', 10);

  const users = await Promise.all([
    prisma.user.create({ data: { email: `test-01${TEST_DOMAIN}`, name: '[TEST] 테스트회원01', password: pwHash, shopName: '[TEST]샵01', isActive: true } }),
    prisma.user.create({ data: { email: `test-02${TEST_DOMAIN}`, name: '[TEST] 테스트회원02', password: pwHash, shopName: '[TEST]샵02', isActive: true } }),
  ]);
  console.log('✅ 테스트 사용자 생성:', users.map((u) => u.email).join(', '));

  const [u1, u2] = users;
  const pid = product.id;

  const now    = new Date();
  const today  = new Date(now); today.setHours(10, 0, 0, 0);
  const d7ago  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const d30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ── 4. 주문 생성 ───────────────────────────────────────────────────────
  // [주문접수] PENDING, 아이템 timestamps 없음 (2개)
  const o1 = await prisma.order.create({
    data: {
      userId: u1.id, totalAmount: 200000, status: 'PENDING', note: '[TEST] 주문접수 테스트',
      items: { create: [
        { productId: pid, quantity: 1, price: 100000, size: 'M', color: 'BLACK' },
        { productId: pid, quantity: 1, price: 100000, size: 'M', color: 'BLACK' },
      ]},
    },
  });

  // [주문확인] CONFIRMED, confirmedAt 만 있음 (2개)
  const confirmed = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const o2 = await prisma.order.create({
    data: {
      userId: u2.id, totalAmount: 200000, status: 'CONFIRMED', note: '[TEST] 주문확인 테스트',
      items: { create: [
        { productId: pid, quantity: 1, price: 100000, size: 'M', color: 'BLACK', confirmedAt: confirmed },
        { productId: pid, quantity: 1, price: 100000, size: 'M', color: 'BLACK', confirmedAt: confirmed },
      ]},
    },
  });

  // [일별입고] arrivedAt = 오늘 (1개)
  const o3 = await prisma.order.create({
    data: {
      userId: u1.id, totalAmount: 100000, status: 'CONFIRMED', note: '[TEST] 일별입고 테스트',
      items: { create: [
        { productId: pid, quantity: 1, price: 100000, size: 'M', color: 'BLACK', confirmedAt: confirmed, arrivedAt: today },
      ]},
    },
  });

  // [전체입고 only] arrivedAt = 7일 전 (1개)
  const o4 = await prisma.order.create({
    data: {
      userId: u2.id, totalAmount: 100000, status: 'CONFIRMED', note: '[TEST] 전체입고 테스트',
      items: { create: [
        { productId: pid, quantity: 1, price: 100000, size: 'M', color: 'BLACK', confirmedAt: confirmed, arrivedAt: d7ago },
      ]},
    },
  });

  // [품절] outOfStockAt = 30일 전 (1개)
  const o5 = await prisma.order.create({
    data: {
      userId: u1.id, totalAmount: 100000, status: 'CONFIRMED', note: '[TEST] 품절 테스트',
      items: { create: [
        { productId: pid, quantity: 1, price: 100000, size: 'M', color: 'BLACK', confirmedAt: confirmed, outOfStockAt: d30ago },
      ]},
    },
  });

  // [미송] unshippedAt = 30일 전 (1개)
  const o6 = await prisma.order.create({
    data: {
      userId: u2.id, totalAmount: 100000, status: 'CONFIRMED', note: '[TEST] 미송 테스트',
      items: { create: [
        { productId: pid, quantity: 1, price: 100000, size: 'M', color: 'BLACK', confirmedAt: confirmed, unshippedAt: d30ago },
      ]},
    },
  });

  console.log('\n✅ 주문 생성 완료:');
  console.log(`   주문접수  탭 예상: 2건  (주문 ${o1.id.slice(-6)})`);
  console.log(`   주문확인  탭 예상: 2건  (주문 ${o2.id.slice(-6)})`);
  console.log(`   일별입고  탭 예상: 1건  (주문 ${o3.id.slice(-6)})`);
  console.log(`   전체입고  탭 예상: 2건  (일별+전체 ${o3.id.slice(-6)}, ${o4.id.slice(-6)})`);
  console.log(`   품절/미송 탭 예상: 2건  (주문 ${o5.id.slice(-6)}, ${o6.id.slice(-6)})`);

  console.log('\n=== 생성 완료. 관리자 페이지에서 탭별 카운트를 확인하세요. ===');
  console.log('삭제: npx ts-node --compiler-options \'{"module":"CommonJS"}\' scripts/delete-test-data.ts\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
