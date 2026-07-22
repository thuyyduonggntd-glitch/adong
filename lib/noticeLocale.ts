const TRANSLATABLE_LANGS = ['en', 'vi', 'th', 'ru', 'mn', 'es'] as const;

export type LocalizableNotice = {
  type: 'MANUAL' | 'SALE' | 'CARRYOVER';
  title: string;
  content: string;
  brandName?: string | null;
  itemCount?: number;
  [key: string]: any;
};

/**
 * 세일/이월 자동 공지는 brandName+itemCount로 그 자리에서 문구를 조립하고,
 * 수동 공지는 저장된 언어별 번역 필드(title_en 등)를 사용. 번역이 없으면 한국어 원본으로 폴백.
 */
export function localizeNotice(
  notice: LocalizableNotice,
  t: (key: string, opts?: Record<string, any>) => string,
  lang: string
): { title: string; content: string } {
  if (notice.type === 'SALE' || notice.type === 'CARRYOVER') {
    const kind  = notice.type === 'SALE' ? 'sale' : 'carryover';
    const count = notice.itemCount ?? 1;
    const brand = notice.brandName ?? '';
    return {
      title: t(`notice.auto.${kind}Title`),
      content: t(`notice.auto.${kind}Content${count > 1 ? 'Many' : 'One'}`, { brand, count }),
    };
  }

  if ((TRANSLATABLE_LANGS as readonly string[]).includes(lang)) {
    return {
      title: notice[`title_${lang}`] || notice.title,
      content: notice[`content_${lang}`] || notice.content,
    };
  }
  return { title: notice.title, content: notice.content };
}
