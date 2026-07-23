import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';
import { translateAndSaveCategory } from '@/lib/translate';
import { CATEGORY_GROUPS } from '@/lib/categoryGroups';

const GROUP_KEY_BY_LABEL: Record<string, 'clothing' | 'item'> = { '의류': 'clothing', '아이템': 'item' };
const SIZE_CATEGORY_SLUGS = CATEGORY_GROUPS.find(g => g.key === 'size')!.slugs as readonly string[];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { products } = await req.json();
  const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (const p of products as any[]) {
    try {
      if (p.action === 'skip') { results.skipped++; continue; }

      // 카테고리 조회: 분류(대분류)가 주어지면 해당 그룹 내에서 우선 검색
      const groupKey = GROUP_KEY_BY_LABEL[String(p.categoryGroup || '').trim()];
      let category = groupKey
        ? await prisma.category.findFirst({
            where: {
              name: { equals: p.categoryName || '기타', mode: 'insensitive' },
              slug: { in: [...CATEGORY_GROUPS.find(g => g.key === groupKey)!.slugs] },
            },
          })
        : null;
      if (!category) {
        category = await prisma.category.findFirst({
          where: { name: { equals: p.categoryName || '기타', mode: 'insensitive' } },
        });
      }
      if (!category) {
        const name = p.categoryName || '기타';
        const slug = name.replace(/\s+/g, '-') + '-' + Date.now();
        category = await prisma.category.create({ data: { name, slug } });
        translateAndSaveCategory(category.id).catch((err) => console.error('[translate] category create hook failed:', err));
      }

      // 카테고리 사이즈: size 그룹 내에서만 검색, 없으면 미지정 + 경고만 남김
      let sizeCategoryId: string | null = null;
      const sizeCategoryName = String(p.sizeCategoryName || '').trim();
      if (sizeCategoryName) {
        const sizeCategory = await prisma.category.findFirst({
          where: { name: { equals: sizeCategoryName, mode: 'insensitive' }, slug: { in: [...SIZE_CATEGORY_SLUGS] } },
        });
        if (sizeCategory) sizeCategoryId = sizeCategory.id;
        else results.errors.push(`[${p.productNumber}] 사이즈카테고리 '${sizeCategoryName}'를 찾을 수 없어 미지정으로 등록했습니다.`);
      }

      const regularPrice = p.prices?.find((pr: any) => pr.grade === 'REGULAR')?.price ?? p.price ?? 0;
      const gradePrice   = (p.prices as { grade: string; price: number }[] | undefined)?.filter(pr => pr.price > 0) ?? [];

      // 세일률 우선 적용, 없으면 세일가(정가보다 낮을 때)를 할인금액으로 환산
      const saleRate  = Number(p.saleRate || 0);
      const salePrice = Number(p.salePrice || 0);
      let isOnSale = false;
      let saleType: 'RATE' | 'AMOUNT' | null = null;
      let saleValue: number | null = null;
      if (saleRate > 0) {
        isOnSale = true;
        saleType = 'RATE';
        saleValue = saleRate;
      } else if (salePrice > 0 && salePrice < regularPrice) {
        isOnSale = true;
        saleType = 'AMOUNT';
        saleValue = regularPrice - salePrice;
      }

      const base = {
        name:          p.name || '',
        description:   p.description || '',
        price:         Number(regularPrice),
        images:        p.images || [],
        brand:         p.brand || null,
        productNumber: p.productNumber || null,
        gender:        p.gender || null,
        season:        p.season || null,
        sizeImages:    [],
        isOnSale,
        saleType,
        saleValue,
        categoryId:    category.id,
        sizeCategoryId,
        sizes:         p.sizes || [],
        colors:        p.colors || [],
        stock:         0,
        remark:        p.remark || null,
      };

      // 색상별 사이즈:수량 → variant 목록 (색상마다 사이즈 구성/수량이 달라도 그대로 반영됨)
      const colorRows = (p.colorRows as { color: string; sizeQty: { size: string; stock: number }[] }[] | undefined) ?? [];
      const variantList = colorRows.flatMap(cr => cr.sizeQty.map(sq => ({ color: cr.color, size: sq.size, stock: sq.stock })));
      const colorImageList = (p.colorImages as { color: string; imageUrl: string }[] | undefined) ?? [];

      if (p.action === 'update' && p.existingId) {
        // 재업로드 시 재고/색상이미지는 시트 내용으로 전체 덮어쓴다 (시트에 없는 기존 조합은 삭제됨)
        await prisma.product.update({
          where: { id: p.existingId },
          data:  {
            ...base,
            prices: {
              deleteMany: {},
              create: gradePrice.map(gp => ({ grade: gp.grade as any, price: Number(gp.price) })),
            },
            variants: { deleteMany: {}, create: variantList },
            colorImages: { deleteMany: {}, create: colorImageList },
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
            variants: variantList.length > 0 ? { create: variantList } : undefined,
            colorImages: colorImageList.length > 0 ? { create: colorImageList } : undefined,
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
