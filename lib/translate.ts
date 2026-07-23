import { prisma } from '@/lib/prisma';

export const TRANSLATE_TARGET_LANGS = ['en', 'vi', 'th', 'ru', 'mn', 'es'] as const;
export type TranslateTargetLang = typeof TRANSLATE_TARGET_LANGS[number];

/** 한 언어로 여러 텍스트를 한 번의 API 호출로 번역 (할당량 절약) */
async function translateBatch(texts: string[], target: TranslateTargetLang): Promise<string[]> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_TRANSLATE_API_KEY is not set');

  const nonEmpty = texts.filter((t) => t && t.trim().length > 0);
  if (nonEmpty.length === 0) return texts.map(() => '');

  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, source: 'ko', target, format: 'text' }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google Translate API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const translations = data?.data?.translations as { translatedText: string }[] | undefined;
  if (!translations) throw new Error('Unexpected Google Translate API response shape');
  return translations.map((t) => t.translatedText);
}

export type ProductTranslatableFields = {
  name: string;
  description: string;
  gender: string | null;
  season: string | null;
  colors: string[];
};

export type ProductTranslationResult = Partial<Record<
  `name_${TranslateTargetLang}` | `description_${TranslateTargetLang}` | `gender_${TranslateTargetLang}` | `season_${TranslateTargetLang}`,
  string
>> & Partial<Record<`colors_${TranslateTargetLang}`, string[]>>;

/** 상품의 번역 대상 필드를 6개 언어로 번역. 언어별로 1번씩만 API 호출 (필드+색상 배열을 한 번에 묶어서 전송) */
export async function translateProductFields(fields: ProductTranslatableFields): Promise<ProductTranslationResult> {
  const { name, description, gender, season, colors } = fields;
  const colorsCount = colors.length;

  // 순서 고정: [name, description, gender, season, ...colors]
  const source = [name, description, gender ?? '', season ?? '', ...colors];

  const result: ProductTranslationResult = {};

  await Promise.all(
    TRANSLATE_TARGET_LANGS.map(async (lang) => {
      try {
        const translated = await translateBatch(source, lang);
        result[`name_${lang}`] = translated[0] || name;
        result[`description_${lang}`] = translated[1] || description;
        result[`gender_${lang}`] = gender ? (translated[2] || gender) : undefined;
        result[`season_${lang}`] = season ? (translated[3] || season) : undefined;
        result[`colors_${lang}`] = colorsCount > 0 ? translated.slice(4, 4 + colorsCount) : [];
      } catch (err) {
        // 번역 실패해도 저장 자체는 막지 않음 — 조용히 건너뛰고 한국어 원본으로 폴백
        console.error(`[translate] failed for lang=${lang}:`, err);
      }
    })
  );

  return result;
}

/** 번역 후 DB에 저장. 개별 create/update 훅과 일괄 번역 버튼에서 공용으로 사용 */
export async function translateAndSaveProduct(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, description: true, gender: true, season: true, colors: true },
  });
  if (!product) return;

  const result = await translateProductFields(product);
  await prisma.product.update({
    where: { id: productId },
    data: { ...result, translatedAt: new Date() },
  });
}

/** 카테고리명 6개 언어 번역 (단일 텍스트, 언어당 1회 호출) */
export async function translateAndSaveCategory(categoryId: string): Promise<void> {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { name: true } });
  if (!category) return;

  const result: Partial<Record<`name_${TranslateTargetLang}`, string>> = {};
  await Promise.all(
    TRANSLATE_TARGET_LANGS.map(async (lang) => {
      try {
        const [translated] = await translateBatch([category.name], lang);
        result[`name_${lang}`] = translated || category.name;
      } catch (err) {
        console.error(`[translate] category failed for lang=${lang}:`, err);
      }
    })
  );

  await prisma.category.update({
    where: { id: categoryId },
    data: { ...result, translatedAt: new Date() },
  });
}

/** 검색어 등 임의 텍스트를 한국어로 번역 (소스 언어 자동감지). 실패/미설정 시 null — 호출부는 원본 검색어만으로 폴백해야 함 */
export async function translateTextToKorean(text: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey || !text.trim()) return null;

  try {
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, target: 'ko', format: 'text' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const translated = data?.data?.translations?.[0]?.translatedText as string | undefined;
    return translated || null;
  } catch (err) {
    console.error('[translate] query->ko failed:', err);
    return null;
  }
}

/** 수동 공지(MANUAL)의 제목+내용을 6개 언어로 번역 (2개 필드를 한 번에 묶어서 언어당 1회 호출) */
export async function translateAndSaveNotice(noticeId: string): Promise<void> {
  const notice = await prisma.notice.findUnique({ where: { id: noticeId }, select: { title: true, content: true } });
  if (!notice) return;

  const source = [notice.title, notice.content];
  const result: Partial<Record<`title_${TranslateTargetLang}` | `content_${TranslateTargetLang}`, string>> = {};

  await Promise.all(
    TRANSLATE_TARGET_LANGS.map(async (lang) => {
      try {
        const translated = await translateBatch(source, lang);
        result[`title_${lang}`]   = translated[0] || notice.title;
        result[`content_${lang}`] = translated[1] || notice.content;
      } catch (err) {
        console.error(`[translate] notice failed for lang=${lang}:`, err);
      }
    })
  );

  await prisma.notice.update({ where: { id: noticeId }, data: { ...result, translatedAt: new Date() } });
}

/** 소스(한국어) 필드가 바뀌었는지 확인 — 바뀌지 않았으면 재번역 생략 */
export function productSourceChanged(
  before: ProductTranslatableFields,
  after: Partial<ProductTranslatableFields>
): boolean {
  if (after.name !== undefined && after.name !== before.name) return true;
  if (after.description !== undefined && after.description !== before.description) return true;
  if (after.gender !== undefined && after.gender !== before.gender) return true;
  if (after.season !== undefined && after.season !== before.season) return true;
  if (after.colors !== undefined && JSON.stringify(after.colors) !== JSON.stringify(before.colors)) return true;
  return false;
}
