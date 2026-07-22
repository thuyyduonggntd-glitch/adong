'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrice, getSaleLabel, calcFinalPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cart';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { localizeCategoryName } from '@/lib/productLocale';

type BrandInfo = {
  notice: string | null;
  sizeInfo: string | null; sizeImages: string[];
  modelInfo: string | null; modelImages: string[];
} | null;

interface Props {
  product: any;
  brandInfo?: BrandInfo;
  hasBackorder?: boolean;
}

export default function ProductDetailClient({ product, brandInfo, hasBackorder }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  // 표시용 번역 필드 — 색상/시즌 등 필터·재고매칭에 쓰이는 원본 값(product.colors, product.season)은 그대로 두고
  // 화면에 보여줄 텍스트만 번역본으로 교체한다.
  const localizedName        = product[`name_${lang}`] || product.name;
  const localizedDescription = product[`description_${lang}`] || product.description;
  const localizedMaterial    = product[`material_${lang}`] || product.material;
  const localizedGender      = product[`gender_${lang}`] || product.gender;
  const localizedSeason      = product[`season_${lang}`] || product.season;
  const localizedColors: string[] = (product[`colors_${lang}`]?.length ? product[`colors_${lang}`] : product.colors) ?? [];
  const localizedCategoryName = localizeCategoryName(product.category, lang);
  const { data: session } = useSession();
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);

  const [selectedSize, setSelectedSize]     = useState('');
  const [selectedColor, setSelectedColor]   = useState('');
  const [quantity, setQuantity]             = useState(1);
  const [wishlisted, setWishlisted]         = useState(false);
  const [brandFaved, setBrandFaved]         = useState(false);
  const [togglingBrand, setTogglingBrand]   = useState(false);
  const [added, setAdded]                   = useState(false);
  const [sizeImgIdx, setSizeImgIdx]         = useState(0);
  const [mainImgIdx, setMainImgIdx]         = useState(0);

  const basePrice       = product.myGradePrice ?? product.price;
  const displayPrice    = product.myFinalPrice ?? calcFinalPrice(basePrice, product.isOnSale, product.saleType, product.saleValue);
  const hasDiscount     = product.isOnSale && displayPrice < basePrice;
  const sizeExtraPrices = (product.sizeExtraPrices as Record<string, number>) ?? {};
  const sizeSurcharge   = sizeExtraPrices[selectedSize] ?? 0;
  const finalPrice      = displayPrice + sizeSurcharge;

  const selectedVariant = product.variants?.find(
    (v: { color: string; size: string; stock: number }) => v.color === selectedColor && v.size === selectedSize
  );
  const variantStock  = selectedVariant?.stock ?? null;
  const isOutOfStock  = variantStock !== null && variantStock <= 0;

  const handleAddCart = () => {
    if (!session) { router.push('/login'); return; }
    if (!selectedSize || !selectedColor) { alert(t('product.selectSizeColorAlert')); return; }
    if (isOutOfStock) { alert(t('product.outOfStockAlert')); return; }
    const effectivePrice = finalPrice;
    const colorIdx = product.colors.indexOf(selectedColor);
    const colorImage = (colorIdx >= 0 && product.images[colorIdx]) ? product.images[colorIdx] : product.images[0];
    addItem({ id: product.id, name: localizedName, price: effectivePrice, image: colorImage }, quantity, selectedSize, selectedColor);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleOrder = () => {
    if (!session) { router.push('/login'); return; }
    if (!selectedSize || !selectedColor) { alert(t('product.selectSizeColorAlert')); return; }
    handleAddCart();
    router.push('/home/cart');
  };

  useEffect(() => {
    if (!session || !product.brand) return;
    fetch('/api/brands/favorite').then((r) => r.json()).then((favs) => {
      if (Array.isArray(favs)) setBrandFaved(favs.some((f: { brandName: string }) => f.brandName === product.brand));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleWishlist = async () => {
    if (!session) { router.push('/login'); return; }
    const method = wishlisted ? 'DELETE' : 'POST';
    await fetch('/api/wishlist', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: product.id }) });
    setWishlisted(!wishlisted);
  };

  const handleBrandFav = async () => {
    if (!session) { router.push('/login'); return; }
    if (!product.brand || togglingBrand) return;
    setTogglingBrand(true);
    await fetch('/api/brands/favorite', {
      method: brandFaved ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandName: product.brand }),
    });
    setBrandFaved(!brandFaved);
    setTogglingBrand(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid md:grid-cols-2 gap-10">
        {/* 이미지 */}
        <div className="space-y-3">
          <div className="relative aspect-square bg-primary-50 rounded-2xl overflow-hidden">
            <Image src={product.images[mainImgIdx] || 'https://placehold.co/600x600/EFF6FF/2563EB?text=상품'} alt={localizedName} fill className="object-cover" />
            {session && product.isOnSale && (
              <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md">
                {getSaleLabel(product.saleType, product.saleValue, t('common.discount'))}
              </span>
            )}
            {hasBackorder && (
              <span className="absolute top-3 right-3 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-md">
                {t('product.backorderBadge')}
              </span>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {product.images.map((img: string, i: number) => (
                <button key={i} onClick={() => setMainImgIdx(i)}
                  className={`relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${mainImgIdx === i ? 'border-primary-500' : 'border-slate-100 hover:border-primary-400'}`}>
                  <Image src={img} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 정보 */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Link href={`/home/products?category=${product.category?.slug}`}
              className="badge bg-primary-100 text-primary-700 text-xs hover:bg-primary-200 transition-colors cursor-pointer">
              {localizedCategoryName}
            </Link>
            {product.brand && (
              <span className="inline-flex items-center gap-1">
                <Link href={`/home/products?brand=${encodeURIComponent(product.brand)}`}
                  className="badge bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer">
                  {product.brand}
                </Link>
                <button onClick={handleBrandFav} disabled={togglingBrand}
                  title={brandFaved ? t('product.removeFavoriteBrand') : t('product.addFavoriteBrand')}
                  className={`p-0.5 rounded transition-colors disabled:opacity-40 ${brandFaved ? 'text-red-500' : 'text-slate-300 hover:text-red-400'}`}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={brandFaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </span>
            )}
            {product.season && (
              <Link href={`/home/products?season=${encodeURIComponent(product.season)}`}
                className="badge bg-amber-100 text-amber-700 text-xs hover:bg-amber-200 transition-colors cursor-pointer">
                {localizedSeason}
              </Link>
            )}
            {product.productType && (
              <Link href={`/home/products?productType=${encodeURIComponent(product.productType)}`}
                className="badge bg-violet-100 text-violet-700 text-xs hover:bg-violet-200 transition-colors cursor-pointer">
                {product.productType}
              </Link>
            )}
          </div>

          <h1 className="text-2xl font-bold text-slate-800 mt-1 mb-1">{localizedName}</h1>

          {/* 가격 (등급별) */}
          <div className="mb-4">
            {!session ? (
              <p className="text-lg font-medium text-slate-400">{t('product.loginToView')}</p>
            ) : (
              <>
                {hasDiscount ? (
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-lg text-slate-400 line-through">{formatPrice(basePrice + sizeSurcharge)}</span>
                      <span className="text-slate-300 text-base">→</span>
                      <span className="text-3xl font-bold text-red-600">{formatPrice(finalPrice)}</span>
                    </div>
                    <span className="inline-block text-sm font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">
                      {getSaleLabel(product.saleType, product.saleValue, t('common.discount'))}
                      {' '}{t('product.discountSaved', { amount: (basePrice - displayPrice).toLocaleString() })}
                    </span>
                    {sizeSurcharge > 0 && (
                      <span className="inline-block text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded ml-1">
                        {t('product.sizeSurcharge', { amount: sizeSurcharge.toLocaleString() })}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-3xl font-bold text-primary-700">{formatPrice(finalPrice)}</p>
                    {sizeSurcharge > 0 && (
                      <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
                        {t('product.sizeAddedSuffix', { amount: sizeSurcharge.toLocaleString() })}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 상품 정보 테이블 */}
          <div className="mb-5 rounded-xl border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-50">
                {product.brand && (
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500 w-28">{t('product.maker')}</td>
                    <td className="px-4 py-2.5 text-slate-700">{product.brand}{product.season ? ` (${localizedSeason})` : ''}</td>
                  </tr>
                )}
                {product.productNumber && (
                  <tr>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">{t('product.productNumber')}</td>
                    <td className="px-4 py-2.5 text-slate-700 font-mono text-xs">{product.productNumber}</td>
                  </tr>
                )}
                {(product.material || product.gender) && (
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">{t('product.materialGender')}</td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {[localizedMaterial, localizedGender].filter(Boolean).join(' / ')}
                    </td>
                  </tr>
                )}
                {product.sizes?.length > 0 && (
                  <tr>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">{t('product.sizeCount')}</td>
                    <td className="px-4 py-2.5 text-slate-700">{t('product.sizeCountValue', { sizes: product.sizes.join('-'), count: product.sizes.length })}</td>
                  </tr>
                )}
                {product.productType && (
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">{t('product.type')}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/home/products?productType=${encodeURIComponent(product.productType)}`}
                        className="text-violet-700 hover:underline text-sm">
                        {product.productType}
                      </Link>
                    </td>
                  </tr>
                )}
                {session && hasDiscount && (
                  <tr>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">{t('product.discount')}</td>
                    <td className="px-4 py-2.5 font-bold text-red-500">
                      {t('product.discountArrow', { label: getSaleLabel(product.saleType, product.saleValue, t('common.discount')), price: formatPrice(displayPrice) })}
                      <span className="font-normal text-red-400 ml-1">{t('product.discountSaved', { amount: (basePrice - displayPrice).toLocaleString() })}</span>
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">{t('product.sizeOrderLabel')}</td>
                  <td className="px-4 py-2.5 text-slate-700">{t('product.sizeOrderValue')}</td>
                </tr>
                {product.description && (
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">{t('product.notice')}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs leading-relaxed">{localizedDescription}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 비고 */}
          {product.remark && (
            <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-amber-800 font-medium">{product.remark}</p>
            </div>
          )}

          {/* 사이즈 선택 */}
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">{t('product.sizeSelect')} <span className="text-xs text-slate-400 font-normal">{t('product.sizeSelectHint')}</span></p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s: string) => {
                const extra = sizeExtraPrices[s] ?? 0;
                return (
                  <button key={s} onClick={() => setSelectedSize(s)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${selectedSize === s ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-300 text-slate-600 hover:border-primary-400'}`}>
                    {s}
                    {session && extra > 0 && (
                      <span className={`ml-1 text-xs ${selectedSize === s ? 'text-primary-100' : 'text-orange-500'}`}>
                        +{extra.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 색상 선택 */}
          <div className="mb-5">
            <p className="text-sm font-semibold text-slate-700 mb-2">{t('product.color')}</p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c: string, i: number) => (
                <button key={c} onClick={() => {
                  setSelectedColor(c);
                  if (product.images[i]) setMainImgIdx(i);
                }}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${selectedColor === c ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-300 text-slate-600 hover:border-primary-400'}`}>
                  {localizedColors[i] || c}
                </button>
              ))}
            </div>
          </div>

          {/* 재고 표시 */}
          {selectedColor && selectedSize && (
            <div className="mb-3">
              {isOutOfStock ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                  {t('product.outOfStock')}
                </span>
              ) : variantStock !== null ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  {t('product.stock', { count: variantStock })}
                </span>
              ) : null}
            </div>
          )}

          {/* 수량 */}
          <div className="flex items-center gap-3 mb-5">
            <p className="text-sm font-semibold text-slate-700">{t('product.quantity')}</p>
            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-slate-600 hover:bg-slate-100">-</button>
              <span className="px-4 py-2 text-sm font-medium">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="px-3 py-2 text-slate-600 hover:bg-slate-100">+</button>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-3 mb-3">
            <button onClick={handleWishlist} className={`p-3 rounded-xl border transition-colors ${wishlisted ? 'border-red-300 text-red-500' : 'border-slate-300 text-slate-500 hover:border-red-300'}`}>
              <svg className={`w-6 h-6 ${wishlisted ? 'fill-red-500' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
            <button onClick={handleAddCart} disabled={isOutOfStock} className={`flex-1 btn-outline ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isOutOfStock ? t('product.outOfStock') : added ? t('product.added') : t('product.addToCart')}
            </button>
            <button onClick={handleOrder} disabled={isOutOfStock} className={`flex-1 btn-primary ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isOutOfStock ? t('product.outOfStock') : t('product.order')}
            </button>
          </div>
        </div>
      </div>

      {/* ── 브랜드 정보 ── */}
      {brandInfo && (brandInfo.notice || brandInfo.sizeInfo || brandInfo.sizeImages.length > 0 || brandInfo.modelInfo || brandInfo.modelImages.length > 0) && (
        <div className="mt-8 space-y-4">
          {/* 공지사항 */}
          {brandInfo.notice && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              <div>
                <p className="text-xs font-bold text-amber-700 mb-0.5">{t('product.brandNotice')}</p>
                <p className="text-sm text-amber-800 whitespace-pre-wrap">{brandInfo.notice}</p>
              </div>
            </div>
          )}

          {/* 사이즈 정보 */}
          {(brandInfo.sizeInfo || brandInfo.sizeImages.length > 0) && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                <p className="text-xs font-bold text-slate-600">{t('product.brandSizeInfo')}</p>
              </div>
              <div className="px-4 py-3 space-y-3">
                {brandInfo.sizeInfo && (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{brandInfo.sizeInfo}</p>
                )}
                {brandInfo.sizeImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {brandInfo.sizeImages.map((u, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden border border-slate-100">
                        <Image src={u} alt={`size ${i + 1}`} width={200} height={200} className="object-contain max-h-48 w-auto" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 모델 정보 */}
          {(brandInfo.modelInfo || brandInfo.modelImages.length > 0) && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                <p className="text-xs font-bold text-slate-600">{t('product.brandModelInfo')}</p>
              </div>
              <div className="px-4 py-3 space-y-3">
                {brandInfo.modelInfo && (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{brandInfo.modelInfo}</p>
                )}
                {brandInfo.modelImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {brandInfo.modelImages.map((u, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden border border-slate-100">
                        <Image src={u} alt={`model ${i + 1}`} width={200} height={200} className="object-contain max-h-48 w-auto" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 상세 사이즈 이미지 ── */}
      {product.sizeImages && product.sizeImages.length > 0 && (
        <div className="mt-12 border-t border-slate-100 pt-10">
          <h2 className="text-lg font-bold text-slate-800 mb-5">{t('product.detailSizeTitle')}</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 mb-4">
            {product.sizeImages.map((img: string, i: number) => (
              <button key={i} onClick={() => setSizeImgIdx(i)}
                className={`relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${sizeImgIdx === i ? 'border-primary-500' : 'border-slate-200'}`}>
                <Image src={img} alt={`detail ${i + 1}`} fill className="object-cover" />
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-lg rounded-2xl overflow-hidden border border-slate-100">
            <Image src={product.sizeImages[sizeImgIdx]} alt="detail size" width={600} height={600} className="w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
