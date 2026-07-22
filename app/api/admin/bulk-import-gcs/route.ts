import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';
import { downloadFromGCS, listProductImageUrls } from '@/lib/gcs';
import { CATEGORY_GROUPS } from '@/lib/categoryGroups';
import { translateAndSaveCategory } from '@/lib/translate';

// Vercel Pro 이상에서 최대 300초까지 허용 (Hobby 플랜은 60초로 강제 제한됨 — 데이터가 많으면 로컬에서 직접 호출 권장)
export const maxDuration = 300;

const TEMPLATE_PATH = 'templates/상품일괄등록_템플릿.xlsx';
const GROUP_KEY_BY_LABEL: Record<string, 'clothing' | 'item'> = { '의류': 'clothing', '아이템': 'item' };
const SIZE_CATEGORY_SLUGS = CATEGORY_GROUPS.find((g) => g.key === 'size')!.slugs as readonly string[];
const BATCH_SIZE = 500;

type ParsedRow = {
  productNumber: string; name: string; brand: string;
  categoryGroup: string; categoryName: string; sizeCategoryName: string;
  colors: string[]; sizes: string[];
  priceRegular: number; priceSilver: number; priceGold: number; priceVip: number;
  season: string; material: string; gender: string; productType: string;
  description: string; remark: string;
};

function parseExcel(buf: Buffer): ParsedRow[] {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  const header = rows[0].map((h: any) => String(h ?? '').trim());
  const col = (name: string) => header.indexOf(name);

  return rows.slice(1)
    .filter((row) => row.some((c) => c !== undefined && c !== ''))
    .map((row) => {
      const g = (name: string) => String(row[col(name)] ?? '').trim();
      return {
        productNumber: g('상품코드'),
        name: g('상품명'),
        brand: g('브랜드'),
        categoryGroup: g('카테고리 분류'),
        categoryName: g('카테고리'),
        sizeCategoryName: g('카테고리 사이즈'),
        colors: g('색상(쉼표구분)').split(',').map((s) => s.trim()).filter(Boolean),
        sizes: g('사이즈(쉼표구분)').split(',').map((s) => s.trim()).filter(Boolean),
        priceRegular: Number(row[col('일반가')] || 0),
        priceSilver: Number(row[col('SILVER가')] || 0),
        priceGold: Number(row[col('GOLD가')] || 0),
        priceVip: Number(row[col('VIP가')] || 0),
        season: g('시즌'),
        material: g('재질'),
        gender: g('성별') || '공용',
        productType: g('종류'),
        description: g('설명'),
        remark: g('비고'),
      };
    })
    .filter((p) => p.productNumber);
}

