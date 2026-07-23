import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';
import { calcFinalPrice } from '@/lib/utils';
import { upsertBrandNotice } from '@/lib/notify';
import { translateAndSaveProduct } from '@/lib/translate';
import { buildProductSearchWhere } from '@/lib/productSearch';

// 어드민 상품 목록에 실제로 쓰이는 필드만 — description/번역 텍스트 등 무거운 컬럼은 제외
const ADMIN_PRODUCT_SELECT = {
  id: true, name: true, price: true, stock: true, isActive: true,
  images: true, brand: true, productNumber: true, season: true,
  isOnSale: true, saleType: true, saleValue: true, isCarryOver: true,
  gender: true, remark: true,
  sizes: true, colors: true,
  category: { select: { name: true } },
  prices: { select: { grade: true, price: true } },
} as const;

// 고객용 목록에 실제로 쓰이는 필드만 — 번역 필드는 i18n 폴백을 위해 함께 포함
const CUSTOMER_PRODUCT_SELECT = {
  id: true, name: true,
  name_en: true, name_vi: true, name_th: true, name_ru: true, name_mn: true, name_es: true,
  images: true, price: true, isOnSale: true, saleType: true, saleValue: true, isCarryOver: true, updatedAt: true,
  category: {
    select: {
      name: true,
      name_en: true, name_vi: true, name_th: true, name_ru: true, name_mn: true, name_es: true,
    },
  },
  prices: { select: { grade: true, price: true } },
} as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category  = searchParams.get('category');
  const q         = searchParams.get('q');
  const admin     = searchParams.get('admin');
  const sort      = searchParams.get('sort');
  const brand     = searchParams.get('brand');
  const season    = searchParams.get('season');
  const isNew     = searchParams.get('isNew');
  const isOnSale  = searchParams.get('isOnSale');

  const conditions: any[] = [];
  if (admin !== '1') conditions.push({ isActive: true });
  if (category) conditions.push({ OR: [{ category: { slug: category } }, { sizeCategory: { slug: category } }] });
  if (q)        conditions.push(await buildProductSearchWhere(q));
  if (brand)    conditions.push({ brand: { contains: brand, mode: 'insensitive' } });
  if (season)   conditions.push({ season: { contains: season, mode: 'insensitive' } });
  if (isOnSale === '1') conditions.push({ isOnSale: true });
  if (isNew === '1')    conditions.push({ createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } });

  const where: any = conditions.length > 0 ? { AND: conditions } : {};

  const products = await prisma.product.findMany({
    where,
    select: admin === '1' ? ADMIN_PRODUCT_SELECT : CUSTOMER_PRODUCT_SELECT,
    orderBy: sort === 'price_asc' ? { price: 'asc' } : sort === 'price_desc' ? { price: 'desc' } : { createdAt: 'desc' },
  });

  if (admin === '1') return NextResponse.json(products);

  // 고객용: 세션에서 등급 확인 후 해당 가격만 반환
  const session = await getServerSession(authOptions);
  const grade = (session?.user as any)?.dealerGrade ?? 'REGULAR';

  const result = products.map((p) => {
    const gradePrice = p.prices.find((pr) => pr.grade === grade);
    const basePrice  = gradePrice ? Number(gradePrice.price) : Number(p.price);
    const finalPrice = calcFinalPrice(basePrice, p.isOnSale, p.saleType, p.saleValue);
    return { ...p, prices: undefined, myGradePrice: basePrice, myFinalPrice: finalPrice };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const d = await req.json();
  const gradePrice = (d.prices as { grade: string; price: number }[] | undefined) ?? [];
  const regularPrice = gradePrice.find((p) => p.grade === 'REGULAR')?.price ?? Number(d.price ?? 0);

  const variantList = (d.variants as { color: string; size: string; stock: number }[] | undefined) ?? [];
  const colorImageList = (d.colorImages as { color: string; imageUrl: string }[] | undefined) ?? [];

  const product = await prisma.product.create({
    data: {
      name:          d.name,
      description:   d.description,
      price:         regularPrice,
      images:        d.images || [],
      brand:         d.brand        || null,
      productNumber: d.productNumber || null,
      gender:        d.gender       || null,
      season:        d.season       || null,
      sizeImages:      d.sizeImages      || [],
      sizeExtraPrices: d.sizeExtraPrices || null,
      isOnSale:        Boolean(d.isOnSale),
      saleType:      d.saleType     || null,
      saleValue:     d.saleValue    ? Number(d.saleValue) : null,
      categoryId:    d.categoryId || null,
      sizeCategoryId: d.sizeCategoryId || null,
      sizes:         d.sizes        || [],
      colors:        d.colors       || [],
      stock:         Number(d.stock || 0),
      remark:        d.remark || null,
      prices: gradePrice.length > 0 ? {
        create: gradePrice.map((gp) => ({ grade: gp.grade as any, price: Number(gp.price) })),
      } : undefined,
      variants: variantList.length > 0 ? {
        create: variantList.map((v) => ({ color: v.color, size: v.size, stock: Number(v.stock ?? 0) })),
      } : undefined,
      colorImages: colorImageList.length > 0 ? {
        create: colorImageList.map((c) => ({ color: c.color, imageUrl: c.imageUrl })),
      } : undefined,
    },
    include: { prices: true, variants: true, colorImages: true },
  });

  const displayName = product.brand?.trim() || product.name;
  if (product.isOnSale)    await upsertBrandNotice(displayName, 'SALE');
  if (product.isCarryOver) await upsertBrandNotice(displayName, 'CARRYOVER');

  // 자동 번역 — 저장 응답을 지연시키지 않도록 백그라운드로 실행
  translateAndSaveProduct(product.id).catch((err) => console.error('[translate] create hook failed:', err));

  return NextResponse.json(product);
}
