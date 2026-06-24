'use server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calcFinalPrice } from '@/lib/utils';

export async function getProductPrices(productIds: string[]) {
  if (!productIds.length) return [];

  const session = await getServerSession(authOptions);
  const grade   = (session?.user as any)?.dealerGrade ?? 'REGULAR';

  const products = await prisma.product.findMany({
    where:   { id: { in: productIds } },
    include: { prices: true },
  });

  return products.map((product) => {
    const gradePrice = product.prices.find((p) => p.grade === (grade as any));
    const basePrice  = gradePrice ? Number(gradePrice.price) : Number(product.price);
    const finalPrice = calcFinalPrice(basePrice, product.isOnSale, product.saleType, product.saleValue);
    return {
      id:          product.id,
      myGradePrice: basePrice,
      myFinalPrice: finalPrice,
      isOnSale:    product.isOnSale,
      saleType:    product.saleType  ?? null,
      saleValue:   product.saleValue ?? null,
      images:      product.images,
      colors:      product.colors,
      brand:       product.brand     ?? '',
    };
  });
}