async function resolveCategory(p: ParsedRow) {
  const groupKey = GROUP_KEY_BY_LABEL[p.categoryGroup];
  let category = groupKey
    ? await prisma.category.findFirst({
        where: {
          name: { equals: p.categoryName || '기타', mode: 'insensitive' },
          slug: { in: [...CATEGORY_GROUPS.find((g) => g.key === groupKey)!.slugs] },
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
    translateAndSaveCategory(category.id).catch((err) => console.error('[bulk-import-gcs] category translate hook failed:', err));
  }

  let sizeCategoryId: string | null = null;
  if (p.sizeCategoryName) {
    const sizeCategory = await prisma.category.findFirst({
      where: { name: { equals: p.sizeCategoryName, mode: 'insensitive' }, slug: { in: [...SIZE_CATEGORY_SLUGS] } },
    });
    if (sizeCategory) sizeCategoryId = sizeCategory.id;
  }

  return { categoryId: category.id, sizeCategoryId };
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let buf: Buffer;
  try {
    buf = await downloadFromGCS(TEMPLATE_PATH);
  } catch (e: any) {
    return NextResponse.json({ error: `GCS에서 엑셀 템플릿을 다운로드하지 못했습니다 (${TEMPLATE_PATH}): ${e.message}` }, { status: 500 });
  }

  const parsedRows = parseExcel(buf);
  if (parsedRows.length === 0) return NextResponse.json({ error: '엑셀에서 유효한 상품 행을 찾을 수 없습니다.' }, { status: 400 });

  let created = 0, updated = 0, skipped = 0, failed = 0;
  const skipReasons: string[] = [];
  const failReasons: string[] = [];

  console.log(`[bulk-import-gcs] 시작: 총 ${parsedRows.length}개 상품`);

  for (let i = 0; i < parsedRows.length; i += BATCH_SIZE) {
    const batch = parsedRows.slice(i, i + BATCH_SIZE);

    for (const p of batch) {
      try {
        // 1) GCS에서 이미 업로드된 이미지 목록 조회 (순번 순서 그대로 = 색상 대표 먼저, 상세 나중)
        const images = await listProductImageUrls(p.productNumber);

        // 이미지가 0개면 완전히 스킵
        if (images.length === 0) {
          const reason = `[${p.productNumber}] 이미지 없음 - 스킵`;
          console.warn(`[bulk-import-gcs] ${reason}`);
          skipReasons.push(reason);
          skipped++;
          continue;
        }
        // 이미지가 색상 개수보다 적으면 경고만 남기고 있는 이미지로 진행
        if (images.length < p.colors.length) {
          console.warn(`[bulk-import-gcs] [${p.productNumber}] 경고 - 이미지 부족: 색상 ${p.colors.length}개, 이미지 ${images.length}개 (있는 이미지로 진행)`);
        }

        // 2) 브랜드 매칭 (자동 생성 안 함)
        const brand = await prisma.brand.findFirst({ where: { name: { equals: p.brand, mode: 'insensitive' } } });
        if (!brand) {
          const reason = `[${p.productNumber}] 브랜드 '${p.brand}'를 찾을 수 없음 - 스킵`;
          console.warn(`[bulk-import-gcs] ${reason}`);
          skipReasons.push(reason);
          skipped++;
          continue;
        }

        // 3) 카테고리 / 카테고리 사이즈 매칭
        const { categoryId, sizeCategoryId } = await resolveCategory(p);

        // 4) 등급별 가격 (있는 것만)
        const gradePrices = ([
          { grade: 'REGULAR' as const, price: p.priceRegular },
          { grade: 'SILVER' as const, price: p.priceSilver },
          { grade: 'GOLD' as const, price: p.priceGold },
          { grade: 'VIP' as const, price: p.priceVip },
        ]).filter((gp) => gp.price > 0);
        const basePrice = p.priceRegular || gradePrices[0]?.price || 0;

        const data = {
          name: p.name || '',
          description: p.description || '',
          price: basePrice,
          images,
          brand: brand.name,
          productNumber: p.productNumber,
          material: p.material || null,
          gender: p.gender || null,
          productType: p.productType || null,
          season: p.season || null,
          categoryId,
          sizeCategoryId,
          sizes: p.sizes,
          colors: p.colors,
          remark: p.remark || null,
        };

        // 5) productNumber 기준 중복 방지 (upsert 대신 조회 후 분기 — productNumber에 unique 제약이 없음)
        const existing = await prisma.product.findFirst({ where: { productNumber: p.productNumber } });

        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: { ...data, prices: { deleteMany: {}, create: gradePrices } },
          });
          updated++;
        } else {
          const variantList = (p.colors.length > 0 && p.sizes.length > 0)
            ? p.colors.flatMap((color) => p.sizes.map((size) => ({ color, size, stock: 500 })))
            : [];
          await prisma.product.create({
            data: {
              ...data,
              stock: 0,
              prices: gradePrices.length > 0 ? { create: gradePrices } : undefined,
              variants: variantList.length > 0 ? { create: variantList } : undefined,
            },
          });
          created++;
        }
      } catch (e: any) {
        const reason = `[${p.productNumber}] ${e.message}`;
        console.error(`[bulk-import-gcs] 실패 - ${reason}`);
        failReasons.push(reason);
        failed++;
      }
    }

    console.log(`[bulk-import-gcs] 진행률: ${Math.min(i + BATCH_SIZE, parsedRows.length)}/${parsedRows.length}`);
  }

  const summary = {
    success: created + updated,
    created, updated,
    skipped, failed,
    total: parsedRows.length,
    skipReasons,
    failReasons,
  };
  console.log('[bulk-import-gcs] 완료:', { total: parsedRows.length, success: summary.success, skipped, failed });

  return NextResponse.json(summary);
}
