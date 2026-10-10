/**
 * 테스트 데이터 삭제 스크립트
 *
 * 실행 방법:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/delete-test-data.ts
 *
 * - @test.kkumbb.local 이메일 계정과 연관 데이터만 삭제
 * - 삭제 전 각 유형별 수량을 출력하고 확인을 요청
 * - 운영 데이터는 절대 건드리지 않음
 */
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();
const TEST_DOMAIN = '@test.kkumbb.local';
const TEST_PRODUCT_NUMBER = 'TEST-KKUMBB-001';

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

async function main() {
  console.log('=== 테스트 데이터 삭제 스크립트 ===\n');

  // ── 1. 테스트 사용자 조회 ──────────────────────────────────────────────
  const testUsers = await prisma.user.findMany({
    where: { email: { endsWith: TEST_DOMAIN } },
    select: { id: true, email: true, name: true },
  });
  if (testUsers.length === 0) {
    console.log('삭제할 테스트 데이터가 없습니다.');
    process.exit(0);
  }
  const userIds = testUsers.map((u) => u.id);

  // ── 2. 테스트 상품 조회 ────────────────────────────────────────────────
  const testProduct = await prisma.product.findFirst({
    where: { productNumber: TEST_PRODUCT_NUMBER },
    select: { id: true, name: true },
  });

  // ── 3. 각 유형별 수량 집계 ────────────────────────────────────────────
  const [
    userCount,
    orderCount,
    orderItemCount,
    transactionCount,
    cartCount,
    wishlistCount,
    shippingCount,
  ] = await Promise.all([
    prisma.user.count({ where: { id: { in: userIds } } }),
    prisma.order.count({ where: { userId: { in: userIds } } }),
    prisma.orderItem.count({ where: { order: { userId: { in: userIds } } } }),
    prisma.transaction.count({ where: { userId: { in: userIds } } }),
    prisma.cartItem.count({ where: { userId: { in: userIds } } }),
    prisma.wishlist.count({ where: { userId: { in: userIds } } }),
    prisma.shipping.count({ where: { userId: { in: userIds } } }),
  ]);

  const productLabel = testProduct ? `  테스트 상품: 1건 (${testProduct.name})` : '';

  // ── 4. 삭제 내역 출력 ─────────────────────────────────────────────────
  console.log('삭제될 데이터:');
  console.log(`  사용자      : ${userCount}명`);
  console.log(`  주문        : ${orderCount}건`);
  console.log(`  주문 아이템 : ${orderItemCount}건`);
  console.log(`  거래 내역   : ${transactionCount}건`);
  console.log(`  장바구니    : ${cartCount}건`);
  console.log(`  위시리스트  : ${wishlistCount}건`);
  console.log(`  배송 정보   : ${shippingCount}건`);
  if (productLabel) console.log(productLabel);

  testUsers.forEach((u) => console.log(`    - ${u.email} (${u.name})`));
  console.log('');

  const answer = await ask('정말 삭제하시겠습니까? (yes 를 입력해야 실행됩니다): ');
  if (answer !== 'yes') {
    console.log('취소됐습니다.');
    process.exit(0);
  }

  console.log('\n삭제 시작...');

  // ── 5. 삭제 실행 (의존성 순서대로) ────────────────────────────────────
  // OrderItem → (Order cascade) / 직접 삭제로 안전하게
  await prisma.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } });
  await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.transaction.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.cartItem.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.wishlist.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.shipping.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  if (testProduct) {
    await prisma.product.delete({ where: { id: testProduct.id } });
    console.log('✅ 테스트 상품 삭제 완료');
  }

  console.log('✅ 테스트 사용자 삭제 완료');
  console.log('=== 삭제 완료 ===\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
