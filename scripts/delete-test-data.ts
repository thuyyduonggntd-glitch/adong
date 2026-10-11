/**
 * delete-test-data.ts — Xóa toàn bộ dữ liệu thử (@test.kkumbb.local + [TEST] products)
 *
 * Chạy:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/delete-test-data.ts
 *
 * - Chỉ xóa theo dấu hiệu: email @test.kkumbb.local và product.remark='__TEST_DATA__'
 * - In số lượng từng loại, hỏi "yes" trước khi xóa
 * - KHÔNG đụng dữ liệu thật
 */
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();
const TEST_DOMAIN = '@test.kkumbb.local';
const TEST_MARKER = '__TEST_DATA__';

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

async function main() {
  console.log('=== 테스트 데이터 삭제 스크립트 ===\n');

  // ── 조회 ────────────────────────────────────────────────────────────────
  const testUsers = await prisma.user.findMany({
    where: { email: { endsWith: TEST_DOMAIN } },
    select: { id: true, email: true, name: true },
  });
  const testProducts = await prisma.product.findMany({
    where: { remark: TEST_MARKER },
    select: { id: true },
  });

  if (testUsers.length === 0 && testProducts.length === 0) {
    console.log('삭제할 테스트 데이터가 없습니다.');
    process.exit(0);
  }

  const userIds    = testUsers.map((u) => u.id);
  const productIds = testProducts.map((p) => p.id);
  const TEST_USER_WHERE = { email: { endsWith: TEST_DOMAIN } };

  // ── 집계 ────────────────────────────────────────────────────────────────
  const [
    userCount,
    productCount,
    orderCount,
    orderItemCount,
    receiptItemCount,
    batchCountAffected,
    transactionCount,
    cartCount,
    wishlistCount,
    shippingCount,
  ] = await Promise.all([
    prisma.user.count({ where: { id: { in: userIds } } }),
    prisma.product.count({ where: { id: { in: productIds } } }),
    prisma.order.count({ where: { userId: { in: userIds } } }),
    prisma.orderItem.count({ where: { order: { user: TEST_USER_WHERE } } }),
    prisma.invoiceReceiptItem.count({ where: { orderItem: { order: { user: TEST_USER_WHERE } } } }),
    prisma.orderBatch.count({ where: { items: { some: { order: { user: TEST_USER_WHERE } } } } }),
    prisma.transaction.count({ where: { userId: { in: userIds } } }),
    prisma.cartItem.count({ where: { OR: [{ userId: { in: userIds } }, { productId: { in: productIds } }] } }),
    prisma.wishlist.count({ where: { OR: [{ userId: { in: userIds } }, { productId: { in: productIds } }] } }),
    prisma.shipping.count({ where: { userId: { in: userIds } } }),
  ]);

  console.log('삭제될 데이터:');
  console.log(`  사용자                : ${userCount}명`);
  console.log(`  테스트 상품           : ${productCount}개`);
  console.log(`  주문                  : ${orderCount}건`);
  console.log(`  주문 아이템           : ${orderItemCount}건`);
  console.log(`  영수증 대조 이력 항목 : ${receiptItemCount}건`);
  console.log(`  발주 차수 (포함 건)   : ${batchCountAffected}개`);
  console.log(`  거래 내역             : ${transactionCount}건`);
  console.log(`  장바구니              : ${cartCount}건`);
  console.log(`  위시리스트            : ${wishlistCount}건`);
  console.log(`  배송 정보             : ${shippingCount}건`);
  console.log('\n테스트 사용자 목록:');
  testUsers.slice(0, 20).forEach((u) => console.log(`  - ${u.email} (${u.name})`));
  if (testUsers.length > 20) console.log(`  ... 외 ${testUsers.length - 20}명`);
  console.log('');

  const ans = await ask('정말 삭제하시겠습니까? (yes 를 입력해야 실행됩니다): ');
  if (ans !== 'yes') { console.log('취소됐습니다.'); process.exit(0); }

  console.log('\n삭제 시작...');

  // ── 삭제 (의존성 순서) ───────────────────────────────────────────────────
  // 1. InvoiceReceiptItem → 빈 InvoiceReceipt 정리
  if (receiptItemCount > 0) {
    await prisma.invoiceReceiptItem.deleteMany({
      where: { orderItem: { order: { user: TEST_USER_WHERE } } },
    });
    await prisma.invoiceReceipt.deleteMany({ where: { items: { none: {} } } });
    console.log(`  ✅ 영수증 대조 이력 ${receiptItemCount}건 삭제`);
  }

  // 2. OrderItem
  if (orderItemCount > 0) {
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } });
    console.log(`  ✅ 주문 아이템 ${orderItemCount}건 삭제`);
  }

  // 3. 빈 발주 차수 정리 (테스트 item만 있던 차수)
  const emptyBatches = await prisma.orderBatch.findMany({
    where: { items: { none: {} } },
    select: { id: true },
  });
  if (emptyBatches.length > 0) {
    await prisma.orderBatch.deleteMany({ where: { id: { in: emptyBatches.map((b) => b.id) } } });
    console.log(`  ✅ 빈 발주 차수 ${emptyBatches.length}개 삭제`);
  }

  // 4. Order
  if (orderCount > 0) {
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    console.log(`  ✅ 주문 ${orderCount}건 삭제`);
  }

  // 5. 사용자 관련
  if (transactionCount > 0) {
    await prisma.transaction.deleteMany({ where: { userId: { in: userIds } } });
  }
  if (cartCount > 0) {
    await prisma.cartItem.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { productId: { in: productIds } }] },
    });
  }
  if (wishlistCount > 0) {
    await prisma.wishlist.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { productId: { in: productIds } }] },
    });
  }
  if (shippingCount > 0) {
    await prisma.shipping.deleteMany({ where: { userId: { in: userIds } } });
  }
  if (userCount > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    console.log(`  ✅ 사용자 ${userCount}명 삭제`);
  }

  // 6. 테스트 상품 관련
  if (productIds.length > 0) {
    await prisma.productVariant.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.productColorImage.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.productColorCode.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.productPrice.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    console.log(`  ✅ 테스트 상품 ${productIds.length}개 삭제`);
  }

  console.log('\n=== 삭제 완료 ===\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
