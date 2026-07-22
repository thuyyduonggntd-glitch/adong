import { Prisma } from '@prisma/client';

// 한국어 원본 + 자동 번역된 언어별 이름 필드 (Google Cloud Translation API 결과)
const SEARCHABLE_NAME_FIELDS = ['name', 'name_en', 'name_vi', 'name_th', 'name_ru', 'name_mn', 'name_es'] as const;

/** 상품명(다국어) + 브랜드 + 종류를 부분 일치(대소문자 무시)로 검색하는 OR 조건 */
export function buildProductSearchWhere(q: string): Prisma.ProductWhereInput {
  return {
    OR: [
      ...SEARCHABLE_NAME_FIELDS.map(
        (field) => ({ [field]: { contains: q, mode: 'insensitive' } } as Prisma.ProductWhereInput)
      ),
      { brand: { contains: q, mode: 'insensitive' } },
      { productType: { contains: q, mode: 'insensitive' } },
    ],
  };
}
