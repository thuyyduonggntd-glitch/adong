'use client';
import { useTranslation } from 'react-i18next';

export default function HomeSearchForm() {
  const { t } = useTranslation();
  return (
    <form action="/home/products" method="get" className="flex gap-2 mb-4">
      <input
        type="text"
        name="q"
        placeholder={t('home.searchPlaceholder')}
        className="input flex-1 text-base shadow-sm"
      />
      <button type="submit" className="btn-primary px-6 shadow-sm">{t('home.searchButton')}</button>
    </form>
  );
}
