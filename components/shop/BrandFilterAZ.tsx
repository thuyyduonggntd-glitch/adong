'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

type Brand = { id: string; name: string; image: string | null };

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface Props {
  brands: Brand[];
  activeBrand?: string;
}

export default function BrandFilterAZ({ brands, activeBrand }: Props) {
  const { t } = useTranslation();
  const router  = useRouter();
  const [letter, setLetter] = useState<string | null>(() => {
    if (!activeBrand) return null;
    const first = activeBrand[0]?.toUpperCase();
    return ALPHABET.includes(first) ? first : null;
  });

  const hasLetter = (l: string) => brands.some((b) => b.name.toUpperCase().startsWith(l));

  const filteredBrands = letter
    ? brands.filter((b) => b.name.toUpperCase().startsWith(letter))
    : [];

  const handleLetter = (l: string) => {
    if (!hasLetter(l)) return;
    setLetter((prev) => (prev === l ? null : l));
  };

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-2">{t('brandFilter.searchLabel')}</p>

      {/* A–Z 버튼 */}
      <div className="flex flex-wrap gap-1 mb-3">
        {ALPHABET.map((l) => {
          const active  = letter === l;
          const enabled = hasLetter(l);
          return (
            <button key={l} onClick={() => handleLetter(l)} disabled={!enabled}
              className={`w-7 h-7 text-xs font-bold rounded transition-colors leading-none
                ${active
                  ? 'bg-primary-600 text-white'
                  : enabled
                    ? 'bg-white border border-slate-200 text-slate-600 hover:border-primary-400 hover:text-primary-600'
                    : 'bg-slate-50 text-slate-200 cursor-not-allowed border border-slate-100'
                }`}>
              {l}
            </button>
          );
        })}
        {/* 선택 해제 */}
        {letter && (
          <button onClick={() => setLetter(null)}
            className="px-2 h-7 text-xs rounded border border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors ml-1">
            ✕
          </button>
        )}
      </div>

      {/* 브랜드 필터 결과 */}
      {letter && (
        filteredBrands.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">{t('brandFilter.noResults', { letter })}</p>
        ) : (
          <div className="flex flex-wrap gap-2 pb-1">
            {filteredBrands.map((b) => (
              <Link key={b.id} href={`/home/products?brand=${encodeURIComponent(b.name)}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                  ${activeBrand === b.name
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:border-primary-400 bg-white'
                  }`}>
                <span className="relative w-4 h-4 rounded-full overflow-hidden flex-shrink-0 bg-slate-100">
                  <Image src={b.image ?? '/brand-default.svg'} alt={b.name} fill className="object-cover" />
                </span>
                {b.name}
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}
