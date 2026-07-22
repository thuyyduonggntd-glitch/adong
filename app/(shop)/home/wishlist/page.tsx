'use client';
import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import ProductCard from '@/components/shop/ProductCard';

/* ────────────────────────────── 타입 ────────────────────────────── */
type WishProduct = {
  id: string;
  name: string;
  price: number;
  images: string[];
  brand: string | null;
  isOnSale: boolean;
  saleType: string | null;
  saleValue: number | null;
  category: { name: string } | null;
  myGradePrice?: number;
  myFinalPrice?: number;
};
type WishItem = { id: string; productId: string; product: WishProduct };

type BrandRecord = {
  id: string;
  name: string;
  image: string | null;
  notice: string | null;
};
type FavoriteBrand = { id: string; brandName: string; createdAt: string };

type Tab = 'products' | 'brands';

/* ────────────────────────────── 하트 버튼 ────────────────────────── */
function HeartBtn({ active, onClick, size = 'md' }: { active: boolean; onClick: () => void; size?: 'sm' | 'md' }) {
  const { t } = useTranslation();
  const sz = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <button onClick={onClick}
      className={`transition-transform active:scale-90 ${active ? 'text-red-500' : 'text-slate-300 hover:text-red-400'}`}
      aria-label={active ? t('wishlist.heartUnfav') : t('wishlist.heartFav')}>
      <svg className={sz} viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </button>
  );
}

/* ────────────────────────────── 메인 ────────────────────────────── */
export default function WishlistPage() {
  const { t } = useTranslation();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab]               = useState<Tab>('products');

  /* 관심상품 */
  const [wishItems, setWishItems]     = useState<WishItem[]>([]);
  const [wishLoading, setWishLoading] = useState(true);

  /* 관심브랜드 */
  const [allBrands, setAllBrands]         = useState<BrandRecord[]>([]);
  const [favBrands, setFavBrands]         = useState<FavoriteBrand[]>([]);
  const [brandLoading, setBrandLoading]   = useState(true);
  const [togglingBrand, setTogglingBrand] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if (status !== 'authenticated') return;

    Promise.all([
      fetch('/api/wishlist').then((r) => r.json()),
    ]).then(([w]) => {
      setWishItems(Array.isArray(w) ? w : []);
      setWishLoading(false);
    });

    Promise.all([
      fetch('/api/brands').then((r) => r.json()),
      fetch('/api/brands/favorite').then((r) => r.json()),
    ]).then(([brands, favs]) => {
      setAllBrands(Array.isArray(brands) ? brands : []);
      setFavBrands(Array.isArray(favs) ? favs : []);
      setBrandLoading(false);
    });
  }, [status, router]);

  /* ── 관심상품 제거 (ProductCard가 자체적으로 DELETE 호출 후 이 콜백으로 목록만 갱신) ── */
  const handleRemoveProduct = (productId: string) => {
    setWishItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  /* ── 관심브랜드 토글 ── */
  const favSet = useMemo(() => new Set(favBrands.map((f) => f.brandName)), [favBrands]);

  const handleToggleBrand = async (brandName: string) => {
    if (!session) { router.push('/login'); return; }
    const isFav = favSet.has(brandName);
    setTogglingBrand(brandName);
    await fetch('/api/brands/favorite', {
      method: isFav ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandName }),
    });
    if (isFav) {
      setFavBrands((prev) => prev.filter((f) => f.brandName !== brandName));
    } else {
      setFavBrands((prev) => [...prev, { id: Date.now().toString(), brandName, createdAt: new Date().toISOString() }]);
    }
    setTogglingBrand(null);
  };

  const favBrandsList = useMemo(() => allBrands.filter((b) => favSet.has(b.name)), [allBrands, favSet]);

  if (status === 'loading') return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent mx-auto" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">{t('wishlist.title')}</h1>

      {/* 탭 */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('products')}
          className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'products' ? 'bg-red-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-red-300'
          }`}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill={tab === 'products' ? 'white' : 'none'} stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {t('wishlist.tab.products')}
          {wishItems.length > 0 && (
            <span className={`text-xs font-normal ${tab === 'products' ? 'text-white/80' : 'text-slate-400'}`}>{wishItems.length}</span>
          )}
        </button>
        <button onClick={() => setTab('brands')}
          className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'brands' ? 'bg-red-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-red-300'
          }`}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill={tab === 'brands' ? 'white' : 'none'} stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          {t('wishlist.tab.brands')}
          {favBrands.length > 0 && (
            <span className={`text-xs font-normal ${tab === 'brands' ? 'text-white/80' : 'text-slate-400'}`}>{favBrands.length}</span>
          )}
        </button>
      </div>

      {/* ════════ 관심상품 탭 ════════ */}
      {tab === 'products' && (
        wishLoading ? (
          <div className="text-center py-16 text-slate-400">{t('wishlist.loading')}</div>
        ) : wishItems.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">🤍</div>
            <p className="mb-4">{t('wishlist.emptyProducts')}</p>
            <Link href="/home/products" className="btn-primary text-sm">{t('wishlist.browseProducts')}</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {wishItems.map((item) => (
              <ProductCard
                key={item.id}
                product={item.product}
                isWishlisted
                onWishlistToggle={handleRemoveProduct}
              />
            ))}
          </div>
        )
      )}

      {/* ════════ 관심브랜드 탭 ════════ */}
      {tab === 'brands' && (
        brandLoading ? (
          <div className="text-center py-16 text-slate-400">{t('wishlist.loading')}</div>
        ) : favBrandsList.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">🤍</div>
            <p>{t('wishlist.emptyBrands')}</p>
            <p className="text-xs mt-2 text-slate-300">{t('wishlist.emptyBrandsHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {favBrandsList.map((brand) => (
              <div key={brand.id} className="card p-4 flex items-center gap-3 border-red-100">
                {brand.image ? (
                  <div className="relative w-10 h-10 rounded-full overflow-hidden bg-slate-50 flex-shrink-0 border border-slate-100">
                    <Image src={brand.image} alt={brand.name} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary-50 flex-shrink-0 flex items-center justify-center text-primary-600 font-bold text-sm border border-primary-100">
                    {brand.name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <Link href={`/home/products?brand=${encodeURIComponent(brand.name)}`}
                    className="text-sm font-semibold text-slate-800 hover:text-primary-600 truncate block">
                    {brand.name}
                  </Link>
                </div>
                <HeartBtn active size="sm" onClick={() => handleToggleBrand(brand.name)} />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
