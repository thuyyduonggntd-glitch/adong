import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calcFinalPrice } from '@/lib/utils';
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

  // 미송(백오더) 처리된 항목이 남아있는지 — 상품 상세 페이지 배지 표시용
  const backorderItem = await prisma.orderItem.findFirst({
    where: { productId: product.id, unshippedAt: { not: null }, cancelledAt: null, arrivedAt: null },
    select: { id: true },
  });

  // 브랜드 정보 조회 (브랜드명이 있으면 DB에서 추가 정보 로드)
  const brandRecord = product.brand
    ? await prisma.brand.findUnique({ where: { name: product.brand } })
    : null;

  const gradePrice = product.prices.find((p) => p.grade === (grade as any));
  const basePrice  = gradePrice ? Number(gradePrice.price) : Number(product.price);
  const finalPrice = calcFinalPrice(basePrice, product.isOnSale, product.saleType, product.saleValue);

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

  return <ProductDetailClient product={productForClient as any} brandInfo={brandInfo} hasBackorder={!!backorderItem} />;
}
