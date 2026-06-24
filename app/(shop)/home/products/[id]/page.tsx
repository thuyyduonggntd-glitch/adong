import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calcFinalPrice, DEALER_GRADE_LABELS } from '@/lib/utils';
import { notFound } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const grade   = (session?.user as any)?.dealerGrade ?? 'REGULAR';

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: { category: true, prices: true, variants: true },
  });

  if (!product) notFound();

  // 브랜드 정보 조회 (브랜드명이 있으면 DB에서 추가 정보 로드)
  const brandRecord = product.brand
    ? await prisma.brand.findUnique({ where: { name: product.brand } })
    : null;

  const gradePrice = product.prices.find((p) => p.grade === (grade as any));
  const basePrice  = gradePrice ? Number(gradePrice.price) : Number(product.price);
  const finalPrice = calcFinalPrice(basePrice, product.isOnSale, product.saleType, product.saleValue);

  const gradeLabel = DEALER_GRADE_LABELS[grade as keyof typeof DEALER_GRADE_LABELS] ?? '일반회원';

  const { prices: _prices, ...productRest } = product;
  const productForClient = {
    ...productRest,
    price:        Number(product.price),
    saleValue:    product.saleValue ?? null,
    myGradePrice: basePrice,
    myFinalPrice: finalPrice,
  };

  const brandInfo = brandRecord ? {
    notice:      brandRecord.notice,
    sizeInfo:    brandRecord.sizeInfo,
    sizeImages:  brandRecord.sizeImages,
    modelInfo:   brandRecord.modelInfo,
    modelImages: brandRecord.modelImages,
  } : null;

  return <ProductDetailClient product={productForClient as any} gradeLabel={gradeLabel} brandInfo={brandInfo} />;
}
