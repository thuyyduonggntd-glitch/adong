import { Prisma } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import { translateTextToKorean } from './translate';

// 한국어 원본 + 자동 번역된 언어별 이름/시즌 필드 (Google Cloud Translation API 결과)
const SEARCHABLE_NAME_FIELDS = ['name', 'name_en', 'name_vi', 'name_th', 'name_ru', 'name_mn', 'name_es'] as const;
const SEARCHABLE_SEASON_FIELDS = ['season', 'season_en', 'season_vi', 'season_th', 'season_ru', 'season_mn', 'season_es'] as const;
const SEARCHABLE_CATEGORY_NAME_FIELDS = ['name', 'name_en', 'name_vi', 'name_th', 'name_ru', 'name_mn', 'name_es'] as const;

// 검색어 -> 한국어 번역 결과를 캐싱 (동일 검색어에 매번 번역 API를 호출하지 않도록)
const getCachedKoreanTranslation = unstable_cache(
  (q: string) => translateTextToKorean(q),
  ['product-search-query-ko'],
  { revalidate: 3600 }
);

function tokenMatchClause(token: string): Prisma.ProductWhereInput {
  return {
    OR: [
      ...SEARCHABLE_NAME_FIELDS.map(
        (field) => ({ [field]: { contains: token, mode: 'insensitive' } } as Prisma.ProductWhereInput)
      ),
      ...SEARCHABLE_SEASON_FIELDS.map(
        (field) => ({ [field]: { contains: token, mode: 'insensitive' } } as Prisma.ProductWhereInput)
      ),
      { brand: { contains: token, mode: 'insensitive' } },
      { category: { OR: SEARCHABLE_CATEGORY_NAME_FIELDS.map(
        (field) => ({ [field]: { contains: token, mode: 'insensitive' } })
      ) } },
    ],
  };
}

/**
 * 상품명(다국어) + 브랜드 + 시즌 + 카테고리를 검색.
 * - 검색어를 공백 기준으로 나눠 모든 단어가 (어느 필드에서든) 매칭되어야 함
 * - 검색어를 한국어로 자동 번역한 결과로도 함께 검색 — 상품별 번역 완료 여부와 무관하게
 *   어떤 언어로 검색해도 원본 한국어 상품명과 매칭될 수 있게 한다.
 */
export async function buildProductSearchWhere(q: string): Promise<Prisma.ProductWhereInput> {
  const trimmed = q.trim();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return {};

  const variants: Prisma.ProductWhereInput[] = [
    { AND: tokens.map(tokenMatchClause) },
  ];

  const translated = await getCachedKoreanTranslation(trimmed).catch(() => null);
  if (translated && translated.trim().toLowerCase() !== trimmed.toLowerCase()) {
    const translatedTokens = translated.trim().split(/\s+/).filter(Boolean);
    if (translatedTokens.length > 0) {
      variants.push({ AND: translatedTokens.map(tokenMatchClause) });
    }
  }

  return { OR: variants };
}
