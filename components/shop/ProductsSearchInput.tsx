'use client';
import { useTranslation } from 'react-i18next';

export default function ProductsSearchInput({ defaultValue }: { defaultValue?: string }) {
  const { t } = useTranslation();
  return (
    <>
      <input type="text" name="q" defaultValue={defaultValue} placeholder={t('products.searchPlaceholder')} className="input flex-1" />
      <button type="submit" className="btn-primary px-4">{t('products.searchButton')}</button>
    </>
  );
}
