'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

type Brand = { id: string; name: string; image: string | null };

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const ETC = 'ETC';

export default function BrandSection({
  topBrands,
  allBrands,
}: {
  topBrands: Brand[];
  allBrands: Brand[];
}) {
  const { t } = useTranslation();
  const [letter, setLetter] = useState<string | null>(null);

  const filtered = letter === ETC
    ? allBrands.filter((b) => !ALPHABET.includes(b.name[0]?.toUpperCase()))
    : letter
      ? allBrands.filter((b) => b.name.toUpperCase().startsWith(letter))
      : null;

  const displayBrands = filtered ?? topBrands;
  const isFiltered    = letter !== null;
  const hasEtc = allBrands.some((b) => !ALPHABET.includes(b.name[0]?.toUpperCase()));

  const handleLetter = (l: string) => setLetter((prev) => (prev === l ? null : l));
  const handleEtc = () => hasEtc && setLetter((prev) => (prev === ETC ? null : ETC));

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-slate-700 flex items-center gap-1.5">
          {isFiltered ? (
            <>
              <span className="text-primary-600 font-mono text-lg">{letter === ETC ? t('brandFilter.etc') : letter}</span>
              <span className="text-slate-500 font-normal text-sm">{t('brandFilter.label')}</span>
              <span className="text-xs text-slate-400 font-normal ml-1">({filtered!.length})</span>
            </>
          ) : (
            <>
              <span className="text-primary-600">🏆</span> {t('home.popularBrands', { count: topBrands.length })}
            </>
          )}
        </h2>
        {isFiltered ? (
          <button onClick={() => setLetter(null)}
            className="text-xs text-slate-400 hover:text-primary-600 transition-colors flex items-center gap-1">
            {t('home.clearFilter')}
          </button>
        ) : (
          <Link href="/home/products" className="text-xs text-slate-400 hover:text-primary-600 transition-colors">
            {t('home.allProductsArrow')}
          </Link>
        )}
      </div>

      {/* A–Z 버튼 */}
      <div className="flex flex-wrap gap-1 mb-5">
        {ALPHABET.map((l) => {
          const hasAny = allBrands.some((b) => b.name.toUpperCase().startsWith(l));
          const active = letter === l;
          return (
            <button key={l} onClick={() => hasAny && handleLetter(l)} disabled={!hasAny}
              className={`w-7 h-7 text-xs font-bold rounded transition-colors leading-none
                ${active
                  ? 'bg-primary-600 text-white'
                  : hasAny
                    ? 'bg-white border border-slate-200 text-slate-600 hover:border-primary-400 hover:text-primary-600'
                    : 'bg-slate-50 text-slate-200 cursor-not-allowed border border-slate-100'
                }`}>
              {l}
            </button>
          );
        })}
        {/* 기타 (숫자·특수문자 등 A-Z로 시작하지 않는 브랜드) */}
        <button onClick={handleEtc} disabled={!hasEtc}
          className={`px-2 h-7 text-xs font-bold rounded transition-colors leading-none
            ${letter === ETC
              ? 'bg-primary-600 text-white'
              : hasEtc
                ? 'bg-white border border-slate-200 text-slate-600 hover:border-primary-400 hover:text-primary-600'
                : 'bg-slate-50 text-slate-200 cursor-not-allowed border border-slate-100'
            }`}>
          {t('brandFilter.etc')}
        </button>
      </div>

      {/* 브랜드 그리드 */}
      {isFiltered && filtered!.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">
          <p className="text-3xl mb-2">🔍</p>
          <p>{t('brandFilter.noResults', { letter: letter === ETC ? t('brandFilter.etc') : letter })}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {displayBrands.map((brand, i) => (
            <Link
              key={brand.id}
              href={`/home/products?brand=${encodeURIComponent(brand.name)}`}
              className="group relative flex flex-col overflow-hidden rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow border border-slate-100"
            >
              {!isFiltered && i < 3 && (
                <span className="absolute top-1.5 left-1.5 z-10 text-xs font-bold bg-primary-600 text-white w-5 h-5 rounded-full flex items-center justify-center leading-none">
                  {i + 1}
                </span>
              )}
              <div className="relative w-full aspect-square overflow-hidden bg-slate-50">
                <Image
                  src={brand.image ?? '/brand-default.svg'}
                  alt={brand.name}
                  fill
                  sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
                  className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="py-1.5 px-2 text-center">
                <span className="text-xs font-semibold text-slate-700 group-hover:text-primary-600 transition-colors leading-tight block truncate">
                  {brand.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
