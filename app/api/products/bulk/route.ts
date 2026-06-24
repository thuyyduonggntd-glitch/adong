import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { products } = await req.json();
  const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (const p of products as any[]) {
    try {
      if (p.action === 'skip') { results.skipped++; continue; }

      // 카테고리 조회 또는 생성
      let category = await prisma.category.findFirst({
        where: { name: { equals: p.categoryName || '기타', mode: 'insensitive' } },
      });
      if (!category) {
        const name = p.categoryName || '기타';
        const slug = name.replace(/\s+/g, '-') + '-' + Date.now();
        category = await prisma.category.create({ data: { name, slug } });
      }

      const regularPrice = p.prices?.find((pr: any) => pr.grade === 'REGULAR')?.price ?? p.price ?? 0;
      const gradePrice   = (p.prices as { grade: string; price: number }[] | undefined)?.filter(pr => pr.price > 0) ?? [];

      const base = {
        name:          p.name || '',
        description:   p.description || '',
        price:         Number(regularPrice),
        images:        p.images || [],
        brand:         p.brand || null,
        productNumber: p.productNumber || null,
        material:      p.material || null,
        gender:        p.gender || null,
        productType:   p.productType || null,
        season:        p.season || null,
        sizeImages:    [],
        isOnSale:      false,
        saleType:      null,
        saleValue:     null,
        categoryId:    category.id,
        sizes:         p.sizes || [],
        colors:        p.colors || [],
        stock:         0,
        remark:        p.remark || null,
      };

      if (p.action === 'update' && p.existingId) {
        await prisma.product.update({
          where: { id: p.existingId },
          data:  {
            ...base,
            prices: {
              deleteMany: {},
              create: gradePrice.map(gp => ({ grade: gp.grade as any, price: Number(gp.price) })),
            },
          },
        });
        results.updated++;
      } else {
        await prisma.product.create({
          data: {
            ...base,
            prices: gradePrice.length > 0 ? {
              create: gradePrice.map(gp => ({ grade: gp.grade as any, price: Number(gp.price) })),
            } : undefined,
          },
        });
        results.created++;
      }
    } catch (e: any) {
      results.errors.push(`[${p.productNumber}] ${e.message}`);
    }
  }

  return NextResponse.json(results);
}
