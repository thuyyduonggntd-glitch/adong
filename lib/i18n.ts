'use client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from '@/locales/ko.json';
import en from '@/locales/en.json';
import vi from '@/locales/vi.json';
import th from '@/locales/th.json';
import ru from '@/locales/ru.json';
import mn from '@/locales/mn.json';
import es from '@/locales/es.json';

export const LANGUAGE_STORAGE_KEY = 'kkumbb_lang';

export const SUPPORTED_LANGUAGES = [
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'th', label: 'ภาษาไทย', flag: '🇹🇭' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'mn', label: 'Монгол', flag: '🇲🇳' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
] as const;

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        ko: { translation: ko },
        en: { translation: en },
        vi: { translation: vi },
        th: { translation: th },
        ru: { translation: ru },
        mn: { translation: mn },
        es: { translation: es },
      },
      lng: 'ko',
      fallbackLng: 'ko',
      keySeparator: false,
      nsSeparator: false,
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
}

export default i18n;
