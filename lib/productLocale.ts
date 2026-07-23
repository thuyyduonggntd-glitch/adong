const TRANSLATABLE_LANGS = ['en', 'vi', 'th', 'ru', 'mn', 'es'] as const;

/** 선택된 언어에 맞는 필드로 상품 데이터를 치환. 번역이 없으면 한국어 원본으로 폴백 */
export function localizeProduct<T extends {
  name: string; description?: string | null; gender?: string | null;
  season?: string | null; colors?: string[]; [key: string]: any;
}>(product: T, lang: string): T {
  if (!product || !(TRANSLATABLE_LANGS as readonly string[]).includes(lang)) return product;

  const pick = (field: string) => product[`${field}_${lang}`] ?? product[field];

  return {
    ...product,
    name:        pick('name'),
    description: pick('description'),
    gender:      pick('gender'),
    season:      pick('season'),
    colors:      (product[`colors_${lang}`] && product[`colors_${lang}`].length > 0) ? product[`colors_${lang}`] : product.colors,
  };
}

/** 카테고리 이름을 선택된 언어로. 번역 없으면 한국어 원본 */
export function localizeCategoryName(category: { name: string; [key: string]: any } | null | undefined, lang: string): string | undefined {
  if (!category) return undefined;
  return category[`name_${lang}`] || category.name;
}
