'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useCartStore } from '@/store/cart';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import NotificationBell from '@/components/NotificationBell';
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher';
import { CATEGORY_GROUPS, SEASONS, SEASON_GROUP } from '@/lib/categoryGroups';
import { localizeCategoryName } from '@/lib/productLocale';

type Category = { id: string; slug: string; name: string; [key: string]: any };

function QnaBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center leading-tight inline-block">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function Header() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const pathname = usePathname();
  const count = useCartStore((s) => s.count());
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [qnaCount, setQnaCount] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    fetch('/api/products/categories')
      .then((r) => r.json())
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const categoriesBySlug = new Map(categories.map((c) => [c.slug, c]));

  useEffect(() => {
    if (!session) { setQnaCount(0); return; }
    fetch('/api/qna?myAnswerUnseenCount=1')
      .then((r) => r.json())
      .then((d) => setQnaCount(d.count ?? 0))
      .catch(() => {});
  }, [session, pathname]);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-end py-1 border-b border-slate-50">
        <LanguageSwitcher />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/home" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary-700 notranslate">{t('brand.name')}</span>
            <span className="text-xs text-slate-400 hidden sm:block">{t('brand.tagline')}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-600">
            <Link href="/home/products?isNew=1"       className="text-primary-600 font-bold hover:text-primary-700 transition-colors">{t('nav.new')}</Link>
            <Link href="/home/products?isOnSale=1"    className="text-red-500 font-bold hover:text-red-600 transition-colors">{t('nav.sale')}</Link>
            <Link href="/home/products?isCarryOver=1" className="text-slate-600 font-bold hover:text-slate-800 transition-colors">{t('nav.carryover')}</Link>
            <Link href="/home/products?sort=popular"  className="text-slate-600 font-bold hover:text-slate-800 transition-colors">{t('nav.popular')}</Link>
            <div className="relative">
              <button onClick={() => setCategoryMenuOpen(!categoryMenuOpen)} className="text-slate-600 font-bold hover:text-slate-800 transition-colors flex items-center gap-1">
                {t('nav.category')}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {categoryMenuOpen && (
                <div className="absolute left-0 mt-2 w-[640px] bg-white rounded-xl shadow-lg border border-slate-100 p-5 z-50 grid grid-cols-4 gap-6">
                  {CATEGORY_GROUPS.map((group) => (
                    <div key={group.key}>
                      <p className="text-sm font-bold text-slate-800 mb-2">{group.emoji} {t(group.labelKey)}</p>
                      <div className="space-y-1">
                        {group.slugs.map((slug) => {
                          const cat = categoriesBySlug.get(slug);
                          if (!cat) return null;
                          return (
                            <Link key={slug} href={`/home/products?category=${cat.slug}`}
                              className="block text-sm text-slate-600 hover:text-primary-600 transition-colors"
                              onClick={() => setCategoryMenuOpen(false)}>
                              {localizeCategoryName(cat, i18n.language)}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div>
                    <p className="text-sm font-bold text-slate-800 mb-2">{SEASON_GROUP.emoji} {t(SEASON_GROUP.labelKey)}</p>
                    <div className="space-y-1">
                      {SEASONS.map((s) => (
                        <Link key={s.key} href={`/home/products?season=${encodeURIComponent(s.ko)}`}
                          className="block text-sm text-slate-600 hover:text-primary-600 transition-colors"
                          onClick={() => setCategoryMenuOpen(false)}>
                          {t(`season.${s.key}`)}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Link href="/home/qna"      className="text-black hover:text-primary-600 transition-colors flex items-center">{t('nav.qna')}<QnaBadge count={qnaCount} /></Link>
            <Link href="/home/orders"   className="text-black hover:text-primary-600 transition-colors">{t('nav.orders')}</Link>
            <Link href="/home/wishlist" className="text-black hover:text-red-500 transition-colors">{t('nav.wishlist')}</Link>
            <Link href="/home/mypage"   className="text-black hover:text-primary-600 transition-colors">{t('nav.mypage')}</Link>
          </nav>

          <div className="flex items-center gap-3">
            {session && <NotificationBell />}

            <Link href="/home/cart" className="relative p-2 text-slate-600 hover:text-primary-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {mounted && count > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </Link>

            {session ? (
              <div className="relative">
                <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-1 text-sm text-slate-700 hover:text-primary-600">
                  <span>{session.user?.name}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50">
                    <Link href="/home/orders"   className="block px-4 py-2 text-sm text-slate-700 hover:bg-primary-50" onClick={() => setMenuOpen(false)}>{t('nav.orderManage')}</Link>
                    <Link href="/home/wishlist" className="block px-4 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-1.5" onClick={() => setMenuOpen(false)}>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                      {t('nav.wishlistFull')}
                    </Link>
                    <Link href="/home/mypage"          className="block px-4 py-2 text-sm text-slate-700 hover:bg-primary-50" onClick={() => setMenuOpen(false)}>{t('nav.mypageFull')}</Link>
                    <Link href="/home/qna"             className="px-4 py-2 text-sm text-slate-700 hover:bg-primary-50 flex items-center" onClick={() => setMenuOpen(false)}>{t('nav.qna')}<QnaBadge count={qnaCount} /></Link>
                    {(session.user as any)?.role === 'ADMIN' && (
                      <Link href="/admin/dashboard" className="block px-4 py-2 text-sm text-primary-600 hover:bg-primary-50" onClick={() => setMenuOpen(false)}>{t('nav.admin')}</Link>
                    )}
                    <hr className="my-1" />
                    <button onClick={() => { signOut({ callbackUrl: '/login' }); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50">{t('nav.logout')}</button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="btn-primary text-sm py-1.5 px-4">{t('nav.login')}</Link>
            )}

            <button className="md:hidden p-2 text-slate-600" onClick={() => setMenuOpen(!menuOpen)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 py-3 space-y-1">
            <Link href="/home/products?isNew=1"         className="block px-4 py-2 text-sm text-primary-600 font-bold hover:bg-primary-50 rounded-lg" onClick={() => setMenuOpen(false)}>✨ {t('nav.new')}</Link>
            <Link href="/home/products?isOnSale=1"      className="block px-4 py-2 text-sm text-red-500 font-bold hover:bg-red-50 rounded-lg"         onClick={() => setMenuOpen(false)}>🔥 {t('nav.sale')}</Link>
            <Link href="/home/products?isCarryOver=1"   className="block px-4 py-2 text-sm text-slate-600 font-bold hover:bg-slate-100 rounded-lg"     onClick={() => setMenuOpen(false)}>📦 {t('nav.carryover')}</Link>
            <Link href="/home/products?sort=popular"    className="block px-4 py-2 text-sm text-slate-600 font-bold hover:bg-slate-100 rounded-lg"  onClick={() => setMenuOpen(false)}>{t('nav.popular')}</Link>
            <div className="my-1 border-t border-slate-100" />
            <p className="px-4 py-1 text-xs font-semibold text-slate-500">{t('nav.category')}</p>
            {CATEGORY_GROUPS.map((group) => (
              <div key={group.key} className="px-4 py-2">
                <p className="text-xs font-semibold text-slate-500 mb-2">{group.emoji} {t(group.labelKey)}</p>
                <div className="flex flex-wrap gap-2">
                  {group.slugs.map((slug) => {
                    const cat = categoriesBySlug.get(slug);
                    if (!cat) return null;
                    return (
                      <Link key={slug} href={`/home/products?category=${cat.slug}`}
                        className="px-3 py-1 rounded-full text-xs font-medium border border-slate-200 text-slate-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
                        onClick={() => setMenuOpen(false)}>
                        {localizeCategoryName(cat, i18n.language)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="px-4 py-2">
              <p className="text-xs font-semibold text-slate-500 mb-2">{SEASON_GROUP.emoji} {t(SEASON_GROUP.labelKey)}</p>
              <div className="flex flex-wrap gap-2">
                {SEASONS.map((s) => (
                  <Link key={s.key} href={`/home/products?season=${encodeURIComponent(s.ko)}`}
                    className="px-3 py-1 rounded-full text-xs font-medium border border-slate-200 text-slate-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
                    onClick={() => setMenuOpen(false)}>
                    {t(`season.${s.key}`)}
                  </Link>
                ))}
              </div>
            </div>
            <div className="my-1 border-t border-slate-100" />
            <Link href="/home/qna"      className="px-4 py-2 text-sm text-black hover:bg-primary-50 rounded-lg flex items-center" onClick={() => setMenuOpen(false)}>{t('nav.qna')}<QnaBadge count={qnaCount} /></Link>
            <Link href="/home/orders"   className="block px-4 py-2 text-sm text-black hover:bg-primary-50 rounded-lg" onClick={() => setMenuOpen(false)}>{t('nav.orders')}</Link>
            <Link href="/home/wishlist" className="block px-4 py-2 text-sm text-black hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={() => setMenuOpen(false)}>{t('nav.wishlist')}</Link>
            <Link href="/home/mypage" className="block px-4 py-2 text-sm text-black hover:bg-primary-50 rounded-lg" onClick={() => setMenuOpen(false)}>{t('nav.mypage')}</Link>
          </div>
        )}
      </div>
    </header>
  );
}
