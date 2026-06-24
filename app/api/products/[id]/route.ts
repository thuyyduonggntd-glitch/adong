import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calcFinalPrice } from '@/lib/utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as any)?.role === 'ADMIN';
  const grade   = (session?.user as any)?.dealerGrade ?? 'REGULAR';

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      prices: true,
      variants: true,
      reviews: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (isAdmin) return NextResponse.json(product);

  // 고객용: 등급 가격 + SALE 적용
  const gradePrice = product.prices.find((pr) => pr.grade === grade);
  const basePrice  = gradePrice ? Number(gradePrice.price) : Number(product.price);
  const finalPrice = calcFinalPrice(basePrice, product.isOnSale, product.saleType, product.saleValue);

  return NextResponse.json({ ...product, prices: undefined, myGradePrice: basePrice, myFinalPrice: finalPrice });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const d = await req.json();
  const { prices: gradePrice, variants, ...rest } = d;

  const regularPrice = Array.isArray(gradePrice)
    ? gradePrice.find((p: any) => p.grade === 'REGULAR')?.price
    : undefined;

  const updateData: any = { ...rest };
  if (regularPrice !== undefined) updateData.price = Number(regularPrice);
  delete updateData.wholesalePrice;
  if (updateData.saleValue) updateData.saleValue = Number(updateData.saleValue);
  else if (updateData.saleValue === null || updateData.saleValue === '') updateData.saleValue = null;
  if (updateData.stock !== undefined) updateData.stock = Number(updateData.stock);
  if (updateData.price !== undefined) updateData.price = Number(updateData.price);

  // 등급별 가격 upsert
  if (Array.isArray(gradePrice)) {
    await Promise.all(
      gradePrice.map((gp: { grade: string; price: number }) =>
        prisma.productPrice.upsert({
          where:  { productId_grade: { productId: params.id, grade: gp.grade as any } },
          create: { productId: params.id, grade: gp.grade as any, price: Number(gp.price) },
          update: { price: Number(gp.price) },
        })
      )
    );
  }

  // 색상+사이즈 조합 재고 upsert
  if (Array.isArray(variants)) {
    await prisma.productVariant.deleteMany({ where: { productId: params.id } });
    if (variants.length > 0) {
      await prisma.productVariant.createMany({
        data: variants.map((v: any) => ({
          productId: params.id,
          color:     v.color,
          size:      v.size,
          stock:     Number(v.stock ?? 0),
        })),
      });
    }
  }

  const product = await prisma.product.update({
    where: { id: params.id },
    data:  updateData,
    include: { prices: true, variants: true },
  });
  return NextResponse.json(product);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await prisma.product.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
