const TRANSLATABLE_LANGS = ['en', 'vi', 'th', 'ru', 'mn', 'es'] as const;

/** FAQ 카테고리 표시 순서 — 관리자/회원 화면에서 공용으로 사용 */
export const FAQ_CATEGORY_ORDER = ['주문방법', '배송방법', '교환반품', '결제'];

/** 지정된 카테고리 순서를 기준으로 정렬 (목록에 없는 카테고리는 뒤로) */
export function sortByFaqCategoryOrder(categories: string[]): string[] {
  return [...categories].sort((a, b) => {
    const ai = FAQ_CATEGORY_ORDER.indexOf(a);
    const bi = FAQ_CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export type LocalizableFaq = {
  question: string;
  answer: string;
  [key: string]: any;
};

/** 저장된 언어별 번역 필드(question_en 등)를 사용. 번역이 없으면 한국어 원본으로 폴백. */
export function localizeFaq(
  faq: LocalizableFaq,
  lang: string
): { question: string; answer: string } {
  if ((TRANSLATABLE_LANGS as readonly string[]).includes(lang)) {
    return {
      question: faq[`question_${lang}`] || faq.question,
      answer: faq[`answer_${lang}`] || faq.answer,
    };
  }
  return { question: faq.question, answer: faq.answer };
}

/** 카테고리는 4개로 고정된 값이라 Google 번역 대신 i18n 문구(locales/*.json의 faq.category.*)로 관리한다.
    목록에 없는(관리자가 새로 추가한) 카테고리는 원본 문자열 그대로 표시. */
const FAQ_CATEGORY_I18N_KEY: Record<string, string> = {
  '주문방법': 'orderMethod',
  '배송방법': 'shipping',
  '교환반품': 'exchange',
  '결제': 'payment',
};

export function localizeFaqCategory(category: string, t: (key: string) => string): string {
  const key = FAQ_CATEGORY_I18N_KEY[category];
  return key ? t(`faq.category.${key}`) : category;
}
