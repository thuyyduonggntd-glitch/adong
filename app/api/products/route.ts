import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calcFinalPrice } from '@/lib/utils';

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

  const where: any = {
    ...(admin !== '1' ? { isActive: true } : {}),
    ...(category ? { category: { slug: category } } : {}),
    ...(q        ? { OR: [
      { name:        { contains: q, mode: 'insensitive' } },
      { brand:       { contains: q, mode: 'insensitive' } },
      { productType: { contains: q, mode: 'insensitive' } },
    ]} : {}),
    ...(brand    ? { brand: { contains: brand, mode: 'insensitive' } } : {}),
    ...(season   ? { season: { contains: season, mode: 'insensitive' } } : {}),
    ...(isOnSale === '1' ? { isOnSale: true } : {}),
    ...(isNew === '1'    ? { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } : {}),
  };

  const products = await prisma.product.findMany({
    where,
    include: { category: true, prices: true },
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
  if (!session || (session.user as any)?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const d = await req.json();
  const gradePrice = (d.prices as { grade: string; price: number }[] | undefined) ?? [];
  const regularPrice = gradePrice.find((p) => p.grade === 'REGULAR')?.price ?? Number(d.price ?? 0);

  const variantList = (d.variants as { color: string; size: string; stock: number }[] | undefined) ?? [];

  const product = await prisma.product.create({
    data: {
      name:          d.name,
      description:   d.description,
      price:         regularPrice,
      images:        d.images || [],
      brand:         d.brand        || null,
      productNumber: d.productNumber || null,
      material:      d.material     || null,
      gender:        d.gender       || null,
      productType:   d.productType  || null,
      season:        d.season       || null,
      sizeImages:    d.sizeImages   || [],
      isOnSale:      Boolean(d.isOnSale),
      saleType:      d.saleType     || null,
      saleValue:     d.saleValue    ? Number(d.saleValue) : null,
      categoryId:    d.categoryId,
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
    },
    include: { prices: true, variants: true },
  });
  return NextResponse.json(product);
}
