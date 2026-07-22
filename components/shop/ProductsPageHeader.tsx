'use client';
import { useTranslation } from 'react-i18next';
import { localizeCategoryName } from '@/lib/productLocale';

interface Props {
  isNew?: string;
  isOnSale?: string;
  isCarryOver?: string;
  sort?: string;
  brand?: string;
  season?: string;
  category?: { name: string; [key: string]: any };
  q?: string;
  count: number;
}

export default function ProductsPageHeader({ isNew, isOnSale, isCarryOver, sort, brand, season, category, q, count }: Props) {
  const { t, i18n } = useTranslation();
  const categoryName = localizeCategoryName(category, i18n.language);

  const title =
    isNew       === '1' ? t('nav.new') :
    isOnSale    === '1' ? t('nav.sale') :
    isCarryOver === '1' ? t('nav.carryover') :
    sort        === 'popular' ? t('nav.popular') :
    brand             ? t('products.titleBrand', { brand }) :
    season            ? t('products.titleSeason', { season }) :
    categoryName      ? categoryName :
    q                 ? t('products.titleSearch', { q }) : t('products.titleAll');

  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
      <p className="text-slate-500 text-sm mt-1">{t('products.count', { count })}</p>
    </div>
  );
}
