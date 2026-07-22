import { prisma } from '@/lib/prisma';

export async function upsertBrandNotice(
  displayName: string,
  type: 'SALE' | 'CARRYOVER',
  incrementBy: number = 1
) {
  const label = type === 'SALE' ? '세일' : '이월';
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const existing = await prisma.notice.findFirst({
    where: { type, brandName: displayName, createdAt: { gte: todayStart } },
  });

  if (existing) {
    const newCount = existing.itemCount + incrementBy;
    await prisma.notice.update({
      where: { id: existing.id },
      data: {
        content: `${displayName} 상품 ${newCount}건이 ${label} 상품으로 등록되었습니다.`,
        itemCount: newCount,
      },
    });
  } else {
    await prisma.notice.create({
      data: {
        type,
        title: `신규 ${label} 상품 등록`,
        content: incrementBy > 1
          ? `${displayName} 상품 ${incrementBy}건이 ${label} 상품으로 등록되었습니다.`
          : `${displayName} 상품이 ${label} 상품으로 등록되었습니다.`,
        brandName: displayName,
        itemCount: incrementBy,
      },
    });
  }
}
