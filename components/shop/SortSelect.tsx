'use client';
import { useTranslation } from 'react-i18next';

export default function SortSelect({ defaultValue }: { defaultValue?: string }) {
  const { t } = useTranslation();
  return (
    <select
      className="input w-auto text-sm"
      defaultValue={defaultValue || 'newest'}
      onChange={(e) => {
        const u = new URL(window.location.href);
        u.searchParams.set('sort', e.target.value);
        window.location.href = u.toString();
      }}
    >
      <option value="newest">{t('products.sortNewest')}</option>
      <option value="price_asc">{t('products.sortPriceAsc')}</option>
      <option value="price_desc">{t('products.sortPriceDesc')}</option>
    </select>
  );
}
