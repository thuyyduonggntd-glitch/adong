'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizeCategoryName } from '@/lib/productLocale';
import { CATEGORY_GROUPS, SEASONS, SEASON_GROUP } from '@/lib/categoryGroups';

type Category = { id: string; slug: string; name: string; [key: string]: any };

export default function CategoryGroupSidebar({ categories, activeCategory, activeSeason }: {
  categories: Category[];
  activeCategory?: string;
  activeSeason?: string;
}) {
  const { t, i18n } = useTranslation();
  const categoriesBySlug = new Map(categories.map((c) => [c.slug, c]));

  const activeGroupKey =
    CATEGORY_GROUPS.find((g) => activeCategory && g.slugs.includes(activeCategory as never))?.key ??
    (activeSeason ? SEASON_GROUP.key : undefined);

  const [openGroup, setOpenGroup] = useState<string | undefined>(activeGroupKey);

  return (
    <div className="space-y-1">
      {CATEGORY_GROUPS.map((group) => {
        const open = openGroup === group.key;
        return (
          <div key={group.key}>
            <button onClick={() => setOpenGroup(open ? undefined : group.key)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${open ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-primary-50'}`}>
              <span>{group.emoji} {t(group.labelKey)}</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {open && (
              <div className="pl-3 py-1 space-y-0.5">
                {group.slugs.map((slug) => {
                  const cat = categoriesBySlug.get(slug);
                  if (!cat) return null;
                  const active = activeCategory === cat.slug;
                  return (
                    <Link key={slug} href={`/home/products?category=${cat.slug}`}
                      className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${active ? 'bg-primary-600 text-white font-medium' : 'text-slate-600 hover:bg-primary-50'}`}>
                      {localizeCategoryName(cat, i18n.language)}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div>
        <button onClick={() => setOpenGroup(openGroup === SEASON_GROUP.key ? undefined : SEASON_GROUP.key)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${openGroup === SEASON_GROUP.key ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-primary-50'}`}>
          <span>{SEASON_GROUP.emoji} {t(SEASON_GROUP.labelKey)}</span>
          <svg className={`w-3.5 h-3.5 transition-transform ${openGroup === SEASON_GROUP.key ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {openGroup === SEASON_GROUP.key && (
          <div className="pl-3 py-1 space-y-0.5">
            {SEASONS.map((s) => {
              const active = activeSeason === s.ko;
              return (
                <Link key={s.key} href={`/home/products?season=${encodeURIComponent(s.ko)}`}
                  className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${active ? 'bg-primary-600 text-white font-medium' : 'text-slate-600 hover:bg-primary-50'}`}>
                  {t(`season.${s.key}`)}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
