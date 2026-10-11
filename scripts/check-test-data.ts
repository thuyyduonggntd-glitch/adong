// Script tạm: đếm dữ liệu thử — xóa sau khi dùng
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const TEST_DOMAIN = '@test.kkumbb.local';
const TEST_MARKER = '__TEST_DATA__';

async function main() {
  console.log('=== BƯỚC 1: ĐẾM DỮ LIỆU THỬ (chưa xóa) ===\n');

  const testUsers = await prisma.user.findMany({
    where: { email: { endsWith: TEST_DOMAIN } },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  const testUserIds = testUsers.map((u: any) => u.id);

  const testProductCount    = await prisma.product.count({ where: { remark: TEST_MARKER } });
  const testVariantCount    = await prisma.productVariant.count({ where: { product: { remark: TEST_MARKER } } });
  const testColorImageCount = await prisma.productColorImage.count({ where: { product: { remark: TEST_MARKER } } });
  const testColorCodeCount  = await prisma.productColorCode.count({ where: { product: { remark: TEST_MARKER } } });
  const testPriceCount      = await prisma.productPrice.count({ where: { product: { remark: TEST_MARKER } } });

  const testOrderCount      = await prisma.order.count({ where: { userId: { in: testUserIds } } });
  const testOrderItemCount  = await prisma.orderItem.count({ where: { order: { userId: { in: testUserIds } } } });
  const testTxCount         = await prisma.transaction.count({ where: { userId: { in: testUserIds } } });
  const testShippingCount   = await prisma.shipping.count({ where: { userId: { in: testUserIds } } });
  const testCartCount       = await prisma.cartItem.count({ where: { userId: { in: testUserIds } } });
  const testWishlistCount   = await prisma.wishlist.count({ where: { userId: { in: testUserIds } } });

  // OrderBatch chứa toàn item thử
  const allBatches = await prisma.orderBatch.findMany({
    select: { id: true, createdAt: true, items: { select: { order: { select: { userId: true } } } } }
  });
  const testOnlyBatches = allBatches.filter((b: any) =>
    b.items.length > 0 && b.items.every((it: any) => testUserIds.includes(it.order.userId))
  );
  const mixedBatches = allBatches.filter((b: any) =>
    b.items.some((it: any) => testUserIds.includes(it.order.userId)) &&
    b.items.some((it: any) => !testUserIds.includes(it.order.userId))
  );

  // InvoiceReceipt gắn với item thử
  const testItemIds = await prisma.orderItem.findMany({
    where: { order: { userId: { in: testUserIds } } }, select: { id: true }
  }).then((rows: any[]) => rows.map((r: any) => r.id));

  const testInvoiceReceiptItemCount = testItemIds.length > 0
    ? await prisma.invoiceReceiptItem.count({ where: { orderItemId: { in: testItemIds } } })
    : 0;

  const testReceiptIds = testItemIds.length > 0
    ? await prisma.invoiceReceiptItem.findMany({
        where: { orderItemId: { in: testItemIds } },
        select: { receiptId: true },
      }).then((rows: any[]) => Array.from(new Set(rows.map((r: any) => r.receiptId))))
    : [];

  const testInvoiceReceipts = testReceiptIds.length > 0
    ? await prisma.invoiceReceipt.findMany({
        where: { id: { in: testReceiptIds } }, select: { id: true, imageUrl: true, createdAt: true }
      })
    : [];

  // Dữ liệu thật (baseline)
  const realProductCount = await prisma.product.count({ where: { OR: [{ remark: null }, { remark: { not: TEST_MARKER } }] } });
  const realBrandCount   = await prisma.brand.count();
  const realUserCount    = await prisma.user.count({ where: { email: { not: { endsWith: TEST_DOMAIN } } } });
  const realOrderCount   = await prisma.order.count({ where: { userId: { notIn: testUserIds } } });
  const realItemCount    = await prisma.orderItem.count({ where: { order: { userId: { notIn: testUserIds } } } });
  const realTxCount      = await prisma.transaction.count({ where: { userId: { notIn: testUserIds } } });

  // SUB_ADMIN accounts
  const subAdmins = await prisma.user.findMany({
    where: { role: 'SUB_ADMIN' },
    select: { id: true, email: true, name: true, createdAt: true, adminZones: true }
  });

  // ===== IN KẾT QUẢ =====
  console.log('--- DỮ LIỆU THỬ CẦN XÓA ---\n');
  console.log(`Tài khoản @test.kkumbb.local : ${testUsers.length} tài khoản`);
  testUsers.forEach((u: any) => console.log(
    `  • ${u.email.padEnd(40)} (${u.name}) [${u.role}]  ${u.createdAt.toISOString().slice(0,10)}`
  ));

  console.log(`\nSản phẩm [TEST] (remark=__TEST_DATA__) : ${testProductCount}`);
  console.log(`  └ ProductVariant    : ${testVariantCount}`);
  console.log(`  └ ProductColorImage : ${testColorImageCount}`);
  console.log(`  └ ProductColorCode  : ${testColorCodeCount}`);
  console.log(`  └ ProductPrice      : ${testPriceCount}`);

  console.log(`\nĐơn hàng (Order)    : ${testOrderCount}`);
  console.log(`OrderItem            : ${testOrderItemCount}`);
  console.log(`Transaction          : ${testTxCount}`);
  console.log(`Shipping             : ${testShippingCount}`);
  console.log(`CartItem             : ${testCartCount}`);
  console.log(`Wishlist             : ${testWishlistCount}`);

  console.log(`\nInvoiceReceipt       : ${testReceiptIds.length} bản ghi`);
  console.log(`InvoiceReceiptItem   : ${testInvoiceReceiptItemCount} dòng`);
  if ((testInvoiceReceipts as any[]).length > 0) {
    console.log('  └ Ảnh GCS (imageUrl):');
    (testInvoiceReceipts as any[]).forEach((r: any) => console.log(`      ${r.imageUrl ?? '(null)'}`));
  } else {
    console.log('  └ Không có ảnh GCS nào cần xóa');
  }

  console.log(`\nOrderBatch chỉ chứa item thử : ${testOnlyBatches.length} lô`);
  (testOnlyBatches as any[]).forEach((b: any) =>
    console.log(`  • id=${b.id.slice(0,16)}...  ${b.createdAt.toISOString().slice(0,10)}`)
  );
  if (mixedBatches.length > 0) {
    console.log(`\n⚠️  Lô HỖN HỢP (thử + thật): ${mixedBatches.length} lô — KHÔNG xóa`);
    (mixedBatches as any[]).forEach((b: any) => console.log(`  • id=${b.id.slice(0,16)}...`));
  }

  console.log('\n--- DỮ LIỆU THẬT (baseline trước khi xóa) ---\n');
  console.log(`Sản phẩm thật        : ${realProductCount}`);
  console.log(`Thương hiệu          : ${realBrandCount}`);
  console.log(`Người dùng/admin thật: ${realUserCount}`);
  console.log(`Đơn hàng thật        : ${realOrderCount}`);
  console.log(`OrderItem thật       : ${realItemCount}`);
  console.log(`Transaction thật     : ${realTxCount}`);

  console.log('\n--- TÀI KHOẢN SUB_ADMIN ---\n');
  if (subAdmins.length === 0) {
    console.log('Không có tài khoản SUB_ADMIN nào.');
  } else {
    (subAdmins as any[]).forEach((u: any) => console.log(
      `  • ${u.email.padEnd(40)} (${u.name})  zones=${JSON.stringify(u.adminZones)}  ${u.createdAt.toISOString().slice(0,10)}`
    ));
  }

  console.log('\n=== BƯỚC 1 HOÀN TẤT — chờ xác nhận để chuyển Bước 2 ===');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
