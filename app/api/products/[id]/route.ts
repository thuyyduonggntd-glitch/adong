import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';
import { calcFinalPrice } from '@/lib/utils';
import { upsertBrandNotice } from '@/lib/notify';
import { translateAndSaveProduct, productSourceChanged } from '@/lib/translate';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const isAdmin = hasAdminAccess((session?.user as any)?.role);
  const grade   = (session?.user as any)?.dealerGrade ?? 'REGULAR';

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      sizeCategory: true,
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
  if (!session || !hasAdminAccess((session.user as any)?.role))
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
  if (!updateData.categoryId) updateData.categoryId = null;
  if (!updateData.sizeCategoryId) updateData.sizeCategoryId = null;

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

  const prevProduct = await prisma.product.findUnique({
    where: { id: params.id },
    select: {
      isOnSale: true, isCarryOver: true,
      name: true, description: true, material: true, gender: true, season: true, colors: true,
    },
  });

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

  try {
    const product = await prisma.product.update({
      where: { id: params.id },
      data:  updateData,
      include: { prices: true, variants: true },
    });

    const displayName = product.brand?.trim() || product.name;
    if (product.isOnSale && !prevProduct?.isOnSale)
      await upsertBrandNotice(displayName, 'SALE');
    if (product.isCarryOver && !prevProduct?.isCarryOver)
      await upsertBrandNotice(displayName, 'CARRYOVER');

    // 한국어 원본(이름/설명/소재/성별/시즌/색상)이 바뀐 경우에만 재번역 — 저장 응답은 지연시키지 않음
    if (prevProduct && productSourceChanged(prevProduct, updateData)) {
      translateAndSaveProduct(product.id).catch((err) => console.error('[translate] update hook failed:', err));
    }

    revalidatePath(`/home/products/${params.id}`);
    return NextResponse.json(product);
  } catch (e: any) {
    console.error('[PATCH /api/products/:id]', e);
    return NextResponse.json({ error: e?.message ?? 'DB error' }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await prisma.product.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
