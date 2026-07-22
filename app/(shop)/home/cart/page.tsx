'use client';
import { useCartStore } from '@/store/cart';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { getProductPrices } from '@/app/actions/prices';

function itemKey(productId: string, size: string, color: string) {
  return `${productId}::${size}::${color}`;
}

export default function CartPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const router = useRouter();
  const { items, removeItem, updateQuantity } = useCartStore();
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // 실시간 등급+세일 가격 (API에서 재조회)
  type LiveInfo = { price: number; gradePrice: number; isOnSale: boolean; saleType: string | null; saleValue: number | null; images: string[]; colors: string[]; brand: string; sizeExtraPrices: Record<string, number> };
  const [liveInfo, setLiveInfo] = useState<Record<string, LiveInfo> | null>(null);
  const [pricesLoading, setPricesLoading] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(() =>
    new Set(items.map((i) => itemKey(i.product.id, i.size, i.color)))
  );

  // 장바구니에 담긴 상품 ID 목록 (정렬된 문자열 — 변경 감지용)
  const productIdKey = useMemo(
    () => Array.from(new Set(items.map((i) => i.product.id))).sort().join(','),
    [items]
  );

  // 새 상품이 장바구니에 담기면 자동 선택
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      items.forEach((i) => next.add(itemKey(i.product.id, i.size, i.color)));
      return next;
    });
  }, [productIdKey]);

  // 상품 ID 목록이 바뀔 때마다 등급·세일 가격 재조회
  useEffect(() => {
    const ids = Array.from(new Set(items.map((i) => i.product.id)));
    if (ids.length === 0) { setLiveInfo({}); setPricesLoading(false); return; }

    setPricesLoading(true);
    getProductPrices(ids).then((results) => {
      const map: Record<string, LiveInfo> = {};
      results.forEach((p) => {
        map[p.id] = {
          price:           p.myFinalPrice,
          gradePrice:      p.myGradePrice,
          isOnSale:        p.isOnSale,
          saleType:        p.saleType,
          saleValue:       p.saleValue,
          images:          p.images,
          colors:          p.colors,
          brand:           p.brand,
          sizeExtraPrices: p.sizeExtraPrices ?? {},
        };
      });
      setLiveInfo(map);
      setPricesLoading(false);
    }).catch(() => setPricesLoading(false));
  // productIdKey가 바뀔 때만 재조회 (수량 변경 시에는 재조회 안 함)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIdKey]);

  // 실제 표시·결제 단가: API 재조회값 우선, 없으면 저장값 사용 (사이즈 추가 가격 포함)
  const getPrice = useCallback(
    (productId: string, size: string, fallback: number) => {
      if (!liveInfo) return fallback;
      const info = liveInfo[productId];
      if (!info) return fallback;
      const surcharge = (info.sizeExtraPrices?.[size] ?? 0);
      return info.price + surcharge;
    },
    [liveInfo]
  );

  const allKeys = useMemo(() => items.map((i) => itemKey(i.product.id, i.size, i.color)), [items]);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(allKeys));
  }, [allSelected, allKeys]);

  const toggleItem = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const handleRemove = (productId: string, size: string, color: string) => {
    const key = itemKey(productId, size, color);
    removeItem(productId, size, color);
    setSelected((prev) => { const next = new Set(prev); next.delete(key); return next; });
  };

  const selectedItems = items.filter((i) => selected.has(itemKey(i.product.id, i.size, i.color)));

  const selectedTotal = useMemo(
    () => selectedItems.reduce((sum, i) => sum + getPrice(i.product.id, i.size, i.product.price) * i.quantity, 0),
    [selectedItems, getPrice]
  );

  const handleOrder = async () => {
    if (!session) { router.push('/login'); return; }
    if (selectedItems.length === 0) { alert(t('cart.selectItemsAlert')); return; }

    setLoading(true);
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: selectedItems.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          price: getPrice(i.product.id, i.size, i.product.price),  // 등급+세일+사이즈 추가가
          size: i.size,
          color: i.color,
        })),
        totalAmount: selectedTotal,
        note: note || null,
      }),
    });

    if (res.ok) {
      selectedItems.forEach((i) => removeItem(i.product.id, i.size, i.color));
      setSubmitted(true);
    } else if (res.status === 401) {
      alert(t('cart.sessionExpired'));
      router.push('/login');
    } else {
      alert(t('cart.orderError'));
    }
    setLoading(false);
  };

  if (submitted) return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold text-slate-800 mb-3">{t('cart.orderCompleteTitle')}</h2>
      <p className="text-slate-500 mb-6">{t('cart.orderCompleteDesc')}</p>
      <div className="flex gap-3 justify-center">
        <Link href="/home/mypage/orders" className="btn-primary">{t('cart.viewOrderHistory')}</Link>
        <Link href="/home" className="btn-outline">{t('cart.continueShopping')}</Link>
      </div>
    </div>
  );

  if (items.length === 0) return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="text-6xl mb-4">🛒</div>
      <h2 className="text-xl font-semibold text-slate-700 mb-4">{t('cart.emptyTitle')}</h2>
      <Link href="/home/products" className="btn-primary">{t('cart.goShopping')}</Link>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t('cart.title')}</h1>
        {pricesLoading && (
          <span className="text-xs text-slate-400">{t('cart.priceChecking')}</span>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 상품 목록 */}
        <div className="lg:col-span-2 space-y-3">
          {/* 전체 선택 헤더 */}
          <div className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-100 rounded-xl">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 accent-primary-600 cursor-pointer"
            />
            <label className="text-sm text-slate-600 cursor-pointer select-none" onClick={toggleAll}>
              {t('cart.selectAll', { selected: selected.size, total: items.length })}
            </label>
          </div>

          {items.map((item) => {
            const key         = itemKey(item.product.id, item.size, item.color);
            const isSelected  = selected.has(key);
            const info        = liveInfo?.[item.product.id];
            const surcharge   = info?.sizeExtraPrices?.[item.size] ?? 0;
            const unitPrice   = getPrice(item.product.id, item.size, item.product.price);
            const isSale      = info?.isOnSale && info.price < info.gradePrice;
            const gradePrice  = (info?.gradePrice ?? item.product.price) + surcharge;

            return (
              <div key={key} className={`card p-4 flex gap-4 transition-colors ${isSelected ? 'border-primary-200 bg-white' : 'opacity-60 bg-slate-50'}`}>
                {/* 체크박스 */}
                <div className="flex items-center flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleItem(key)}
                    className="w-4 h-4 accent-primary-600 cursor-pointer"
                  />
                </div>

                {/* 상품 이미지 */}
                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-primary-50 flex-shrink-0">
                  {(() => {
                    const productInfo = liveInfo?.[item.product.id];
                    const colorIdx = productInfo?.colors ? productInfo.colors.indexOf(item.color) : -1;
                    const imgSrc = (colorIdx >= 0 && productInfo?.images?.[colorIdx])
                      ? productInfo.images[colorIdx]
                      : (item.product.image || 'https://placehold.co/80x80/EFF6FF/2563EB?text=상품');
                    return (
                      <Image
                        src={imgSrc}
                        alt={item.product.name}
                        fill
                        className="object-cover"
                      />
                    );
                  })()}
                </div>

                {/* 상품 정보 */}
                <div className="flex-1 min-w-0">
                  {info?.brand && (
                    <Link
                      href={`/home/products?brand=${encodeURIComponent(info.brand)}`}
                      className="text-xs text-primary-600 font-medium hover:underline"
                    >
                      {info.brand}
                    </Link>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <Link href={`/home/products/${item.product.id}`} className="font-medium text-slate-800 text-sm leading-tight hover:underline hover:text-primary-700">
                      {item.product.name}
                    </Link>
                    {isSale && (
                      <span className="text-xs font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">
                        {info?.saleType === 'RATE' ? `-${info.saleValue}%` : t('nav.sale')}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">{item.size} / {item.color}</p>
                  <div className="mt-1">
                    {isSale ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400 line-through">{formatPrice(gradePrice)}</span>
                        <span className="text-red-600 font-bold">{formatPrice(unitPrice)}</span>
                      </div>
                    ) : (
                      <span className="text-primary-700 font-bold">{formatPrice(unitPrice)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.size, item.color, Math.max(1, item.quantity - 1))}
                      className="w-7 h-7 border rounded flex items-center justify-center text-slate-500 hover:bg-slate-100"
                    >-</button>
                    <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.size, item.color, item.quantity + 1)}
                      className="w-7 h-7 border rounded flex items-center justify-center text-slate-500 hover:bg-slate-100"
                    >+</button>
                    <span className="text-xs text-slate-400 ml-2">{formatPrice(unitPrice * item.quantity)}</span>
                  </div>
                </div>

                {/* 삭제 */}
                <button
                  onClick={() => handleRemove(item.product.id, item.size, item.color)}
                  className="text-slate-300 hover:text-red-400 transition-colors self-start"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* 주문 요약 */}
        <div className="card p-5 h-fit">
          <h2 className="font-bold text-slate-800 mb-4">{t('cart.orderSummary')}</h2>

          {selectedItems.length > 0 ? (
            <div className="space-y-1 mb-4">
              {selectedItems.map((i) => (
                <div key={itemKey(i.product.id, i.size, i.color)} className="flex justify-between text-xs text-slate-500">
                  <span className="truncate max-w-[120px]">{i.product.name} ×{i.quantity}</span>
                  <span>{formatPrice(getPrice(i.product.id, i.size, i.product.price) * i.quantity)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 mb-4">{t('cart.noSelectedItems')}</p>
          )}

          <div className="space-y-2 text-sm text-slate-600 mb-4 border-t pt-3">
            <div className="flex justify-between">
              <span>{t('cart.selectedTotal')}</span>
              <span>{formatPrice(selectedTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('cart.shippingFee')}</span>
              <span className="text-green-600">{t('cart.free')}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-slate-800">
              <span>{t('cart.finalAmount')}</span>
              <span className="text-primary-700">{formatPrice(selectedTotal)}</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-slate-500 mb-1">{t('cart.noteLabel')}</label>
            <textarea
              className="input text-sm resize-none min-h-16"
              placeholder={t('cart.notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <button
            onClick={handleOrder}
            disabled={loading || selectedItems.length === 0 || pricesLoading}
            className="w-full btn-primary text-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('cart.processing') : pricesLoading ? t('cart.priceChecking') : t('cart.orderButton', { count: selectedItems.length })}
          </button>
          <p className="text-xs text-slate-400 text-center mt-2">{t('cart.orderFooterNote')}</p>
        </div>
      </div>
    </div>
  );
}
