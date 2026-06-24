import { PrismaClient, Role, OrderStatus, TransactionType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 카테고리
  const categories = await Promise.all([
    prisma.category.upsert({ where: { slug: 'newborn' }, update: {}, create: { name: '신생아 (0-6개월)', slug: 'newborn' } }),
    prisma.category.upsert({ where: { slug: 'baby' }, update: {}, create: { name: '베이비 (6-24개월)', slug: 'baby' } }),
    prisma.category.upsert({ where: { slug: 'toddler' }, update: {}, create: { name: '유아 (2-5세)', slug: 'toddler' } }),
    prisma.category.upsert({ where: { slug: 'kids' }, update: {}, create: { name: '주니어 (6-12세)', slug: 'kids' } }),
    prisma.category.upsert({ where: { slug: 'accessory' }, update: {}, create: { name: '액세서리', slug: 'accessory' } }),
  ]);

  // 어드민
  const adminPassword = await bcrypt.hash('admin1234', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@kkumbb.com' },
    update: {},
    create: {
      email: 'admin@kkumbb.com',
      password: adminPassword,
      name: '관리자',
      phone: '010-0000-0000',
      role: Role.ADMIN,
    },
  });

  // 일반 회원
  const userPassword = await bcrypt.hash('user1234', 10);
  const user1 = await prisma.user.upsert({
    where: { email: 'kim@test.com' },
    update: {},
    create: {
      email: 'kim@test.com',
      password: userPassword,
      name: '김민준',
      phone: '010-1234-5678',
      address: '서울시 강남구 테헤란로 123',
      depositAmount: 150000,
    },
  });
  const user2 = await prisma.user.upsert({
    where: { email: 'lee@test.com' },
    update: {},
    create: {
      email: 'lee@test.com',
      password: userPassword,
      name: '이서연',
      phone: '010-9876-5432',
      address: '서울시 마포구 홍대로 45',
      depositAmount: 80000,
    },
  });

  // 상품
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: '베이비 순면 바디수트 세트',
        description: '100% 순면 소재로 피부에 자극 없는 신생아 바디수트입니다. 부드럽고 통기성이 좋아 아기가 편안하게 착용할 수 있습니다.',
        price: 35000,
        images: ['https://placehold.co/400x400/EFF6FF/2563EB?text=바디수트'],
        categoryId: categories[0].id,
        sizes: ['50', '60', '70'],
        colors: ['화이트', '민트', '연핑크'],
        stock: 50,
      },
    }),
    prisma.product.create({
      data: {
        name: '베이비 니트 점프수트',
        description: '따뜻하고 보드라운 니트 소재의 올인원 점프수트입니다. 스냅 단추로 기저귀 교체가 편리합니다.',
        price: 45000,
        images: ['https://placehold.co/400x400/DBEAFE/1D4ED8?text=점프수트'],
        categoryId: categories[1].id,
        sizes: ['70', '80', '90'],
        colors: ['아이보리', '베이지', '스카이블루'],
        stock: 30,
      },
    }),
    prisma.product.create({
      data: {
        name: '유아 봄 세트 (티셔츠+팬츠)',
        description: '귀여운 프린트의 티셔츠와 편안한 팬츠 세트입니다. 봄철 나들이에 딱 맞는 스타일입니다.',
        price: 52000,
        images: ['https://placehold.co/400x400/BFDBFE/1E40AF?text=봄세트'],
        categoryId: categories[2].id,
        sizes: ['90', '100', '110'],
        colors: ['블루', '옐로우'],
        stock: 25,
      },
    }),
    prisma.product.create({
      data: {
        name: '주니어 캐주얼 후드티',
        description: '편안한 후드티로 학교, 나들이 어디서나 활용 가능합니다. 소프트한 기모 안감으로 따뜻합니다.',
        price: 48000,
        images: ['https://placehold.co/400x400/93C5FD/1E3A8A?text=후드티'],
        categoryId: categories[3].id,
        sizes: ['120', '130', '140', '150'],
        colors: ['네이비', '그레이', '화이트'],
        stock: 40,
      },
    }),
    prisma.product.create({
      data: {
        name: '신생아 선물 세트 (5종)',
        description: '출산 선물로 최적! 바디수트 2장, 손발싸개, 비니, 턱받이가 포함된 풀 세트입니다.',
        price: 89000,
        images: ['https://placehold.co/400x400/60A5FA/1E3A8A?text=선물세트'],
        categoryId: categories[4].id,
        sizes: ['FREE'],
        colors: ['화이트', '민트'],
        stock: 20,
      },
    }),
    prisma.product.create({
      data: {
        name: '베이비 워싱 데님 팬츠',
        description: '부드러운 데님 소재로 아기 피부에 안전합니다. 허리 밴딩 처리로 편안하게 착용 가능합니다.',
        price: 28000,
        images: ['https://placehold.co/400x400/DBEAFE/2563EB?text=데님팬츠'],
        categoryId: categories[1].id,
        sizes: ['70', '80', '90'],
        colors: ['연청', '진청'],
        stock: 35,
      },
    }),
  ]);

  // 주문 샘플
  await prisma.order.create({
    data: {
      userId: user1.id,
      totalAmount: 80000,
      status: OrderStatus.DELIVERED,
      shippingName: '김민준',
      shippingPhone: '010-1234-5678',
      shippingAddress: '서울시 강남구 테헤란로 123',
      note: '계좌이체 완료했습니다.',
      items: {
        create: [
          { productId: products[0].id, quantity: 1, price: 35000, size: '60', color: '민트' },
          { productId: products[2].id, quantity: 1, price: 45000, size: '100', color: '블루' },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      userId: user1.id,
      totalAmount: 48000,
      status: OrderStatus.CANCELLED,
      shippingName: '김민준',
      shippingPhone: '010-1234-5678',
      shippingAddress: '서울시 강남구 테헤란로 123',
      items: {
        create: [
          { productId: products[3].id, quantity: 1, price: 48000, size: '130', color: '네이비' },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      userId: user2.id,
      totalAmount: 89000,
      status: OrderStatus.SHIPPING,
      shippingName: '이서연',
      shippingPhone: '010-9876-5432',
      shippingAddress: '서울시 마포구 홍대로 45',
      items: {
        create: [
          { productId: products[4].id, quantity: 1, price: 89000, size: 'FREE', color: '민트' },
        ],
      },
    },
  });

  // 관심상품
  await prisma.wishlist.createMany({
    data: [
      { userId: user1.id, productId: products[1].id },
      { userId: user1.id, productId: products[4].id },
      { userId: user2.id, productId: products[0].id },
    ],
    skipDuplicates: true,
  });

  // 리뷰
  await prisma.review.create({
    data: {
      userId: user1.id,
      productId: products[0].id,
      rating: 5,
      content: '정말 부드럽고 아기가 잘 입어요! 다음에도 구매할 예정입니다.',
    },
  });

  // 입출금 내역 샘플
  await prisma.transaction.createMany({
    data: [
      { userId: user1.id, type: TransactionType.DEPOSIT,    amount: 80000,  description: '주문 #1 입금',     date: new Date('2024-01-15') },
      { userId: user1.id, type: TransactionType.DEPOSIT,    amount: 70000,  description: '2월 구매 입금',    date: new Date('2024-02-03') },
      { userId: user1.id, type: TransactionType.WITHDRAWAL, amount: 30000,  description: '부분 환불',         date: new Date('2024-02-10') },
      { userId: user2.id, type: TransactionType.DEPOSIT,    amount: 89000,  description: '선물세트 입금',    date: new Date('2024-01-20') },
      { userId: user2.id, type: TransactionType.DEPOSIT,    amount: 50000,  description: '추가 주문 입금',   date: new Date('2024-03-05') },
    ],
    skipDuplicates: false,
  });

  // depositAmount 동기화
  await prisma.user.update({ where: { id: user1.id }, data: { depositAmount: 120000 } });
  await prisma.user.update({ where: { id: user2.id }, data: { depositAmount: 139000 } });

  // 취소 정책 초기화
  const existing = await prisma.cancelPolicy.findFirst();
  if (!existing) {
    await prisma.cancelPolicy.create({ data: { globalEnabled: false, timeLimit: null } });
  }

  console.log('시드 데이터 생성 완료!');
  console.log('어드민: admin@kkumbb.com / admin1234');
  console.log('사용자: kim@test.com / user1234');
  console.log('사용자: lee@test.com / user1234');
}

main().catch(console.error).finally(() => prisma.$disconnect());
