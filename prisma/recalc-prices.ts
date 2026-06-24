/**
 * 기존 주문 데이터를 도매가 기준으로 재계산하는 스크립트
 * 실행: npx tsx prisma/recalc-prices.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('도매가 기준 재계산 시작...');

  // 모든 상품의 가격 정보 로드
  const products = await prisma.product.findMany({
    select: { id: true, price: true, wholesalePrice: true, isOnSale: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  // 모든 주문 아이템 업데이트
  const orderItems = await prisma.orderItem.findMany({
    select: { id: true, orderId: true, productId: true, quantity: true, price: true },
  });

  let updatedItems = 0;
  for (const item of orderItems) {
    const product = productMap.get(item.productId);
    if (!product) continue;

    const effectivePrice = product.wholesalePrice ?? item.price; // 도매가 없으면 기존 유지

    if (effectivePrice !== item.price) {
      await prisma.orderItem.update({ where: { id: item.id }, data: { price: effectivePrice } });
      updatedItems++;
    }
  }
  console.log(`  OrderItem 가격 업데이트: ${updatedItems}개`);

  // 모든 주문 totalAmount 재계산
  const orders = await prisma.order.findMany({
    include: { items: { select: { price: true, quantity: true } } },
  });

  let updatedOrders = 0;
  for (const order of orders) {
    const newTotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
    if (newTotal !== order.totalAmount) {
      await prisma.order.update({ where: { id: order.id }, data: { totalAmount: newTotal } });
      updatedOrders++;
    }
  }
  console.log(`  Order totalAmount 재계산: ${updatedOrders}개`);

  // 자동 생성된 출금 거래 삭제 후 재생성
  const deletedTx = await prisma.transaction.deleteMany({
    where: { type: 'WITHDRAWAL', description: '주문 상품 입고' },
  });
  console.log(`  자동 출금 거래 삭제: ${deletedTx.count}개`);

  // 입고된 아이템 기준으로 출금 거래 재생성
  const arrivedItems = await prisma.orderItem.findMany({
    where: { arrivedAt: { not: null }, cancelledAt: null },
    include: { order: { select: { userId: true } } },
  });

  // userId + arrivedAt 날짜별 그룹
  const groups = new Map<string, { userId: string; date: Date; amount: number }>();
  for (const item of arrivedItems) {
    const date = new Date(item.arrivedAt!);
    date.setHours(0, 0, 0, 0);
    const key = `${item.order.userId}_${date.toISOString()}`;
    if (!groups.has(key)) {
      groups.set(key, { userId: item.order.userId, date, amount: 0 });
    }
    groups.get(key)!.amount += item.price * item.quantity;
  }

  for (const [, { userId, date, amount }] of Array.from(groups)) {
    await prisma.transaction.create({
      data: { userId, type: 'WITHDRAWAL', amount, description: '주문 상품 입고', date },
    });
  }
  console.log(`  출금 거래 재생성: ${groups.size}개`);

  // 사용자별 depositAmount 재계산
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) {
    const dep = await prisma.transaction.aggregate({ where: { userId: user.id, type: 'DEPOSIT'    }, _sum: { amount: true } });
    const wd  = await prisma.transaction.aggregate({ where: { userId: user.id, type: 'WITHDRAWAL' }, _sum: { amount: true } });
    await prisma.user.update({ where: { id: user.id }, data: { depositAmount: (dep._sum.amount ?? 0) - (wd._sum.amount ?? 0) } });
  }
  console.log(`  User depositAmount 재계산: ${users.length}명`);

  console.log('\n재계산 완료!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
