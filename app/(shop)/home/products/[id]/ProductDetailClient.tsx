'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrice, getSaleLabel, calcFinalPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cart';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type BrandInfo = {
  notice: string | null;
  sizeInfo: string | null; sizeImages: string[];
  modelInfo: string | null; modelImages: string[];
} | null;

interface Props {
  product: any;
  gradeLabel: string;
  brandInfo?: BrandInfo;
}

export default function ProductDetailClient({ product, gradeLabel, brandInfo }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);

  const [selectedSize, setSelectedSize]   = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity]           = useState(1);
  const [wishlisted, setWishlisted]       = useState(false);
  const [added, setAdded]                 = useState(false);
  const [sizeImgIdx, setSizeImgIdx]       = useState(0);
  const [mainImgIdx, setMainImgIdx]       = useState(0);

  const basePrice    = product.myGradePrice ?? product.price;
  const displayPrice = product.myFinalPrice ?? calcFinalPrice(basePrice, product.isOnSale, product.saleType, product.saleValue);
  const hasDiscount  = product.isOnSale && displayPrice < basePrice;

  const selectedVariant = product.variants?.find(
    (v: { color: string; size: string; stock: number }) => v.color === selectedColor && v.size === selectedSize
  );
  const variantStock  = selectedVariant?.stock ?? null;
  const isOutOfStock  = variantStock !== null && variantStock <= 0;

  const handleAddCart = () => {
    if (!selectedSize || !selectedColor) { alert('사이즈와 색상을 선택해주세요.'); return; }
    if (isOutOfStock) { alert('품절된 상품입니다.'); return; }
    const effectivePrice = product.myFinalPrice ?? product.myGradePrice ?? product.price;
    const colorIdx = product.colors.indexOf(selectedColor);
    const colorImage = (colorIdx >= 0 && product.images[colorIdx]) ? product.images[colorIdx] : product.images[0];
    addItem({ id: product.id, name: product.name, price: effectivePrice, image: colorImage }, quantity, selectedSize, selectedColor);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleOrder = () => {
    if (!session) { router.push('/login'); return; }
    if (!selectedSize || !selectedColor) { alert('사이즈와 색상을 선택해주세요.'); return; }
    handleAddCart();
    router.push('/home/cart');
  };

  const handleWishlist = async () => {
    if (!session) { router.push('/login'); return; }
    const method = wishlisted ? 'DELETE' : 'POST';
    await fetch('/api/wishlist', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: product.id }) });
    setWishlisted(!wishlisted);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid md:grid-cols-2 gap-10">
        {/* 이미지 */}
        <div className="space-y-3">
          <div className="relative aspect-square bg-primary-50 rounded-2xl overflow-hidden">
            <Image src={product.images[mainImgIdx] || 'https://placehold.co/600x600/EFF6FF/2563EB?text=상품'} alt={product.name} fill className="object-cover" />
            {product.isOnSale && (
              <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md">
                {getSaleLabel(product.saleType, product.saleValue)}
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
              {product.category?.name}
            </Link>
            {product.brand && (
              <Link href={`/home/products?brand=${encodeURIComponent(product.brand)}`}
                className="badge bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer">
                {product.brand}
              </Link>
            )}
            {product.season && (
              <Link href={`/home/products?season=${encodeURIComponent(product.season)}`}
                className="badge bg-amber-100 text-amber-700 text-xs hover:bg-amber-200 transition-colors cursor-pointer">
                {product.season}
              </Link>
            )}
            {product.productType && (
              <Link href={`/home/products?productType=${encodeURIComponent(product.productType)}`}
                className="badge bg-violet-100 text-violet-700 text-xs hover:bg-violet-200 transition-colors cursor-pointer">
                {product.productType}
              </Link>
            )}
          </div>

          <h1 className="text-2xl font-bold text-slate-800 mt-1 mb-1">{product.name}</h1>

          {/* 가격 (등급별) */}
          <div className="mb-4">
            <p className="text-xs text-slate-400 mb-1">
              내 등급 가격 ({gradeLabel})
            </p>
            {hasDiscount ? (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-lg text-slate-400 line-through">{formatPrice(basePrice)}</span>
                  <span className="text-slate-300 text-base">→</span>
                  <span className="text-3xl font-bold text-red-600">{formatPrice(displayPrice)}</span>
                </div>
                <span className="inline-block text-sm font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">
                  {getSaleLabel(product.saleType, product.saleValue)}
                  {' '}(–{(basePrice - displayPrice).toLocaleString()}원)
                </span>
              </div>
            ) : (
              <p className="text-3xl font-bold text-primary-700">{formatPrice(displayPrice)}</p>
            )}
          </div>

          {/* 상품 정보 테이블 */}
          <div className="mb-5 rounded-xl border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-50">
                {product.brand && (
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500 w-28">Maker</td>
                    <td className="px-4 py-2.5 text-slate-700">{product.brand}{product.season ? ` (${product.season})` : ''}</td>
                  </tr>
                )}
                {product.productNumber && (
                  <tr>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">제품번호</td>
                    <td className="px-4 py-2.5 text-slate-700 font-mono text-xs">{product.productNumber}</td>
                  </tr>
                )}
                {(product.material || product.gender) && (
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">재질/성별</td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {[product.material, product.gender].filter(Boolean).join(' / ')}
                    </td>
                  </tr>
                )}
                {product.sizes?.length > 0 && (
                  <tr>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">싸이즈/장수</td>
                    <td className="px-4 py-2.5 text-slate-700">{product.sizes.join('-')}......{product.sizes.length}장</td>
                  </tr>
                )}
                {product.productType && (
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">종류</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/home/products?productType=${encodeURIComponent(product.productType)}`}
                        className="text-violet-700 hover:underline text-sm">
                        {product.productType}
                      </Link>
                    </td>
                  </tr>
                )}
                {hasDiscount && (
                  <tr>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">할인</td>
                    <td className="px-4 py-2.5 font-bold text-red-500">
                      {getSaleLabel(product.saleType, product.saleValue)}
                      {' '}→ {formatPrice(displayPrice)}
                      <span className="font-normal text-red-400 ml-1">(–{(basePrice - displayPrice).toLocaleString()}원 절약)</span>
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">SIZE ORDER</td>
                  <td className="px-4 py-2.5 text-slate-700">사이즈 가능.</td>
                </tr>
                {product.description && (
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">공지사항</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs leading-relaxed">{product.description}</td>
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
            <p className="text-sm font-semibold text-slate-700 mb-2">사이즈 선택 <span className="text-xs text-slate-400 font-normal">아래를 선택하여 주문하여 주십시요.</span></p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s: string) => (
                <button key={s} onClick={() => setSelectedSize(s)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${selectedSize === s ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-300 text-slate-600 hover:border-primary-400'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 색상 선택 */}
          <div className="mb-5">
            <p className="text-sm font-semibold text-slate-700 mb-2">색상</p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c: string, i: number) => (
                <button key={c} onClick={() => {
                  setSelectedColor(c);
                  if (product.images[i]) setMainImgIdx(i);
                }}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${selectedColor === c ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-300 text-slate-600 hover:border-primary-400'}`}>
                  {c}
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
                  품절
                </span>
              ) : variantStock !== null ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  재고: <span className="font-semibold text-slate-800">{variantStock}개</span>
                </span>
              ) : null}
            </div>
          )}

          {/* 수량 */}
          <div className="flex items-center gap-3 mb-5">
            <p className="text-sm font-semibold text-slate-700">수량</p>
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
              {isOutOfStock ? '품절' : added ? '✓ 담겼습니다!' : '장바구니 담기'}
            </button>
            <button onClick={handleOrder} disabled={isOutOfStock} className={`flex-1 btn-primary ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isOutOfStock ? '품절' : '주문하기'}
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
                <p className="text-xs font-bold text-amber-700 mb-0.5">브랜드 공지사항</p>
                <p className="text-sm text-amber-800 whitespace-pre-wrap">{brandInfo.notice}</p>
              </div>
            </div>
          )}

          {/* 사이즈 정보 */}
          {(brandInfo.sizeInfo || brandInfo.sizeImages.length > 0) && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                <p className="text-xs font-bold text-slate-600">브랜드 사이즈 정보</p>
              </div>
              <div className="px-4 py-3 space-y-3">
                {brandInfo.sizeInfo && (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{brandInfo.sizeInfo}</p>
                )}
                {brandInfo.sizeImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {brandInfo.sizeImages.map((u, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden border border-slate-100">
                        <Image src={u} alt={`사이즈 ${i + 1}`} width={200} height={200} className="object-contain max-h-48 w-auto" />
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
                <p className="text-xs font-bold text-slate-600">브랜드 모델 정보</p>
              </div>
              <div className="px-4 py-3 space-y-3">
                {brandInfo.modelInfo && (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{brandInfo.modelInfo}</p>
                )}
                {brandInfo.modelImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {brandInfo.modelImages.map((u, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden border border-slate-100">
                        <Image src={u} alt={`모델 ${i + 1}`} width={200} height={200} className="object-contain max-h-48 w-auto" />
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
          <h2 className="text-lg font-bold text-slate-800 mb-5">상세 사이즈 / 상품 상세</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 mb-4">
            {product.sizeImages.map((img: string, i: number) => (
              <button key={i} onClick={() => setSizeImgIdx(i)}
                className={`relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${sizeImgIdx === i ? 'border-primary-500' : 'border-slate-200'}`}>
                <Image src={img} alt={`상세 ${i + 1}`} fill className="object-cover" />
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-lg rounded-2xl overflow-hidden border border-slate-100">
            <Image src={product.sizeImages[sizeImgIdx]} alt="상세 사이즈" width={600} height={600} className="w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
